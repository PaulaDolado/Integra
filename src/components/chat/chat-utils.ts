import { format, isToday, isYesterday, isThisWeek, isThisYear } from "date-fns";
import { es } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

export type Conversation = Database["public"]["Functions"]["mis_conversaciones"]["Returns"][number];
export type Colleague = Database["public"]["Functions"]["directorio_empleados"]["Returns"][number];
export type Message = Database["public"]["Tables"]["mensajes"]["Row"];

export const getInitials = (name: string | null | undefined) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
};

export const colleagueName = (colleague: Colleague | undefined) =>
  colleague ? `${colleague.nombre} ${colleague.primer_apellido}` : "Usuario";

export const colleagueRole = (colleague: Colleague | undefined) =>
  [colleague?.cargo, colleague?.departamento].filter(Boolean).join(" · ");

// Hora en la lista de conversaciones: 14:05, Ayer, lunes, 12 mar, 12/03/25
export const formatListTime = (iso: string) => {
  const date = new Date(iso);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ayer";
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, "EEEE", { locale: es });
  if (isThisYear(date)) return format(date, "d MMM", { locale: es });
  return format(date, "dd/MM/yy");
};

// Separador de días dentro del hilo
export const formatDaySeparator = (date: Date) => {
  if (isToday(date)) return "Hoy";
  if (isYesterday(date)) return "Ayer";
  const text = format(date, isThisYear(date) ? "EEEE, d 'de' MMMM" : "d 'de' MMMM 'de' yyyy", { locale: es });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
