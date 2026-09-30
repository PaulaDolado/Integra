import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { MAX_BYTES, MAX_IMAGENES, validarImagenes } from "./adjuntos";

const archivo = (nombre: string, tipo: string, bytes = 1024) => {
  const f = new File(["x"], nombre, { type: tipo });
  Object.defineProperty(f, "size", { value: bytes });
  return f;
};

describe("validarImagenes", () => {
  it("acepta PNG, JPG, WEBP y GIF", () => {
    const nuevas = ["a.png:image/png", "b.jpg:image/jpeg", "c.webp:image/webp", "d.gif:image/gif"].map((s) => {
      const [n, t] = s.split(":");
      return archivo(n, t);
    });
    const { validas, errores } = validarImagenes(nuevas, []);
    expect(validas).toHaveLength(4);
    expect(errores).toEqual([]);
  });

  it("rechaza otros tipos de archivo, incluido SVG", () => {
    const { validas, errores } = validarImagenes([archivo("x.svg", "image/svg+xml"), archivo("x.pdf", "application/pdf")], []);
    expect(validas).toEqual([]);
    expect(errores).toHaveLength(2);
    expect(errores[0]).toContain("x.svg");
  });

  it("rechaza imágenes de más de 5 MB", () => {
    const { validas, errores } = validarImagenes([archivo("grande.png", "image/png", MAX_BYTES + 1)], []);
    expect(validas).toEqual([]);
    expect(errores[0]).toBe("grande.png: supera los 5 MB");
  });

  it("no deja pasar del máximo contando las que ya había", () => {
    const actuales = Array.from({ length: MAX_IMAGENES - 1 }, (_, i) => archivo(`${i}.png`, "image/png"));
    const { validas, errores } = validarImagenes([archivo("a.png", "image/png"), archivo("b.png", "image/png")], actuales);
    expect(validas.map((f) => f.name)).toEqual(["a.png"]);
    expect(errores).toEqual([`Máximo ${MAX_IMAGENES} imágenes por mensaje`]);
  });
});
