import { addMonths, differenceInCalendarDays } from "date-fns";

// Cuánto tiempo sigue una nota en el tablón desde su publicación
export type Duracion = "1" | "2" | "3" | "fijo";

export const DURACIONES: { value: Duracion; label: string }[] = [
  { value: "1", label: "1 mes" },
  { value: "2", label: "2 meses" },
  { value: "3", label: "3 meses" },
  { value: "fijo", label: "Fijo (permanente)" },
];

// null = fijo, no caduca
export const calcularFin = (fechaPublicacion: string, duracion: Duracion): string | null =>
  duracion === "fijo" ? null : addMonths(new Date(fechaPublicacion), Number(duracion)).toISOString();

// Duración más cercana a la guardada (los comunicados antiguos acaban a final de mes)
export const duracionDe = (fechaPublicacion: string, fechaFin: string | null): Duracion => {
  if (!fechaFin) return "fijo";
  const dias = differenceInCalendarDays(new Date(fechaFin), new Date(fechaPublicacion));
  return String(Math.min(3, Math.max(1, Math.round(dias / 30)))) as Duracion;
};

// Solo enlaces web: evita javascript: y similares en el href
export const esEnlaceValido = (enlace: string) => {
  try {
    return ["http:", "https:"].includes(new URL(enlace).protocol);
  } catch {
    return false;
  }
};
