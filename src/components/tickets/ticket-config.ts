import {
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
  Equal,
  HandHelping,
  Lock,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type Seguimiento = Database["public"]["Tables"]["ticket_seguimientos"]["Row"];
export type EstadoTicket = "nuevo" | "en_curso" | "en_espera" | "resuelto" | "cerrado";
export type PrioridadTicket = "primordial" | "alta" | "media" | "baja";
export type TipoTicket = "incidencia" | "peticion";

interface Opcion {
  label: string;
  icon: LucideIcon;
  // Clases del badge: fondo, texto y borde, con variante oscura
  badge: string;
}

export const ESTADOS: Record<EstadoTicket, Opcion> = {
  nuevo: {
    label: "Nuevo",
    icon: CircleDashed,
    badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
  },
  en_curso: {
    label: "En curso (asignada)",
    icon: CirclePlay,
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
  },
  en_espera: {
    label: "En espera",
    icon: CirclePause,
    badge: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900",
  },
  resuelto: {
    label: "Resuelto",
    icon: CircleCheck,
    badge: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900",
  },
  cerrado: {
    label: "Cerrado",
    icon: Lock,
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export const PRIORIDADES: Record<PrioridadTicket, Opcion> = {
  primordial: {
    label: "Primordial",
    icon: AlertOctagon,
    badge: "bg-red-600 text-white border-red-600 dark:bg-red-500 dark:border-red-500",
  },
  alta: {
    label: "Alta",
    icon: ArrowUp,
    badge: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
  },
  media: {
    label: "Media",
    icon: Equal,
    badge: "bg-muted text-foreground border-border",
  },
  baja: {
    label: "Baja",
    icon: ArrowDown,
    badge: "bg-transparent text-muted-foreground border-border",
  },
};

export const TIPOS: Record<TipoTicket, Opcion> = {
  incidencia: {
    label: "Incidencia",
    icon: TriangleAlert,
    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
  },
  peticion: {
    label: "Petición",
    icon: HandHelping,
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
  },
};

export const ORDEN_ESTADOS: EstadoTicket[] = ["nuevo", "en_curso", "en_espera", "resuelto", "cerrado"];
export const ORDEN_PRIORIDADES: PrioridadTicket[] = ["primordial", "alta", "media", "baja"];
export const ORDEN_TIPOS: TipoTicket[] = ["incidencia", "peticion"];

// Peso para ordenar por prioridad (primero lo más urgente)
export const PESO_PRIORIDAD: Record<string, number> = { primordial: 0, alta: 1, media: 2, baja: 3 };

// Número corto y legible del ticket, como el ID de GLPI
export const numeroTicket = (id: string) => `#${id.slice(0, 6).toUpperCase()}`;

export const fechaCorta = (fecha: string) => format(new Date(fecha), "d MMM yyyy, HH:mm", { locale: es });

export const getEstado = (v: string) => ESTADOS[v as EstadoTicket] ?? ESTADOS.nuevo;
export const getPrioridad = (v: string) => PRIORIDADES[v as PrioridadTicket] ?? PRIORIDADES.media;
export const getTipo = (v: string) => TIPOS[v as TipoTicket] ?? TIPOS.incidencia;

// Claves de consulta. Todas las listas de tickets (página y widget) cuelgan de
// CLAVE_TICKETS, así que invalidarla actualiza todas a la vez.
export const CLAVE_TICKETS = ["tickets"] as const;
export const claveTicket = (id: string | undefined) => ["ticket", id] as const;
export const CLAVE_PERSONAS_TICKETS = ["personas-tickets"] as const;
