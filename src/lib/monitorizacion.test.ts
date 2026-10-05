import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorEvent } from "@sentry/react";
import {
  iniciarMonitorizacion,
  limpiarEvento,
  limpiarTexto,
  notificarError,
  reiniciarMonitorizacion,
} from "./monitorizacion";

// Sustituye a @sentry/react y apunta si alguien ha llegado a importarlo
const sentry = vi.hoisted(() => ({
  importado: false,
  init: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/react", () => {
  sentry.importado = true;
  const scope = { setTag: vi.fn(), setContext: vi.fn() };
  return {
    init: sentry.init,
    captureException: sentry.captureException,
    withScope: (callback: (s: typeof scope) => void) => callback(scope),
    breadcrumbsIntegration: () => ({ name: "Breadcrumbs" }),
  };
});

const DSN = "https://clave@o123.ingest.de.sentry.io/456";
const JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJh";

describe("monitorización de errores", () => {
  beforeEach(() => {
    reiniciarMonitorizacion();
    sentry.importado = false;
    sentry.init.mockReset();
    sentry.captureException.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sin DSN no descarga Sentry ni envía nada", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_SENTRY_DSN", "");

    await iniciarMonitorizacion();
    notificarError(new Error("fallo"));

    expect(sentry.importado).toBe(false);
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("fuera del build de producción tampoco, aunque haya DSN", async () => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("VITE_SENTRY_DSN", DSN);

    await iniciarMonitorizacion();
    notificarError(new Error("fallo"));

    expect(sentry.importado).toBe(false);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("con DSN en producción arranca Sentry sin datos personales y envía los errores que esperaban", async () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_SENTRY_DSN", DSN);

    const carga = iniciarMonitorizacion();
    notificarError(new Error("antes de cargar"), { origen: "interfaz" });
    await carga;

    expect(sentry.init).toHaveBeenCalledTimes(1);
    const opciones = sentry.init.mock.calls[0][0];
    expect(opciones.dsn).toBe(DSN);
    expect(opciones.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });
    // Sin migas de la consola ni sesiones; las migas de siempre, sin clics
    const integraciones = opciones.integrations([
      { name: "Console" },
      { name: "GlobalHandlers" },
      { name: "BrowserSession" },
      { name: "Breadcrumbs" },
    ]);
    expect(integraciones.map((i: { name: string }) => i.name)).toEqual(["GlobalHandlers", "Breadcrumbs"]);
    expect(opciones.tracesSampleRate).toBeUndefined();
    expect(sentry.captureException).toHaveBeenCalledWith(new Error("antes de cargar"));

    notificarError({ message: "violates row-level security policy", code: "42501", details: "Key (email)=(ana@empresa.es)" });
    const enviado = sentry.captureException.mock.calls[1][0];
    expect(enviado).toBeInstanceOf(Error);
    expect(enviado.name).toBe("Error 42501");
    expect(JSON.stringify(enviado)).not.toContain("ana@empresa.es");
  });
});

describe("limpieza de datos personales", () => {
  it("borra correos, IBAN y tokens de los textos", () => {
    expect(limpiarTexto("No existe ana.garcia@empresa.es")).toBe("No existe [filtrado]");
    expect(limpiarTexto("IBAN ES91 2100 0418 4502 0005 1332 inválido")).toBe("IBAN [filtrado] inválido");
    expect(limpiarTexto("IBAN ES9121000418450200051332")).toBe("IBAN [filtrado]");
    expect(limpiarTexto(`Authorization: Bearer ${JWT}`)).not.toContain("eyJ");
    expect(limpiarTexto(`token caducado ${JWT}`)).toBe("token caducado [filtrado]");
    expect(limpiarTexto("refresh_token=abc123 caducado")).toBe("refresh_token=[filtrado] caducado");
  });

  it("quita los parámetros y el fragmento de las URL", () => {
    expect(limpiarTexto("GET https://x.supabase.co/rest/v1/empleados?email=eq.ana%40empresa.es&select=*")).toBe(
      "GET https://x.supabase.co/rest/v1/empleados"
    );
    expect(limpiarTexto("https://web.es/Integra/reset-password#access_token=abc&type=recovery")).toBe(
      "https://web.es/Integra/reset-password"
    );
  });

  it("deja fuera el usuario, las cabeceras y el cuerpo de la petición, y limpia todo el evento", () => {
    const evento = {
      message: "Fallo al guardar el IBAN ES9121000418450200051332",
      user: { id: "0b6c3f4e-1d2a-4b5c-9d8e-7f6a5b4c3d2e", email: "ana@empresa.es", ip_address: "1.2.3.4" },
      request: {
        url: "https://web.es/Integra/perfil?pestana=pagos",
        headers: { Authorization: `Bearer ${JWT}` },
        data: { email: "ana@empresa.es" },
        query_string: "pestana=pagos",
        cookies: { sesion: "x" },
      },
      exception: { values: [{ type: "Error", value: `Usuario ana@empresa.es con token ${JWT}` }] },
      breadcrumbs: [{ category: "fetch", data: { url: "https://x.supabase.co/rest/v1/empleados?email=eq.ana@empresa.es" } }],
      extra: { "ana@empresa.es": "como clave" },
    } as unknown as ErrorEvent;

    const limpio = limpiarEvento(evento);
    const texto = JSON.stringify(limpio);

    expect(limpio.user).toBeUndefined();
    expect(limpio.request).toEqual({ url: "https://web.es/Integra/perfil" });
    expect(limpio.message).toBe("Fallo al guardar el IBAN [filtrado]");
    expect(limpio.exception?.values?.[0].value).toBe("Usuario [filtrado] con token [filtrado]");
    expect(texto).not.toMatch(/ana@empresa\.es|ES91|eyJ|1\.2\.3\.4|pestana/);
  });
});
