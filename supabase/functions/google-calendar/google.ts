// Piezas sin dependencias de Deno de la Edge Function «google-calendar»
// (se prueban con Vitest): la URL de autorización de Google, el cifrado de los
// tokens, la validación de la página de vuelta y la conversión de los eventos.

// Solo lectura de los eventos, y el correo para mostrar qué cuenta se ha conectado
export const ALCANCES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events.readonly",
];

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOCAR = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_EVENTOS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Cadenas aleatorias -------------------------------------------------------------------

export const hexAleatorio = (bytes = 32) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");

const base64url = (datos: Uint8Array) =>
  btoa(String.fromCharCode(...datos)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// PKCE (RFC 7636): el verificador se queda en el servidor y Google solo ve su hash
export const codeVerifier = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export async function codeChallenge(verifier: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(hash));
}

export function urlAutorizacion(p: { clientId: string; redirectUri: string; estado: string; challenge: string }) {
  const url = new URL(GOOGLE_AUTH);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: ALCANCES.join(" "),
    state: p.estado,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    // offline + consent: Google da un refresh token también si ya se había conectado antes
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  }).toString();
  return url.toString();
}

// Página de vuelta -----------------------------------------------------------------

// Solo se vuelve a la propia app (APP_URL) o, en desarrollo, a localhost.
// Si no, cualquiera podría usar la función para redirigir a otra web.
export function volverPermitido(volver: string, appUrl: string | undefined): boolean {
  let url: URL;
  try {
    url = new URL(volver);
  } catch {
    return false;
  }
  if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return true;
  if (!appUrl) return false;
  const app = new URL(appUrl);
  return url.protocol === "https:" && url.origin === app.origin && url.pathname.startsWith(app.pathname);
}

export function conResultado(volver: string, resultado: "conectado" | "cancelado" | "error") {
  const url = new URL(volver);
  url.searchParams.set("google", resultado);
  return url.toString();
}

// Cifrado de los tokens (AES-GCM 256) -------------------------------------------------

export async function claveTokens(base64: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("GOOGLE_TOKENS_CLAVE debe tener 32 bytes en base64");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// base64(iv || texto cifrado), con un IV aleatorio en cada cifrado
export async function cifrarToken(clave: CryptoKey, token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, clave, new TextEncoder().encode(token)));
  const todo = new Uint8Array(iv.length + cifrado.length);
  todo.set(iv);
  todo.set(cifrado, iv.length);
  return btoa(String.fromCharCode(...todo));
}

export async function descifrarToken(clave: CryptoKey, guardado: string): Promise<string> {
  const todo = Uint8Array.from(atob(guardado), (c) => c.charCodeAt(0));
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: todo.slice(0, 12) }, clave, todo.slice(12));
  return new TextDecoder().decode(claro);
}

// El correo del id_token. Viene directamente de Google por HTTPS en el
// intercambio del código, así que no hace falta comprobar la firma.
export function emailDelIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const carga = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const datos = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(carga), (c) => c.charCodeAt(0))));
    return typeof datos.email === "string" ? datos.email : null;
  } catch {
    return null;
  }
}

// Eventos ------------------------------------------------------------------------

// Lo justo de un evento de la API de Google Calendar
export interface EventoGoogleApi {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  transparency?: "opaque" | "transparent";
  visibility?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

// Lo que recibe la app
export interface EventoGoogle {
  id: string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  todo_el_dia: boolean;
  // false si en Google está como «Disponible»: no cuenta como tiempo ocupado
  ocupado: boolean;
  enlace: string | null;
}

// Google guarda la descripción con algo de HTML (saltos, negritas, enlaces):
// la app la muestra como texto, así que se queda solo el texto
export const textoPlano = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Los de todo el día traen solo la fecha (el fin es el día siguiente, exclusivo):
// se pasan a medianoche en la zona horaria de la empresa
const medianoche = (fecha: string, zona: string) => {
  // Desfase de la zona ese día, calculado con Intl (sin librerías)
  const utc = new Date(`${fecha}T00:00:00Z`);
  const enZona = new Date(utc.toLocaleString("en-US", { timeZone: zona }));
  const enUtc = new Date(utc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(utc.getTime() - (enZona.getTime() - enUtc.getTime())).toISOString();
};

export function normalizarEvento(e: EventoGoogleApi, zona = "Europe/Madrid"): EventoGoogle | null {
  if (e.status === "cancelled") return null;
  const todoElDia = !e.start?.dateTime && !!e.start?.date;
  const inicio = e.start?.dateTime ?? (e.start?.date ? medianoche(e.start.date, zona) : null);
  const fin = e.end?.dateTime ?? (e.end?.date ? medianoche(e.end.date, zona) : null);
  if (!inicio || !fin) return null;
  return {
    id: e.id,
    titulo: e.summary?.trim() || "(Sin título)",
    descripcion: e.description ? textoPlano(e.description) || null : null,
    ubicacion: e.location?.trim() || null,
    fecha_inicio: new Date(inicio).toISOString(),
    fecha_fin: new Date(fin).toISOString(),
    todo_el_dia: todoElDia,
    ocupado: e.transparency !== "transparent",
    enlace: e.htmlLink ?? null,
  };
}
