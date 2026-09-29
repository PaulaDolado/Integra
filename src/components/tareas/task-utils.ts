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

export const getPropiedades = (task: Pick<Task, "propiedades"> | null): Record<string, string> => {
  const value = task?.propiedades;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, string>)
    : {};
};
