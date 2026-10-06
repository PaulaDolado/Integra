import { describe, expect, it } from "vitest";
import { calendarioIcs, escaparTexto, fechaIcs, plegarLinea, tokenValido, type EventoIcs } from "./ics.ts";

const evento = (cambios: Partial<EventoIcs> = {}): EventoIcs => ({
  id: "ev1",
  titulo: "Reunión de equipo",
  descripcion: null,
  fecha_inicio: "2026-10-07T07:00:00Z",
  fecha_fin: "2026-10-07T08:30:00Z",
  ubicacion: null,
  es_privado: false,
  updated_at: "2026-10-01T10:00:00Z",
  ...cambios,
});

const AHORA = new Date("2026-10-06T12:00:00Z");

describe("calendario iCalendar", () => {
  it("genera un calendario válido con un evento por cada uno", () => {
    const ics = calendarioIcs([evento(), evento({ id: "ev2", titulo: "Formación" })], { ahora: AHORA });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Todas las líneas acaban en CRLF, nunca en un \n suelto
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("UID:ev1@integra\r\n");
    expect(ics).toContain("DTSTART:20261007T070000Z\r\n");
    expect(ics).toContain("DTEND:20261007T083000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261006T120000Z\r\n");
    expect(ics).toContain("LAST-MODIFIED:20261001T100000Z\r\n");
    expect(ics).toContain("SUMMARY:Formación\r\n");
    expect(ics).toContain("X-WR-CALNAME:Integra\r\n");
  });

  it("sin eventos sigue siendo un calendario válido", () => {
    expect(calendarioIcs([], { ahora: AHORA })).not.toContain("BEGIN:VEVENT");
  });

  it("solo incluye descripción y ubicación si tienen texto, y marca los privados", () => {
    const ics = calendarioIcs(
      [evento({ descripcion: "  ", ubicacion: "Sala Azul", es_privado: true })],
      { ahora: AHORA }
    );
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).toContain("LOCATION:Sala Azul\r\n");
    expect(ics).toContain("CLASS:PRIVATE\r\n");
  });

  it("enlaza a la pantalla del calendario si se conoce la URL de la app", () => {
    const ics = calendarioIcs([evento()], { ahora: AHORA, urlApp: "https://empresa.github.io/Integra/" });
    expect(ics).toContain("URL:https://empresa.github.io/Integra/calendario\r\n");
  });

  it("escapa comas, puntos y comas, barras invertidas y saltos de línea", () => {
    expect(escaparTexto("Hola, equipo; ver C:\\docs\nSegunda línea")).toBe("Hola\\, equipo\\; ver C:\\\\docs\\nSegunda línea");
    const ics = calendarioIcs([evento({ titulo: "Uno, dos; tres" })], { ahora: AHORA });
    expect(ics).toContain("SUMMARY:Uno\\, dos\\; tres\r\n");
  });

  it("parte las líneas de más de 75 bytes sin romper caracteres UTF-8", () => {
    const larga = "DESCRIPTION:" + "áé".repeat(60);
    const plegada = plegarLinea(larga);
    const trozos = plegada.split("\r\n");
    expect(trozos.length).toBeGreaterThan(1);
    for (const trozo of trozos) expect(new TextEncoder().encode(trozo).length).toBeLessThanOrEqual(75);
    expect(trozos.slice(1).every((t) => t.startsWith(" "))).toBe(true);
    // Al desplegar se recupera el texto original
    expect(plegada.replace(/\r\n /g, "")).toBe(larga);
  });

  it("las fechas van en UTC sin separadores", () => {
    expect(fechaIcs("2026-12-31T23:59:59.999+01:00")).toBe("20261231T225959Z");
  });
});

describe("tokenValido", () => {
  it("solo acepta 64 caracteres hexadecimales en minúscula", () => {
    expect(tokenValido("a".repeat(64))).toBe(true);
    expect(tokenValido("0123456789abcdef".repeat(4))).toBe(true);
    expect(tokenValido("A".repeat(64))).toBe(false);
    expect(tokenValido("a".repeat(63))).toBe(false);
    expect(tokenValido("' OR 1=1 --")).toBe(false);
    expect(tokenValido(null)).toBe(false);
  });
});
