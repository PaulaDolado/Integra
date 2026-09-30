import { describe, expect, it, vi } from "vitest";
import { aplicarTema, guardarTema, temaInicial } from "./tema";

const sistemaOscuro = (oscuro: boolean) =>
  vi.mocked(window.matchMedia).mockReturnValue({ matches: oscuro } as MediaQueryList);

describe("tema", () => {
  it("sin preferencia guardada sigue la del sistema", () => {
    sistemaOscuro(true);
    expect(temaInicial()).toBe("oscuro");
    sistemaOscuro(false);
    expect(temaInicial()).toBe("claro");
  });

  it("la preferencia guardada manda sobre la del sistema", () => {
    sistemaOscuro(true);
    guardarTema("claro");
    expect(temaInicial()).toBe("claro");
  });

  it("ignora valores guardados no válidos", () => {
    sistemaOscuro(false);
    localStorage.setItem("integra:tema", "morado");
    expect(temaInicial()).toBe("claro");
  });

  it("aplica y quita la clase dark", () => {
    aplicarTema("oscuro");
    expect(document.documentElement).toHaveClass("dark");
    aplicarTema("claro");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("sigue funcionando si el navegador bloquea el almacenamiento", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    sistemaOscuro(false);
    expect(() => guardarTema("oscuro")).not.toThrow();
    expect(document.documentElement).toHaveClass("dark");
    expect(temaInicial()).toBe("claro");
  });
});
