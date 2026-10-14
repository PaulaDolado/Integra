import { describe, expect, it } from "vitest";
import { esEnlaceValido, faseCurso, formatFechas, formatHoras, puedeCancelar, puedeSolicitar, validarCurso } from "./cursos";

const curso = { fecha_inicio: "2026-11-10", fecha_fin: "2026-11-12", plazo_inscripcion: "2026-11-01", cancelado: false };

describe("faseCurso", () => {
  it("sigue el calendario del curso", () => {
    expect(faseCurso(curso, "2026-10-20")).toBe("abierto");
    // El último día del plazo todavía se puede pedir plaza
    expect(faseCurso(curso, "2026-11-01")).toBe("abierto");
    expect(faseCurso(curso, "2026-11-02")).toBe("plazo_cerrado");
    expect(faseCurso(curso, "2026-11-10")).toBe("en_curso");
    expect(faseCurso(curso, "2026-11-12")).toBe("en_curso");
    expect(faseCurso(curso, "2026-11-13")).toBe("terminado");
  });

  it("sin plazo, se puede pedir plaza hasta el día antes de empezar", () => {
    const sinPlazo = { ...curso, plazo_inscripcion: null };
    expect(faseCurso(sinPlazo, "2026-11-09")).toBe("abierto");
    expect(faseCurso(sinPlazo, "2026-11-10")).toBe("en_curso");
  });

  it("un curso cancelado lo está siempre", () => {
    expect(faseCurso({ ...curso, cancelado: true }, "2026-10-20")).toBe("cancelado");
  });
});

describe("qué puede hacer el empleado", () => {
  it("pide plaza en un curso abierto si no tiene una solicitud activa", () => {
    expect(puedeSolicitar("abierto", null)).toBe(true);
    expect(puedeSolicitar("abierto", "cancelada")).toBe(true);
    expect(puedeSolicitar("abierto", "pendiente")).toBe(false);
    expect(puedeSolicitar("abierto", "rechazada")).toBe(false);
    expect(puedeSolicitar("plazo_cerrado", null)).toBe(false);
  });

  it("cancela su solicitud hasta que empieza el curso", () => {
    expect(puedeCancelar("abierto", "pendiente")).toBe(true);
    expect(puedeCancelar("plazo_cerrado", "aprobada")).toBe(true);
    expect(puedeCancelar("en_curso", "aprobada")).toBe(false);
    expect(puedeCancelar("abierto", "rechazada")).toBe(false);
  });
});

describe("formato", () => {
  it("fechas de un día o de varios", () => {
    expect(formatFechas("2026-11-10", "2026-11-10")).toBe("10 nov 2026");
    expect(formatFechas("2026-11-10", "2026-11-12")).toBe("10 nov 2026 – 12 nov 2026");
  });

  it("horas con decimales en español", () => {
    expect(formatHoras(7.5)).toBe("7,5 h");
    expect(formatHoras(null)).toBeNull();
  });

  it("solo admite enlaces web", () => {
    expect(esEnlaceValido("https://teams.microsoft.com/l/meetup")).toBe(true);
    expect(esEnlaceValido("javascript:alert(1)")).toBe(false);
  });
});

describe("validarCurso", () => {
  const form = {
    titulo: "Excel avanzado",
    descripcion: "",
    modalidad: "online" as const,
    lugar: "",
    enlace: "https://teams.microsoft.com/l/meetup",
    fecha_inicio: "2026-11-10",
    fecha_fin: "2026-11-12",
    horas: "7,5",
    certificado: true,
    plazo_inscripcion: "2026-11-01",
  };

  it("acepta un curso bien rellenado, con horas con coma decimal", () => {
    expect(validarCurso(form)).toBeNull();
  });

  it("avisa de cada problema antes de enviarlo", () => {
    expect(validarCurso({ ...form, titulo: "  " })).toBe("El título es obligatorio");
    expect(validarCurso({ ...form, fecha_fin: "2026-11-09" })).toMatch(/anterior a la de inicio/);
    expect(validarCurso({ ...form, plazo_inscripcion: "2026-11-10" })).toMatch(/antes de que empiece/);
    expect(validarCurso({ ...form, horas: "0" })).toMatch(/mayor que 0/);
    expect(validarCurso({ ...form, horas: "muchas" })).toMatch(/mayor que 0/);
    expect(validarCurso({ ...form, enlace: "teams" })).toMatch(/https/);
  });

  it("el enlace no importa si el curso es presencial", () => {
    expect(validarCurso({ ...form, modalidad: "presencial", enlace: "teams" })).toBeNull();
  });
});
