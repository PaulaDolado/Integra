import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { comprobar } from "@/lib/query-client";

// Códigos de permiso definidos en la tabla public.permisos
export type Permiso =
  | "comunicados.rrhh"
  | "comunicados.marketing"
  | "ausencias.aprobar"
  | "empleados.gestionar"
  | "fichajes.ver_todos"
  | "fichajes.editar"
  | "contactos_emergencia.ver"
  | "contactos_emergencia.editar"
  | "datos_pago.ver"
  | "datos_pago.editar"
  | "tickets.gestionar"
  | "turnos.aprobar";

const SIN_PERMISOS = new Set<string>();

// Permisos que el departamento del usuario le concede. Solo sirven para
// mostrar u ocultar acciones: la base de datos vuelve a comprobarlos.
// Se piden una sola vez por usuario aunque los usen varios componentes.
export function usePermisos() {
  const { user } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["permisos", user?.id],
    queryFn: async () => new Set<string>(comprobar(await supabase.rpc("mis_permisos")) ?? []),
    enabled: !!user,
    staleTime: Infinity,
  });

  // Si la consulta falla no se concede nada
  const permisos = data ?? SIN_PERMISOS;
  return {
    permisos,
    loading: !!user && isPending,
    tiene: (permiso: Permiso) => permisos.has(permiso),
  };
}
