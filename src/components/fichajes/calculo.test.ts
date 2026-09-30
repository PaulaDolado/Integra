import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { descargarCsv, esCorregido, formatHoras, resumirFichajes, type Fichaje } from "./calculo";

let n = 0;
const fichaje = (tipo: "entrada" | "salida", fechaHora: string, extra: Partial<Fichaje> = {}): Fichaje => ({
  id: `f${++n}`,
  empleado_id: "e1",
  tipo,
  fecha_hora: new Date(fechaHora).toISOString(),
  ...extra,
});

describe("resumirFichajes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T18:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("empareja entrada y salida del mismo día", () => {
    const r = resumirFichajes([fichaje("entrada", "2026-09-28T09:00:00"), fichaje("salida", "2026-09-28T14:30:00")]);
    expect(r.minutos).toBe(330);
    expect(r.diasTrabajados).toBe(1);
    expect(r.incidencias).toBe(0);
    expect(r.dias[0]).toMatchObject({ fecha: "2026-09-28", minutos: 330 });
  });

  it("suma varios tramos en un día y ordena los días del más reciente al más antiguo", () => {
    const r = resumirFichajes([
      fichaje("salida", "2026-09-28T18:00:00"),
      fichaje("entrada", "2026-09-28T15:00:00"),
      fichaje("entrada", "2026-09-28T09:00:00"),
      fichaje("salida", "2026-09-28T13:00:00"),
      fichaje("entrada", "2026-09-29T09:00:00"),
      fichaje("salida", "2026-09-29T10:00:00"),
    ]);
    expect(r.dias.map((d) => d.fecha)).toEqual(["2026-09-29", "2026-09-28"]);
    expect(r.dias[1].tramos).toHaveLength(2);
    expect(r.dias[1].minutos).toBe(7 * 60);
    expect(r.minutos).toBe(8 * 60);
  });

  it("cuenta como incidencia una entrada de otro día sin salida", () => {
    const r = resumirFichajes([fichaje("entrada", "2026-09-28T09:00:00")]);
    expect(r.incidencias).toBe(1);
    expect(r.trabajandoDesde).toBeNull();
    expect(r.dias[0].tramos[0]).toMatchObject({ salida: null, minutos: null, enCurso: false });
  });

  it("no cuenta como incidencia la entrada de hoy que sigue abierta", () => {
    const r = resumirFichajes([fichaje("entrada", "2026-09-30T09:00:00")]);
    expect(r.incidencias).toBe(0);
    expect(r.trabajandoDesde).toEqual(new Date("2026-09-30T09:00:00"));
    expect(r.dias[0].tramos[0].enCurso).toBe(true);
  });

  it("cuenta como incidencia una salida sin entrada", () => {
    const r = resumirFichajes([fichaje("salida", "2026-09-28T14:00:00")]);
    expect(r.incidencias).toBe(1);
    expect(r.diasTrabajados).toBe(0);
  });

  it("no empareja una entrada con la salida de otro día", () => {
    const r = resumirFichajes([fichaje("entrada", "2026-09-28T22:00:00"), fichaje("salida", "2026-09-29T06:00:00")]);
    expect(r.minutos).toBe(0);
    expect(r.incidencias).toBe(2);
  });

  it("ignora los fichajes anulados", () => {
    const r = resumirFichajes([
      fichaje("entrada", "2026-09-28T09:00:00"),
      fichaje("salida", "2026-09-28T11:00:00", { anulado: true }),
      fichaje("salida", "2026-09-28T14:00:00"),
    ]);
    expect(r.minutos).toBe(300);
    expect(r.ultimoFichaje).toEqual(new Date("2026-09-28T14:00:00"));
  });

  it("recoge los motivos de las correcciones del tramo", () => {
    const r = resumirFichajes([
      fichaje("entrada", "2026-09-28T09:00:00", { es_manual: true, justificacion: "Olvidó fichar" }),
      fichaje("salida", "2026-09-28T14:00:00", { fecha_hora_original: "2026-09-28T16:00:00Z" }),
    ]);
    expect(r.dias[0].tramos[0].correcciones).toEqual(["Olvidó fichar", "Corregido"]);
  });

  it("devuelve un resumen vacío sin fichajes", () => {
    expect(resumirFichajes([])).toMatchObject({ dias: [], minutos: 0, incidencias: 0, ultimoFichaje: null });
  });
});

describe("esCorregido", () => {
  it("detecta fichajes manuales o con la hora modificada", () => {
    expect(esCorregido(fichaje("entrada", "2026-09-28T09:00:00"))).toBe(false);
    expect(esCorregido(fichaje("entrada", "2026-09-28T09:00:00", { es_manual: true }))).toBe(true);
    expect(esCorregido(fichaje("entrada", "2026-09-28T09:00:00", { fecha_hora_original: "2026-09-28T08:00:00Z" }))).toBe(true);
  });
});

describe("formatHoras", () => {
  it("formatea minutos como horas y minutos", () => {
    expect(formatHoras(0)).toBe("0 h 00 min");
    expect(formatHoras(65)).toBe("1 h 05 min");
    expect(formatHoras(480)).toBe("8 h 00 min");
  });
});

describe("descargarCsv", () => {
  it("genera un CSV para Excel con BOM, ';' y comillas escapadas", async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    descargarCsv("informe.csv", [
      ["Nombre", "Horas"],
      ['Ana "la jefa"', 8],
      ["Pérez; López", 7.5],
    ]);

    expect(click).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:csv");
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const texto = new TextDecoder().decode(bytes.slice(3));
    expect(texto).toBe('Nombre;Horas\r\n"Ana ""la jefa""";8\r\n"Pérez; López";7.5');
  });
});
