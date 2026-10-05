// Monitorización de errores en producción con Sentry. Está apagada por defecto:
// solo se activa en el build de producción y si se configura VITE_SENTRY_DSN.
// Sin DSN no se descarga la librería ni se envía nada a ningún sitio.
//
// Los datos son de empleados, así que lo que sale hacia Sentry es lo mínimo:
// el error, su traza y la pantalla en la que ocurrió. Ni el usuario, ni el
// cuerpo de las peticiones, ni las cabeceras, ni los parámetros de las URL, y
// antes de enviar se borra cualquier cosa con forma de correo, IBAN o token.

// Solo tipos: no añaden nada al build. La librería se descarga aparte con import()
import type { Breadcrumb, ErrorEvent as EventoSentry } from "@sentry/react";

type Sentry = typeof import("./sentry");

export interface ContextoError {
  // De dónde viene el error: "interfaz", "consulta", "mutacion"...
  origen: string;
  componentStack?: string;
  // Datos sueltos sin información personal (por ejemplo, el nombre de la consulta)
  datos?: Record<string, string | number | boolean | undefined>;
}

const MAXIMO_EN_COLA = 20;

let sentry: Sentry | null = null;
let carga: Promise<void> | null = null;
let cola: Array<[unknown, ContextoError | undefined]> = [];

export const monitorizacionActiva = () =>
  Boolean(import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN);

// ---------------------------------------------------------------------------
// Limpieza de datos personales

const SUSTITUTO = "[filtrado]";

const PATRONES: RegExp[] = [
  // JWT (los tokens de sesión de Supabase empiezan por eyJ)
  /\beyJ[\w-]+\.[\w-]+\.[\w-]*/g,
  // Cabeceras de autorización y claves de Supabase
  /\bBearer\s+[\w.~+/-]+=*/gi,
  /\bsb_(?:publishable|secret)_[\w-]+/g,
  // Parámetros con tokens o contraseñas escritos fuera de una URL
  /\b(access_token|refresh_token|token|apikey|api_key|password|contrasena|code)=[^&\s"']+/gi,
  // Correos electrónicos
  /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi,
  // IBAN, con o sin espacios cada cuatro caracteres (ES12 3456 7890 ...)
  /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z\d]){11,30}\b/g,
];

// Las URL se quedan sin parámetros ni fragmento: en ellos viajan filtros con
// datos (?email=eq...) y los tokens de los enlaces de recuperar contraseña (#access_token=...)
const URL_CON_PARAMETROS = /(\b[a-z][a-z\d+.-]*:\/\/[^\s?#"'<>]*)[?#][^\s"'<>]*/gi;

export function limpiarTexto(texto: string): string {
  let limpio = texto.replace(URL_CON_PARAMETROS, "$1");
  for (const patron of PATRONES) {
    limpio = limpio.replace(patron, (coincidencia, clave?: string) =>
      // En "token=..." se conserva el nombre del parámetro para saber qué había
      typeof clave === "string" && coincidencia.startsWith(clave) ? `${clave}=${SUSTITUTO}` : SUSTITUTO
    );
  }
  return limpio;
}

// Recorre el evento entero y limpia cada texto, también los nombres de las claves
function limpiarValor(valor: unknown, profundidad = 0): unknown {
  if (typeof valor === "string") return limpiarTexto(valor);
  if (!valor || typeof valor !== "object" || profundidad > 12) return valor;
  if (Array.isArray(valor)) return valor.map((v) => limpiarValor(v, profundidad + 1));
  const limpio: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) {
    limpio[limpiarTexto(clave)] = limpiarValor(v, profundidad + 1);
  }
  return limpio;
}

// beforeSend: lo último que pasa antes de salir hacia Sentry
export function limpiarEvento<T extends EventoSentry>(evento: T): T {
  // Nada del usuario: ni correo, ni id, ni IP
  delete evento.user;
  if (evento.request) {
    const { url } = evento.request;
    evento.request = url ? { url } : {};
  }
  return limpiarValor(evento) as T;
}

// ---------------------------------------------------------------------------
// Envío

// Los errores de Supabase no son instancias de Error: se convierten para que
// Sentry los agrupe bien, y se descartan details y hint, que pueden llevar valores
function comoError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const convertido = new Error(error.message);
    if ("code" in error && typeof error.code === "string") convertido.name = `Error ${error.code}`;
    return convertido;
  }
  return new Error(typeof error === "string" ? error : "Error desconocido");
}

function enviar(s: Sentry, error: unknown, contexto?: ContextoError) {
  s.withScope((scope) => {
    if (contexto) {
      scope.setTag("origen", contexto.origen);
      if (contexto.componentStack) scope.setContext("react", { componentStack: contexto.componentStack });
      if (contexto.datos) scope.setContext("datos", contexto.datos);
    }
    s.captureException(comoError(error));
  });
}

export function notificarError(error: unknown, contexto?: ContextoError) {
  if (!monitorizacionActiva()) return;
  if (sentry) return enviar(sentry, error, contexto);
  // Mientras se descarga Sentry, los errores esperan en una cola corta
  if (cola.length < MAXIMO_EN_COLA) cola.push([error, contexto]);
}

// Errores globales que llegan antes de que Sentry esté cargado; después los recoge el propio Sentry
const alErrorGlobal = (evento: ErrorEvent) => notificarError(evento.error ?? evento.message, { origen: "ventana" });
const alRechazoSinCapturar = (evento: PromiseRejectionEvent) =>
  notificarError(evento.reason, { origen: "promesa" });

async function cargarSentry() {
  window.addEventListener("error", alErrorGlobal);
  window.addEventListener("unhandledrejection", alRechazoSinCapturar);
  try {
    const s = await import("./sentry");
    s.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_RELEASE || undefined,
      // Ni usuario, ni cookies, ni cabeceras, ni cuerpos, ni parámetros de URL
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
      // Solo errores: sin rendimiento ni grabación de sesiones (no se añaden
      // browserTracingIntegration ni replayIntegration)
      sendClientReports: false,
      integrations: (predeterminadas) => [
        ...predeterminadas.filter(
          // Console guarda como migas lo que se escribe en la consola, que puede llevar datos;
          // BrowserSession envía una sesión en cada visita, que no hace falta
          (integracion) => !["Console", "BrowserSession", "Breadcrumbs"].includes(integracion.name)
        ),
        // Migas de navegación y de peticiones (ya sin parámetros), pero no de clics:
        // el selector del elemento puede llevar el nombre de un empleado en title o aria-label
        s.breadcrumbsIntegration({ dom: false }),
      ],
      beforeSend: (evento) => limpiarEvento(evento),
      beforeBreadcrumb: (miga) => limpiarValor(miga) as Breadcrumb,
    });
    sentry = s;
    const pendientes = cola;
    cola = [];
    for (const [error, contexto] of pendientes) enviar(s, error, contexto);
  } catch (error) {
    // Si no se puede descargar (bloqueador, sin red), la app sigue igual
    console.warn("No se ha podido cargar la monitorización de errores", error);
    cola = [];
  } finally {
    window.removeEventListener("error", alErrorGlobal);
    window.removeEventListener("unhandledrejection", alRechazoSinCapturar);
  }
}

// Se llama una vez al arrancar; no bloquea el primer render
export function iniciarMonitorizacion(): Promise<void> {
  // La condición va escrita aquí, no con monitorizacionActiva(): así, en un build
  // sin DSN, el minificador ve que siempre es falsa y quita también el import()
  if (!(import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN)) return Promise.resolve();
  carga ??= cargarSentry();
  return carga;
}

// Solo para los tests: vuelve al estado inicial
export function reiniciarMonitorizacion() {
  sentry = null;
  carga = null;
  cola = [];
}
