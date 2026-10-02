// Edge Function «notificar»: vacía la cola public.notificaciones y envía cada
// aviso al webhook de Teams o Google Chat que le corresponde.
//
// La llama la base de datos (pg_net) al encolar un aviso y cada 5 minutos para
// los reintentos. No acepta JWT de usuarios: exige la cabecera
// x-integra-secreto con el valor de NOTIFICACIONES_SECRETO.
//
// Para probar un webhook: POST con {"prueba": "rrhh"} (o el canal que sea).

import { createClient } from "npm:@supabase/supabase-js@2";
import { cuerpo, destino, type Notificacion } from "./mensajes.ts";

const SECRETO = Deno.env.get("NOTIFICACIONES_SECRETO") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const LOTE = 20;
const MAX_LOTES = 5;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// Comparación en tiempo constante, para no filtrar el secreto por tiempos
function mismoSecreto(recibido: string): boolean {
  if (!SECRETO || recibido.length !== SECRETO.length) return false;
  let diferencia = 0;
  for (let i = 0; i < SECRETO.length; i++) diferencia |= recibido.charCodeAt(i) ^ SECRETO.charCodeAt(i);
  return diferencia === 0;
}

async function enviar(n: Notificacion): Promise<{ estado: "enviada" | "error" | "omitida"; error?: string }> {
  const d = destino(n, Deno.env.toObject());
  if (!d.ok) return { estado: "omitida", error: d.motivo };
  try {
    const res = await fetch(d.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo(n, d.plataforma, APP_URL)),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { estado: "enviada" };
    return { estado: "error", error: `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (e) {
    return { estado: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

async function procesar(n: Notificacion) {
  const r = await enviar(n);
  const { error } = await supabase
    .from("notificaciones")
    .update({
      estado: r.estado,
      error: r.error ?? null,
      enviada_at: r.estado === "enviada" ? new Date().toISOString() : null,
    })
    .eq("id", n.id);
  if (error) console.error(`No se pudo actualizar el aviso ${n.id}:`, error.message);
  return r.estado;
}

const json = (datos: unknown, status = 200) =>
  new Response(JSON.stringify(datos), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!mismoSecreto(req.headers.get("x-integra-secreto") ?? "")) return json({ error: "No autorizado" }, 401);

  const peticion = await req.json().catch(() => ({}));

  if (typeof peticion?.prueba === "string") {
    const r = await enviar({
      id: "prueba",
      evento: "prueba",
      canal: peticion.prueba,
      destinatario_email: null,
      titulo: "Prueba de avisos de Integra",
      texto: `Si lees esto, el canal «${peticion.prueba}» está bien configurado.`,
      ruta: "/dashboard",
    });
    return json(r, r.estado === "enviada" ? 200 : 502);
  }

  const resumen = { enviada: 0, error: 0, omitida: 0 };
  for (let i = 0; i < MAX_LOTES; i++) {
    const { data, error } = await supabase.rpc("reclamar_notificaciones", { p_limite: LOTE });
    if (error) return json({ error: error.message }, 500);
    const lote = (data ?? []) as Notificacion[];
    for (const estado of await Promise.all(lote.map(procesar))) resumen[estado]++;
    if (lote.length < LOTE) break;
  }
  return json(resumen);
});
