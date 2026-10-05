import { describe, expect, it } from "vitest";
import { AREAS, NOTA_FORMULARIO, estiloNota } from "./areas";

describe("estiloNota", () => {
  it("los comunicados llevan los colores de su área", () => {
    expect(estiloNota("rrhh", "comunicado")).toEqual(AREAS.rrhh);
    expect(estiloNota("marketing", "comunicado")).toEqual(AREAS.marketing);
  });

  it("los formularios van en una nota morada, pero conservan la etiqueta de su área", () => {
    const estilo = estiloNota("marketing", "formulario");
    expect(estilo.nota).toBe(NOTA_FORMULARIO.nota);
    expect(estilo.chincheta).toBe(NOTA_FORMULARIO.chincheta);
    expect(estilo.label).toBe("Marketing");
    expect(estilo.etiqueta).toBe(AREAS.marketing.etiqueta);
  });

  it("sin área conocida usa la de RRHH", () => {
    expect(estiloNota(null, "formulario").label).toBe("RRHH");
  });
});
