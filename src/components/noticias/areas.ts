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

// Los formularios van en una nota morada, sean del área que sean: así se
// distinguen de un vistazo de los comunicados. La etiqueta sigue siendo la del área.
export const NOTA_FORMULARIO = {
  nota: "bg-violet-100 text-violet-950 dark:bg-violet-900/40 dark:text-violet-50",
  chincheta: "text-violet-600 dark:text-violet-400",
  etiqueta: "bg-violet-200/80 text-violet-900 dark:bg-violet-800/60 dark:text-violet-100",
};

// Colores de la nota en el tablón: los del área, o morados si es un formulario
export const estiloNota = (area: string | null | undefined, tipo: string | null | undefined) => {
  const estilo = getArea(area);
  return tipo === "formulario"
    ? { ...estilo, nota: NOTA_FORMULARIO.nota, chincheta: NOTA_FORMULARIO.chincheta }
    : estilo;
};
