// Calendario en formato iCalendar (RFC 5545) para suscribirse desde Google
// Calendar, Outlook o Apple Calendar. Sin dependencias de Deno: se prueba con Vitest.

export interface EventoIcs {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
  es_privado: boolean;
  updated_at: string;
}

// 20261007T080000Z: las horas van siempre en UTC y cada calendario las muestra
// en la zona horaria de quien lo mira
export const fechaIcs = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// En los textos, la barra invertida, el punto y coma y la coma se escapan, y los
// saltos de línea se escriben como \n
export const escaparTexto = (texto: string) =>
  texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

const codificador = new TextEncoder();

// Ninguna línea puede pasar de 75 bytes: las largas se parten y la continuación
// empieza por un espacio. Se parte entre caracteres, nunca en medio de uno UTF-8.
export function plegarLinea(linea: string): string {
  const partes: string[] = [];
  let actual = "";
  let bytes = 0;
  for (const caracter of linea) {
    const tamano = codificador.encode(caracter).length;
    const limite = partes.length === 0 ? 75 : 74; // la continuación ya lleva el espacio
    if (bytes + tamano > limite) {
      partes.push(actual);
      actual = "";
      bytes = 0;
    }
    actual += caracter;
    bytes += tamano;
  }
  partes.push(actual);
  return partes.join("\r\n ");
}

export function calendarioIcs(eventos: EventoIcs[], opciones: { ahora?: Date; urlApp?: string } = {}): string {
  const ahora = fechaIcs((opciones.ahora ?? new Date()).toISOString());
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Integra//Calendario//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Integra",
    "X-WR-CALDESC:Eventos del calendario de Integra",
    "X-WR-TIMEZONE:Europe/Madrid",
    // Cada cuánto conviene volver a pedirlo (Google decide por su cuenta)
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const e of eventos) {
    lineas.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@integra`,
      `DTSTAMP:${ahora}`,
      `LAST-MODIFIED:${fechaIcs(e.updated_at)}`,
      `DTSTART:${fechaIcs(e.fecha_inicio)}`,
      `DTEND:${fechaIcs(e.fecha_fin)}`,
      `SUMMARY:${escaparTexto(e.titulo)}`,
    );
    if (e.descripcion?.trim()) lineas.push(`DESCRIPTION:${escaparTexto(e.descripcion.trim())}`);
    if (e.ubicacion?.trim()) lineas.push(`LOCATION:${escaparTexto(e.ubicacion.trim())}`);
    lineas.push(`CLASS:${e.es_privado ? "PRIVATE" : "PUBLIC"}`);
    if (opciones.urlApp) lineas.push(`URL:${new URL("calendario", opciones.urlApp).toString()}`);
    lineas.push("END:VEVENT");
  }

  lineas.push("END:VCALENDAR");
  return lineas.map(plegarLinea).join("\r\n") + "\r\n";
}

// Los tokens son 64 caracteres hexadecimales; cualquier otra cosa ni se busca
export const tokenValido = (token: string | null): token is string => !!token && /^[0-9a-f]{64}$/.test(token);
