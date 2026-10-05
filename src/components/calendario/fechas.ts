import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears, startOfDay, endOfDay, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";

export interface Event {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
  es_privado: boolean;
  creador_id: string;
}

export interface EventFormData {
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string;
  es_privado: boolean;
}

export interface PositionedEvent {
  event: Event;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

export type ViewType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const HOUR_HEIGHT = 48; // px por hora en las vistas de día y semana
export const MIN_EVENT_HEIGHT = 22;
export const SCROLL_TO_HOUR = 7; // la rejilla horaria se abre centrada en la jornada laboral
export const MONTH_EVENTS_VISIBLE = 3;

export const EMPTY_FORM: EventFormData = {
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  ubicacion: '',
  es_privado: false
};

export const hours = Array.from({ length: 24 }, (_, i) => i);
export const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const toInputValue = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Para los nombres accesibles de la rejilla: "jueves 8 de octubre"
export const nombreDelDia = (fecha: Date) => format(fecha, "EEEE d 'de' MMMM", { locale: es });

// "Crear evento el jueves 8 de octubre a las 15:00" (sin hora en la vista de mes)
export const etiquetaCrearEvento = (fecha: Date, conHora = true) =>
  `Crear evento el ${nombreDelDia(fecha)}${conHora ? ` a las ${format(fecha, "HH:mm")}` : ""}`;

export const getViewRange = (viewType: ViewType, currentDate: Date) => {
  switch (viewType) {
    case 'daily':
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case 'weekly':
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    case 'monthly':
      return {
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
      };
    case 'yearly':
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
  }
};

// Fecha a la que llevan los botones de anterior (-1) y siguiente (1) en cada vista
export const desplazarFecha = (viewType: ViewType, currentDate: Date, sentido: 1 | -1) => {
  switch (viewType) {
    case 'daily':
      return addDays(currentDate, sentido);
    case 'weekly':
      return sentido === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
    case 'monthly':
      return sentido === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    case 'yearly':
      return sentido === 1 ? addYears(currentDate, 1) : subYears(currentDate, 1);
  }
};

export const getViewTitle = (viewType: ViewType, currentDate: Date) => {
  switch (viewType) {
    case 'daily':
      return capitalize(format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es }));
    case 'weekly': {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
    }
    case 'monthly':
      return capitalize(format(currentDate, 'MMMM yyyy', { locale: es }));
    case 'yearly':
      return format(currentDate, 'yyyy');
  }
};

// Días de la vista (o los 12 meses, en la anual)
export const getDaysToDisplay = (viewType: ViewType, currentDate: Date) => {
  switch (viewType) {
    case 'daily':
      return [currentDate];
    case 'weekly': {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    case 'monthly': {
      const { start, end } = getViewRange(viewType, currentDate);
      const monthDays = [];
      let day = start;
      while (day <= end) {
        monthDays.push(day);
        day = addDays(day, 1);
      }
      return monthDays;
    }
    case 'yearly':
      return Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(currentDate), i));
  }
};

// Los campos opcionales vacíos se guardan como null, no como texto vacío
export const datosDelFormulario = (form: EventFormData, inicio: Date, fin: Date) => ({
  titulo: form.titulo.trim(),
  descripcion: form.descripcion.trim() || null,
  ubicacion: form.ubicacion.trim() || null,
  es_privado: form.es_privado,
  fecha_inicio: inicio.toISOString(),
  fecha_fin: fin.toISOString(),
});

// Fechas del formulario si es válido: con título y con el fin posterior al inicio
export const fechasValidas = (form: EventFormData) => {
  const inicio = new Date(form.fecha_inicio);
  const fin = new Date(form.fecha_fin);
  if (!(form.titulo && form.fecha_inicio && form.fecha_fin) || isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio >= fin) {
    return null;
  }
  return { inicio, fin };
};

// ¿El evento ocupa parte del intervalo [desde, hasta]? El fin es exclusivo: un
// evento que acaba a las 00:00 no aparece en el día siguiente
export const solapa = (event: Event, desde: Date, hasta: Date) => {
  const inicio = new Date(event.fecha_inicio);
  const fin = new Date(event.fecha_fin);
  return inicio <= hasta && (fin > desde || inicio >= desde);
};

export const eventosDelDia = (events: Event[], date: Date) => {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  return events.filter(event => solapa(event, dayStart, dayEnd));
};

// Días (yyyy-MM-dd) en los que hay algún evento, para marcarlos en la vista de año
export const diasConEventos = (events: Event[]) => {
  const eventDays = new Set<string>();
  events.forEach(event => {
    const start = new Date(event.fecha_inicio);
    const end = new Date(event.fecha_fin);
    eventDays.add(format(start, 'yyyy-MM-dd'));
    for (let day = addDays(startOfDay(start), 1); day < end; day = addDays(day, 1)) {
      eventDays.add(format(day, 'yyyy-MM-dd'));
    }
  });
  return eventDays;
};

// Coloca los eventos de un día en la rejilla horaria. Los que se solapan
// se reparten en carriles para que no queden uno encima de otro.
export const layoutDayEvents = (dayEvents: Event[], day: Date): PositionedEvent[] => {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();

  const segments = dayEvents
    .map(event => ({
      event,
      start: Math.max(new Date(event.fecha_inicio).getTime(), dayStart),
      end: Math.min(new Date(event.fecha_fin).getTime(), dayEnd),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedEvent[] = [];
  let cluster: (PositionedEvent & { end: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    cluster.forEach(item => {
      const { end: _end, ...positioned } = item;
      result.push({ ...positioned, lanes: laneEnds.length });
    });
    cluster = [];
    laneEnds = [];
  };

  segments.forEach(({ event, start, end }) => {
    if (start >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = cluster.length === 0 ? end : Math.max(clusterEnd, end);

    const top = ((start - dayStart) / 3_600_000) * HOUR_HEIGHT;
    const height = Math.max(((end - start) / 3_600_000) * HOUR_HEIGHT, MIN_EVENT_HEIGHT);
    cluster.push({ event, top, height, lane, lanes: 1, end });
  });
  closeCluster();

  return result;
};
