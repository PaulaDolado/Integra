// Formato de los avisos para Teams y Google Chat. Sin dependencias de Deno
// para poder probarlo con Vitest.

export interface Notificacion {
  id: string;
  evento: string;
  canal: string | null;
  destinatario_email: string | null;
  titulo: string;
  texto: string;
  ruta: string | null;
}

export type Plataforma = "teams" | "google_chat";

export type Destino =
  | { ok: true; url: string; plataforma: Plataforma }
  | { ok: false; motivo: string };

// Variable de entorno con el webhook de cada destino: WEBHOOK_RRHH,
// WEBHOOK_TECNOLOGIA, WEBHOOK_GENERAL… y WEBHOOK_PERSONAL para los mensajes directos
export function variableWebhook(n: Pick<Notificacion, "canal">): string {
  return n.canal ? `WEBHOOK_${n.canal.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : "WEBHOOK_PERSONAL";
}

export function plataforma(url: string): Plataforma {
  return new URL(url).hostname === "chat.googleapis.com" ? "google_chat" : "teams";
}

export function destino(n: Notificacion, env: Record<string, string | undefined>): Destino {
  const variable = variableWebhook(n);
  const url = env[variable]?.trim();
  if (!url) return { ok: false, motivo: `No hay webhook configurado (${variable})` };

  let p: Plataforma;
  try {
    if (new URL(url).protocol !== "https:") return { ok: false, motivo: `${variable} debe ser una URL https` };
    p = plataforma(url);
  } catch {
    return { ok: false, motivo: `${variable} no es una URL válida` };
  }
  // Un webhook de Google Chat publica en un espacio: no puede escribir a una persona
  if (!n.canal && p === "google_chat") {
    return { ok: false, motivo: "Google Chat no permite mensajes directos con un webhook" };
  }
  return { ok: true, url, plataforma: p };
}

// Evita que el texto de un ticket o un comunicado mencione a todo el espacio
// (<users/all>) o cree enlaces con la sintaxis <url|texto> de Google Chat
export const neutralizar = (texto: string) => texto.replace(/</g, "‹").replace(/>/g, "›");

export function enlace(ruta: string | null, appUrl: string): string | null {
  if (!ruta || !appUrl) return null;
  return `${appUrl.replace(/\/+$/, "")}/${ruta.replace(/^\/+/, "")}`;
}

export function cuerpo(n: Notificacion, p: Plataforma, appUrl: string): Record<string, unknown> {
  const titulo = neutralizar(n.titulo);
  const texto = neutralizar(n.texto);
  const url = enlace(n.ruta, appUrl);

  if (p === "google_chat") {
    return { text: `*${titulo}*\n${texto}${url ? `\n<${url}|Abrir en Integra>` : ""}` };
  }

  // Teams (Workflows): mensaje con una Adaptive Card. En los mensajes directos
  // se añade «destinatario» para que el flujo sepa a quién escribir.
  return {
    type: "message",
    ...(n.destinatario_email ? { destinatario: n.destinatario_email } : {}),
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: titulo, weight: "Bolder", size: "Medium", wrap: true },
            { type: "TextBlock", text: texto, wrap: true },
          ],
          ...(url ? { actions: [{ type: "Action.OpenUrl", title: "Abrir en Integra", url }] } : {}),
        },
      },
    ],
  };
}
