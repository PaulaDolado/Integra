import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tareas"]["Row"];
export type TaskStatus = Task["estado"];

// Alias de tipo (no interface) para que sea asignable al tipo Json de Supabase
export type Subtarea = {
  id: string;
  titulo: string;
  completada: boolean;
};

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En Progreso" },
  { value: "completado", label: "Completada" },
];

// Las columnas JSON llegan sin tipar desde Supabase
export const getSubtareas = (task: Pick<Task, "subtareas"> | null): Subtarea[] =>
  Array.isArray(task?.subtareas) ? (task.subtareas as unknown as Subtarea[]) : [];

export type TipoPropiedad = "texto" | "numero" | "fecha";

export const TIPOS_PROPIEDAD: { value: TipoPropiedad; label: string }[] = [
  { value: "texto", label: "Texto" },
  { value: "numero", label: "Número" },
  { value: "fecha", label: "Fecha" },
];

export type Propiedad = {
  clave: string;
  tipo: TipoPropiedad;
  valor: string;
};

const toTipo = (tipo: unknown): TipoPropiedad =>
  TIPOS_PROPIEDAD.some((t) => t.value === tipo) ? (tipo as TipoPropiedad) : "texto";

// Se guardan como lista [{ clave, tipo, valor }] para conservar el orden (un objeto JSONB lo pierde).
// También se leen los formatos anteriores: { clave: { tipo, valor } } y { clave: "valor" }
export const getPropiedades = (task: Pick<Task, "propiedades"> | null): Propiedad[] => {
  const value = task?.propiedades;
  if (Array.isArray(value)) {
    return (value as unknown[])
      .filter((p): p is { clave: string; tipo?: string; valor?: unknown } =>
        !!p && typeof p === "object" && typeof (p as { clave?: unknown }).clave === "string"
      )
      .map((p) => ({ clave: p.clave, tipo: toTipo(p.tipo), valor: p.valor == null ? "" : String(p.valor) }));
  }
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).map(([clave, raw]) => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const { tipo, valor } = raw as { tipo?: string; valor?: unknown };
      return { clave, tipo: toTipo(tipo), valor: valor == null ? "" : String(valor) };
    }
    return { clave, tipo: "texto", valor: raw == null ? "" : String(raw) };
  });
};

export const serializePropiedades = (propiedades: Propiedad[]) =>
  propiedades
    .filter((p) => p.clave.trim())
    .map((p) => ({ clave: p.clave.trim(), tipo: p.tipo, valor: p.valor }));
