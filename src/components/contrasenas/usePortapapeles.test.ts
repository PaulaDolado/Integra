import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const SECRETO = "c0ntraseña-de-prueba";
const TREINTA_S = 30_000;

// Portapapeles simulado: guarda lo último escrito
let contenido: string;
const writeText = vi.fn(async (texto: string) => {
  contenido = texto;
});
const readText = vi.fn(async () => contenido);
let permisoLectura: PermissionState;

// El borrado pendiente vive en el módulo: cada test usa uno nuevo
async function copiarCon() {
  vi.resetModules();
  const { usePortapapeles } = await import("./usePortapapeles");
  return renderHook(() => usePortapapeles()).result.current;
}

// Deja que terminen las promesas del borrado (permiso, lectura y escritura)
const terminar = () => vi.advanceTimersByTimeAsync(0);

describe("usePortapapeles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toast.mockReset();
    writeText.mockClear();
    readText.mockClear();
    contenido = "";
    permisoLectura = "prompt";
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText, readText } });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn(async () => ({ state: permisoLectura })) },
    });
  });

  afterEach(() => vi.useRealTimers());

  it("borra la contraseña a los 30 segundos", async () => {
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");
    expect(contenido).toBe(SECRETO);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Contraseña copiada" }));

    await vi.advanceTimersByTimeAsync(TREINTA_S - 1);
    expect(contenido).toBe(SECRETO);
    await vi.advanceTimersByTimeAsync(1);
    await terminar();
    expect(contenido).toBe("");
  });

  it("no borra el usuario copiado después de la contraseña", async () => {
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");
    await copiar("laura", "usuario");

    await vi.advanceTimersByTimeAsync(TREINTA_S);
    await terminar();
    expect(contenido).toBe("laura");
  });

  it("no borra lo que se copie después dentro de Integra", async () => {
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");

    // El usuario copia un texto cualquiera de la página
    contenido = "texto de la página";
    document.dispatchEvent(new Event("copy"));

    await vi.advanceTimersByTimeAsync(TREINTA_S);
    await terminar();
    expect(contenido).toBe("texto de la página");
  });

  it("con permiso de lectura, no borra lo copiado en otra aplicación", async () => {
    permisoLectura = "granted";
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");
    contenido = "copiado en otra aplicación";

    await vi.advanceTimersByTimeAsync(TREINTA_S);
    await terminar();
    expect(readText).toHaveBeenCalled();
    expect(contenido).toBe("copiado en otra aplicación");
  });

  it("con permiso de lectura, borra si sigue estando la contraseña", async () => {
    permisoLectura = "granted";
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");

    await vi.advanceTimersByTimeAsync(TREINTA_S);
    await terminar();
    expect(contenido).toBe("");
  });

  it("sin permiso no lee el portapapeles (no pide permiso) y borra por seguridad", async () => {
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");

    await vi.advanceTimersByTimeAsync(TREINTA_S);
    await terminar();
    expect(readText).not.toHaveBeenCalled();
    expect(contenido).toBe("");
  });

  it("copiar otra contraseña reinicia la cuenta atrás", async () => {
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");
    await vi.advanceTimersByTimeAsync(20_000);
    await copiar("otra-contraseña", "contrasena");

    await vi.advanceTimersByTimeAsync(20_000);
    expect(contenido).toBe("otra-contraseña");
    await vi.advanceTimersByTimeAsync(10_000);
    await terminar();
    expect(contenido).toBe("");
  });

  it("si no se puede copiar avisa y no programa ningún borrado", async () => {
    writeText.mockRejectedValueOnce(new Error("sin permiso"));
    const copiar = await copiarCon();
    await copiar(SECRETO, "contrasena");

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "No se pudo copiar", variant: "destructive" }));
    await vi.advanceTimersByTimeAsync(TREINTA_S);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
