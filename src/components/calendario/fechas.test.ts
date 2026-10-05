import { describe, expect, it } from "vitest";
import {
  HOUR_HEIGHT,
  MIN_EVENT_HEIGHT,
  datosDelFormulario,
  desplazarFecha,
  diasConEventos,
  duracion,
  etiquetaCrearEvento,
  fechasValidas,
  getDaysToDisplay,
  getViewRange,
  huecosLibres,
  layoutDayEvents,
  solapa,
  type Event,
} from "./fechas";

// Miércoles 7 de octubre de 2026 (hora local)
const DIA = new Date(2026, 9, 7);
const hora = (h: number, m = 0, dia = 7) => new Date(2026, 9, dia, h, m).toISOString();

let n = 0;
const evento = (fecha_inicio: string, fecha_fin: string): Event => ({
  id: `ev${++n}`,
  titulo: "Evento",
  descripcion: null,
  fecha_inicio,
  fecha_fin,
  ubicacion: null,
  es_privado: false,
  creador_id: "emp1",
});

describe("getViewRange", () => {
  it("día: de 00:00 a 23:59:59.999", () => {
    const r = getViewRange("daily", new Date(2026, 9, 7, 15, 30));
    expect(r.start).toEqual(new Date(2026, 9, 7));
    expect(r.end).toEqual(new Date(2026, 9, 7, 23, 59, 59, 999));
  });

  it("semana: de lunes a domingo", () => {
    const r = getViewRange("weekly", DIA);
    expect(r.start).toEqual(new Date(2026, 9, 5));
    expect(r.end).toEqual(new Date(2026, 9, 11, 23, 59, 59, 999));
  });

  it("mes: semanas completas que cubren el mes", () => {
    const r = getViewRange("monthly", DIA);
    expect(r.start).toEqual(new Date(2026, 8, 28)); // lunes antes del 1 de octubre
    expect(r.end).toEqual(new Date(2026, 10, 1, 23, 59, 59, 999)); // domingo después del 31
    expect(getDaysToDisplay("monthly", DIA)).toHaveLength(35);
  });

  it("año: del 1 de enero al 31 de diciembre", () => {
    const r = getViewRange("yearly", DIA);
    expect(r.start).toEqual(new Date(2026, 0, 1));
    expect(r.end).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
  });
});

describe("desplazarFecha", () => {
  it("avanza y retrocede según la vista", () => {
    expect(desplazarFecha("daily", DIA, -1)).toEqual(new Date(2026, 9, 6));
    expect(desplazarFecha("weekly", DIA, 1)).toEqual(new Date(2026, 9, 14));
    expect(desplazarFecha("monthly", DIA, -1)).toEqual(new Date(2026, 8, 7));
    expect(desplazarFecha("yearly", DIA, 1)).toEqual(new Date(2027, 9, 7));
  });
});

describe("solapa", () => {
  const inicioDia8 = new Date(2026, 9, 8);
  const finDia8 = new Date(2026, 9, 8, 23, 59, 59, 999);

  it("un evento que acaba justo a medianoche no ocupa el día siguiente", () => {
    expect(solapa(evento(hora(22), hora(0, 0, 8)), inicioDia8, finDia8)).toBe(false);
  });

  it("un evento que pasa de medianoche sí ocupa el día siguiente", () => {
    expect(solapa(evento(hora(22), hora(0, 30, 8)), inicioDia8, finDia8)).toBe(true);
  });

  it("un evento de duración cero a las 00:00 cuenta en ese día", () => {
    expect(solapa(evento(hora(0, 0, 8), hora(0, 0, 8)), inicioDia8, finDia8)).toBe(true);
  });
});

describe("layoutDayEvents", () => {
  it("coloca un evento según su hora y duración", () => {
    const [p] = layoutDayEvents([evento(hora(9), hora(10, 30))], DIA);
    expect(p).toMatchObject({ top: 9 * HOUR_HEIGHT, height: 1.5 * HOUR_HEIGHT, lane: 0, lanes: 1 });
  });

  it("los eventos muy cortos tienen una altura mínima", () => {
    const [p] = layoutDayEvents([evento(hora(9), hora(9, 5))], DIA);
    expect(p.height).toBe(MIN_EVENT_HEIGHT);
  });

  it("reparte en carriles los que se solapan y reutiliza el carril libre", () => {
    const a = evento(hora(9), hora(11));
    const b = evento(hora(10), hora(12));
    const c = evento(hora(11), hora(12)); // empieza cuando acaba a: va a su carril
    const r = layoutDayEvents([c, b, a], DIA);
    const de = (e: Event) => r.find((p) => p.event === e)!;
    expect(de(a)).toMatchObject({ lane: 0, lanes: 2 });
    expect(de(b)).toMatchObject({ lane: 1, lanes: 2 });
    expect(de(c)).toMatchObject({ lane: 0, lanes: 2 });
  });

  it("los eventos que no se tocan ocupan todo el ancho", () => {
    const r = layoutDayEvents([evento(hora(9), hora(10)), evento(hora(10), hora(11))], DIA);
    expect(r.map((p) => [p.lane, p.lanes])).toEqual([[0, 1], [0, 1]]);
  });

  it("recorta al día los eventos que empiezan antes o acaban después", () => {
    const [p] = layoutDayEvents([evento(hora(20, 0, 6), hora(2, 0, 8))], DIA);
    expect(p.top).toBe(0);
    expect(p.height).toBeCloseTo(24 * HOUR_HEIGHT, 3);
  });
});

describe("diasConEventos", () => {
  it("marca todos los días que ocupa, sin el de un fin a medianoche", () => {
    const dias = diasConEventos([evento(hora(22, 0, 5), hora(0, 0, 7))]);
    expect([...dias]).toEqual(["2026-10-05", "2026-10-06"]);
  });
});

describe("etiquetaCrearEvento", () => {
  it("nombra el hueco con el día y la hora, en español", () => {
    expect(etiquetaCrearEvento(new Date(2026, 9, 8, 15))).toBe("Crear evento el jueves 8 de octubre a las 15:00");
    expect(etiquetaCrearEvento(new Date(2026, 9, 8), false)).toBe("Crear evento el jueves 8 de octubre");
  });
});

describe("formulario", () => {
  const form = {
    titulo: "  Reunión  ",
    descripcion: "  ",
    fecha_inicio: "2026-10-07T09:00",
    fecha_fin: "2026-10-07T10:00",
    ubicacion: "",
    es_privado: true,
  };

  it("guarda vacíos como null y recorta el título", () => {
    const { inicio, fin } = fechasValidas(form)!;
    expect(datosDelFormulario(form, inicio, fin)).toEqual({
      titulo: "Reunión",
      descripcion: null,
      ubicacion: null,
      es_privado: true,
      fecha_inicio: hora(9),
      fecha_fin: hora(10),
    });
  });

  it("no da por válido un fin igual o anterior al inicio, ni un título vacío", () => {
    expect(fechasValidas({ ...form, fecha_fin: form.fecha_inicio })).toBeNull();
    expect(fechasValidas({ ...form, titulo: "" })).toBeNull();
  });
});

describe("huecosLibres", () => {
  // Antes de que empiece la jornada, para ver el día entero
  const MADRUGADA = new Date(2026, 9, 7, 6, 0);
  const tramos = (huecos: { inicio: Date; fin: Date }[]) =>
    huecos.map((h) => `${h.inicio.getHours()}:${String(h.inicio.getMinutes()).padStart(2, "0")}-${h.fin.getHours()}:${String(h.fin.getMinutes()).padStart(2, "0")}`);

  it("sin eventos, toda la jornada está libre", () => {
    expect(tramos(huecosLibres([], DIA, "emp1", MADRUGADA))).toEqual(["8:00-18:00"]);
  });

  it("los eventos propios parten la jornada y los solapados se juntan", () => {
    const eventos = [
      evento(hora(9), hora(10)),
      evento(hora(9, 30), hora(11)),
      evento(hora(13), hora(14, 30)),
    ];
    expect(tramos(huecosLibres(eventos, DIA, "emp1", MADRUGADA))).toEqual(["8:00-9:00", "11:00-13:00", "14:30-18:00"]);
  });

  it("descarta los huecos de menos de 30 minutos", () => {
    const eventos = [evento(hora(8), hora(12)), evento(hora(12, 20), hora(18))];
    expect(huecosLibres(eventos, DIA, "emp1", MADRUGADA)).toEqual([]);
  });

  it("los públicos de otros no ocupan mi tiempo; los privados (en los que participo) sí", () => {
    const publicoAjeno = { ...evento(hora(9), hora(12)), creador_id: "otra" };
    const privadoAjeno = { ...evento(hora(15), hora(16)), creador_id: "otra", es_privado: true };
    expect(tramos(huecosLibres([publicoAjeno, privadoAjeno], DIA, "emp1", MADRUGADA))).toEqual(["8:00-15:00", "16:00-18:00"]);
  });

  it("hoy empieza en el cuarto de hora siguiente a ahora; los días pasados no tienen huecos", () => {
    const ahora = new Date(2026, 9, 7, 10, 5);
    expect(tramos(huecosLibres([], DIA, "emp1", ahora))).toEqual(["10:15-18:00"]);
    expect(huecosLibres([], new Date(2026, 9, 6), "emp1", ahora)).toEqual([]);
  });

  it("los fines de semana no hay jornada", () => {
    expect(huecosLibres([], new Date(2026, 9, 10), "emp1", MADRUGADA)).toEqual([]);
  });

  it("un evento que empieza antes de la jornada y la cubre entera no deja huecos", () => {
    const eventos = [evento(hora(7), hora(19))];
    expect(huecosLibres(eventos, DIA, "emp1", MADRUGADA)).toEqual([]);
  });
});

describe("duracion", () => {
  it("escribe horas y minutos", () => {
    expect(duracion(45)).toBe("45 min");
    expect(duracion(180)).toBe("3 h");
    expect(duracion(150)).toBe("2 h 30 min");
  });
});
