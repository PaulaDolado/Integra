import { describe, expect, it } from "vitest";
import { calcularFin, duracionDe, esEnlaceValido } from "./vigencia";

describe("calcularFin", () => {
  it("suma los meses a la fecha de publicación, a la misma hora local", () => {
    const publicacion = new Date("2026-10-20T09:00").toISOString();
    expect(calcularFin(publicacion, "2")).toBe(new Date("2026-12-20T09:00").toISOString());
  });

  it("una nota fija no tiene fin", () => {
    expect(calcularFin("2026-10-20T07:00:00.000Z", "fijo")).toBeNull();
  });
});

describe("duracionDe", () => {
  it("recupera la duración elegida", () => {
    const publicacion = "2026-10-20T07:00:00.000Z";
    for (const d of ["1", "2", "3"] as const) {
      expect(duracionDe(publicacion, calcularFin(publicacion, d))).toBe(d);
    }
    expect(duracionDe(publicacion, null)).toBe("fijo");
  });

  it("los comunicados antiguos, que acaban a final de mes, cuentan como un mes", () => {
    expect(duracionDe("2026-09-28T07:00:00.000Z", "2026-09-30T22:00:00.000Z")).toBe("1");
  });
});

describe("esEnlaceValido", () => {
  it("acepta enlaces web", () => {
    expect(esEnlaceValido("https://forms.office.com/r/abc")).toBe(true);
    expect(esEnlaceValido("http://intranet/prestamo")).toBe(true);
  });

  it("rechaza textos y otros protocolos", () => {
    expect(esEnlaceValido("forms.office.com/r/abc")).toBe(false);
    expect(esEnlaceValido("javascript:alert(1)")).toBe(false);
    expect(esEnlaceValido("")).toBe(false);
  });
});
