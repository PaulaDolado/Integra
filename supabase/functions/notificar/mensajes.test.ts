import { describe, expect, it } from "vitest";
import { cuerpo, destino, enlace, variableWebhook, type Notificacion } from "./mensajes.ts";

const TEAMS = "https://prod-00.westeurope.logic.azure.com/workflows/abc/triggers/manual/paths/invoke?sig=x";
const GOOGLE = "https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t";
const APP = "https://empresa.github.io/Integra/";

const aviso = (cambios: Partial<Notificacion> = {}): Notificacion => ({
  id: "n1",
  evento: "ticket.nuevo",
  canal: "tecnologia",
  destinatario_email: null,
  titulo: "Nuevo ticket: No funciona la VPN",
  texto: "Laura Gómez ha abierto una incidencia con prioridad alta.",
  ruta: "/tickets/t1",
  ...cambios,
});

describe("destino del aviso", () => {
  it("cada canal usa su variable y los directos WEBHOOK_PERSONAL", () => {
    expect(variableWebhook({ canal: "rrhh" })).toBe("WEBHOOK_RRHH");
    expect(variableWebhook({ canal: "tecnologia" })).toBe("WEBHOOK_TECNOLOGIA");
    expect(variableWebhook({ canal: null })).toBe("WEBHOOK_PERSONAL");
  });

  it("reconoce Teams y Google Chat por la URL", () => {
    expect(destino(aviso(), { WEBHOOK_TECNOLOGIA: TEAMS })).toEqual({ ok: true, url: TEAMS, plataforma: "teams" });
    expect(destino(aviso(), { WEBHOOK_TECNOLOGIA: GOOGLE })).toEqual({ ok: true, url: GOOGLE, plataforma: "google_chat" });
  });

  it("sin webhook configurado, o sin https, no se envía", () => {
    expect(destino(aviso(), {})).toEqual({ ok: false, motivo: "No hay webhook configurado (WEBHOOK_TECNOLOGIA)" });
    expect(destino(aviso(), { WEBHOOK_TECNOLOGIA: "http://ejemplo.test/hook" }).ok).toBe(false);
    expect(destino(aviso(), { WEBHOOK_TECNOLOGIA: "no es una url" }).ok).toBe(false);
  });

  it("Google Chat no admite mensajes directos", () => {
    const directo = aviso({ canal: null, destinatario_email: "laura@empresa.test" });
    expect(destino(directo, { WEBHOOK_PERSONAL: GOOGLE }).ok).toBe(false);
    expect(destino(directo, { WEBHOOK_PERSONAL: TEAMS }).ok).toBe(true);
  });
});

describe("formato del mensaje", () => {
  it("Google Chat: título en negrita y enlace a la app", () => {
    expect(cuerpo(aviso(), "google_chat", APP)).toEqual({
      text: "*Nuevo ticket: No funciona la VPN*\nLaura Gómez ha abierto una incidencia con prioridad alta.\n<https://empresa.github.io/Integra/tickets/t1|Abrir en Integra>",
    });
  });

  it("Teams: Adaptive Card con botón, y destinatario solo en los directos", () => {
    const canal = cuerpo(aviso(), "teams", APP) as { destinatario?: string; attachments: { content: { actions: { url: string }[] } }[] };
    expect(canal.destinatario).toBeUndefined();
    expect(canal.attachments[0].content.actions[0].url).toBe("https://empresa.github.io/Integra/tickets/t1");

    const directo = cuerpo(aviso({ canal: null, destinatario_email: "laura@empresa.test" }), "teams", APP);
    expect(directo).toMatchObject({ destinatario: "laura@empresa.test" });
  });

  it("el texto de los usuarios no puede mencionar a todo el espacio ni crear enlaces", () => {
    const malicioso = aviso({ titulo: "Urgente <users/all>", texto: "<https://phishing.test|Pulsa aquí>" });
    const { text } = cuerpo(malicioso, "google_chat", APP) as { text: string };
    expect(text).not.toContain("<users/all>");
    expect(text).not.toContain("<https://phishing.test");
  });

  it("sin APP_URL o sin ruta no hay enlace", () => {
    expect(enlace("/noticias", "")).toBeNull();
    expect(enlace(null, APP)).toBeNull();
    expect(cuerpo(aviso({ ruta: null }), "teams", APP)).not.toHaveProperty("attachments.0.content.actions");
  });
});
