// Estados de una solicitud de cambio de turno y sus colores
export const ESTADOS_TURNO: Record<string, { label: string; clases: string }> = {
  pendiente_companero: {
    label: "Esperando al compañero",
    clases: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900",
  },
  pendiente: {
    label: "Pendiente de aprobación",
    clases: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  },
  aprobada: {
    label: "Aprobada",
    clases: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900",
  },
  rechazada: {
    label: "Rechazada",
    clases: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  },
  cancelada: { label: "Cancelada", clases: "bg-muted text-muted-foreground border-border" },
};
