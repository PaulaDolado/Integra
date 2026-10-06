// Edge Function «google-calendar»: conecta la cuenta de Google de cada persona
// (OAuth, solo lectura) y le devuelve sus eventos de Google Calendar.
//
//   POST { accion: "iniciar", volver }             → { url } de Google para dar permiso
//   POST { accion: "completar", code, state, error } → { resultado }
//   POST { accion: "eventos", desde, hasta }       → { conectado, eventos }
//   POST { accion: "desconectar" }                 → revoca el permiso y borra los tokens
//
// Google no vuelve aquí, sino a la propia web (/google-callback, el «volver» de
// «iniciar»): así la pantalla de permisos muestra el dominio de Integra y no el
// de Supabase, y Google puede verificar la marca. Esa página manda el código a
// «completar», que hace el intercambio con el client secret y PKCE.
//
// Todas las peticiones llevan el JWT de la sesión de Integra y la propia función
// lo comprueba (verify_jwt está desactivado para poder responder al preflight
// de CORS). Los tokens de Google se guardan cifrados con GOOGLE_TOKENS_CLAVE.
//
// Secretos: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKENS_CLAVE y APP_URL.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  GOOGLE_EVENTOS,
  GOOGLE_REVOCAR,
  GOOGLE_TOKEN,
  cifrarToken,
  claveTokens,
  codeChallenge,
  codeVerifier,
  descifrarToken,
  emailDelIdToken,
  hexAleatorio,
  normalizarEvento,
  urlAutorizacion,
  volverPermitido,
  type EventoGoogleApi,
} from "./google.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const CLAVE_TOKENS = Deno.env.get("GOOGLE_TOKENS_CLAVE") ?? "";
const APP_URL = Deno.env.get("APP_URL") || undefined;
// Como mucho este rango por petición (la app pide el rango visible, como mucho un año)
const MAX_RANGO_DIAS = 400;

const servicio = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let clave: Promise<CryptoKey> | null = null;
const laClave = () => (clave ??= claveTokens(CLAVE_TOKENS));

// Quién llama, con su propia sesión: así se aplican las mismas reglas que en la app
async function empleadoDeLaSesion(req: Request): Promise<string | Response> {
  const autorizacion = req.headers.get("Authorization");
  if (!autorizacion) return json({ error: "No autorizado" }, 401);
  const usuario: SupabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: autorizacion } },
    auth: { persistSession: false },
  });
  const [{ data: empleado }, { data: dobleFactor }] = await Promise.all([
    usuario.rpc("mi_empleado_id"),
    usuario.rpc("cumple_doble_factor"),
  ]);
  if (!empleado) return json({ error: "No autorizado" }, 401);
  if (dobleFactor === false) return json({ error: "Verifica el doble factor" }, 403);
  return empleado as string;
}

async function pedirTokens(parametros: Record<string, string>) {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...parametros }),
    signal: AbortSignal.timeout(10_000),
  });
  const datos = await res.json().catch(() => ({}));
  return { ok: res.ok, datos };
}

// La página /google-callback de Integra manda aquí lo que le ha dado Google ----------
async function completar(
  empleado: string,
  p: { code?: unknown; state?: unknown; error?: unknown }
): Promise<Response> {
  const estado = typeof p.state === "string" ? p.state : "";
  if (!/^[0-9a-f]{64}$/.test(estado)) return json({ resultado: "error" }, 400);

  // El estado se usa una sola vez, y solo lo puede completar quien lo empezó
  const { data: peticion } = await servicio
    .from("google_oauth_estados")
    .delete()
    .eq("estado", estado)
    .eq("empleado_id", empleado)
    .select("code_verifier, volver, expira")
    .maybeSingle();
  if (!peticion || new Date(peticion.expira) < new Date()) return json({ resultado: "caducado" });

  // La persona canceló en la pantalla de Google
  if (p.error) return json({ resultado: "cancelado" });

  const { ok, datos } = await pedirTokens({
    grant_type: "authorization_code",
    code: typeof p.code === "string" ? p.code : "",
    // La misma página a la que volvió Google: si no coincide, Google no da los tokens
    redirect_uri: peticion.volver,
    code_verifier: peticion.code_verifier,
  });
  if (!ok || !datos.refresh_token) {
    console.error("Google no ha dado tokens:", datos.error ?? "sin refresh_token");
    return json({ resultado: "error" });
  }

  const k = await laClave();
  const { error } = await servicio.from("google_calendar_conexiones").upsert({
    empleado_id: empleado,
    email: emailDelIdToken(datos.id_token),
    refresh_token_cifrado: await cifrarToken(k, datos.refresh_token),
    access_token_cifrado: await cifrarToken(k, datos.access_token),
    access_token_expira: new Date(Date.now() + (datos.expires_in - 60) * 1000).toISOString(),
    conectado_en: new Date().toISOString(),
  });
  if (error) {
    console.error("No se pudo guardar la conexión:", error.message);
    return json({ resultado: "error" });
  }
  return json({ resultado: "conectado" });
}

// Un access token válido: el guardado, o uno nuevo con el refresh token.
// null si la persona ha retirado el permiso en Google (se borra la conexión).
async function accessToken(empleado: string): Promise<string | null | "sin-conexion"> {
  const { data: c } = await servicio
    .from("google_calendar_conexiones")
    .select("refresh_token_cifrado, access_token_cifrado, access_token_expira")
    .eq("empleado_id", empleado)
    .maybeSingle();
  if (!c) return "sin-conexion";

  const k = await laClave();
  if (c.access_token_cifrado && c.access_token_expira && new Date(c.access_token_expira) > new Date()) {
    return descifrarToken(k, c.access_token_cifrado);
  }

  const { ok, datos } = await pedirTokens({
    grant_type: "refresh_token",
    refresh_token: await descifrarToken(k, c.refresh_token_cifrado),
  });
  if (!ok) {
    if (datos.error === "invalid_grant") {
      await servicio.from("google_calendar_conexiones").delete().eq("empleado_id", empleado);
      return null;
    }
    throw new Error(`Google no ha renovado el token: ${datos.error ?? "error desconocido"}`);
  }
  await servicio
    .from("google_calendar_conexiones")
    .update({
      access_token_cifrado: await cifrarToken(k, datos.access_token),
      access_token_expira: new Date(Date.now() + (datos.expires_in - 60) * 1000).toISOString(),
    })
    .eq("empleado_id", empleado);
  return datos.access_token;
}

async function eventos(empleado: string, desde: string, hasta: string): Promise<Response> {
  const inicio = new Date(desde);
  const fin = new Date(hasta);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin <= inicio || fin.getTime() - inicio.getTime() > MAX_RANGO_DIAS * 86_400_000) {
    return json({ error: "Rango no válido" }, 400);
  }

  const token = await accessToken(empleado);
  if (token === "sin-conexion") return json({ conectado: false });
  if (token === null) return json({ conectado: false, motivo: "revocado" });

  const lista: EventoGoogleApi[] = [];
  let pagina: string | undefined;
  // Como mucho 5 páginas de 250: de sobra para un año de calendario
  for (let i = 0; i < 5; i++) {
    const url = new URL(GOOGLE_EVENTOS);
    url.search = new URLSearchParams({
      timeMin: inicio.toISOString(),
      timeMax: fin.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pagina ? { pageToken: pagina } : {}),
    }).toString();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error("Google Calendar ha respondido", res.status, (await res.text()).slice(0, 300));
      return json({ error: "No se pudieron leer los eventos de Google" }, 502);
    }
    const datos = await res.json();
    lista.push(...(datos.items ?? []));
    pagina = datos.nextPageToken;
    if (!pagina) break;
  }

  const { data: c } = await servicio.from("google_calendar_conexiones").select("email").eq("empleado_id", empleado).maybeSingle();
  return json({
    conectado: true,
    email: c?.email ?? null,
    eventos: lista.map((e) => normalizarEvento(e)).filter(Boolean),
  });
}

async function desconectar(empleado: string): Promise<Response> {
  const { data: c } = await servicio
    .from("google_calendar_conexiones")
    .delete()
    .eq("empleado_id", empleado)
    .select("refresh_token_cifrado")
    .maybeSingle();
  if (c) {
    // Retira también el permiso en Google; si falla, los tokens ya están borrados
    const token = await descifrarToken(await laClave(), c.refresh_token_cifrado).catch(() => null);
    if (token) {
      await fetch(`${GOOGLE_REVOCAR}?token=${encodeURIComponent(token)}`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(
        () => undefined
      );
    }
  }
  return json({ conectado: false });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!CLIENT_ID || !CLIENT_SECRET || !CLAVE_TOKENS) {
    return json({ error: "Google Calendar no está configurado en el servidor" }, 503);
  }

  const empleado = await empleadoDeLaSesion(req);
  if (empleado instanceof Response) return empleado;
  const peticion = await req.json().catch(() => ({}));

  try {
    switch (peticion.accion) {
      case "iniciar": {
        if (typeof peticion.volver !== "string" || !volverPermitido(peticion.volver, APP_URL)) {
          return json({ error: "Página de vuelta no permitida" }, 400);
        }
        const estado = hexAleatorio();
        const verifier = codeVerifier();
        const { error } = await servicio
          .from("google_oauth_estados")
          .insert({ estado, empleado_id: empleado, code_verifier: verifier, volver: peticion.volver });
        if (error) throw new Error(error.message);
        return json({
          url: urlAutorizacion({ clientId: CLIENT_ID, redirectUri: peticion.volver, estado, challenge: await codeChallenge(verifier) }),
        });
      }
      case "completar":
        return completar(empleado, peticion);
      case "eventos":
        return eventos(empleado, peticion.desde, peticion.hasta);
      case "desconectar":
        return desconectar(empleado);
      default:
        return json({ error: "Acción desconocida" }, 400);
    }
  } catch (e) {
    console.error("Error en google-calendar:", e instanceof Error ? e.message : e);
    return json({ error: "Error del servidor" }, 500);
  }
});
