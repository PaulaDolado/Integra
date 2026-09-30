export type AreaComunicado = "rrhh" | "marketing";

export const AREAS: Record<
  AreaComunicado,
  { label: string; nota: string; chincheta: string; etiqueta: string }
> = {
  rrhh: {
    label: "RRHH",
    // Nota adhesiva amarilla
    nota: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-50",
    chincheta: "text-amber-600 dark:text-amber-400",
    etiqueta: "bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100",
  },
  marketing: {
    label: "Marketing",
    // Nota adhesiva rosa
    nota: "bg-rose-100 text-rose-950 dark:bg-rose-900/40 dark:text-rose-50",
    chincheta: "text-rose-600 dark:text-rose-400",
    etiqueta: "bg-rose-200/80 text-rose-900 dark:bg-rose-800/60 dark:text-rose-100",
  },
};

export const getArea = (area: string | null | undefined) =>
  AREAS[(area as AreaComunicado) in AREAS ? (area as AreaComunicado) : "rrhh"];
