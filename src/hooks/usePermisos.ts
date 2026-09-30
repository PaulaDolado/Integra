import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Códigos de permiso definidos en la tabla public.permisos
export type Permiso =
  | "comunicados.rrhh"
  | "comunicados.marketing"
  | "ausencias.aprobar"
  | "empleados.gestionar"
  | "fichajes.ver_todos"
  | "fichajes.editar"
  | "contactos_emergencia.ver"
  | "datos_pago.ver"
  | "tickets.gestionar";

// Una sola consulta por usuario aunque varios componentes usen el hook
let cache: { userId: string; promise: Promise<Set<string>> } | null = null;

const cargarPermisos = (userId: string) => {
  if (cache?.userId !== userId) {
    const promise = Promise.resolve(supabase.rpc("mis_permisos")).then(({ data, error }) => {
      if (error) {
        console.error("Error fetching permisos:", error);
        cache = null;
      }
      return new Set<string>(data ?? []);
    });
    cache = { userId, promise };
  }
  return cache.promise;
};

// Permisos que el departamento del usuario le concede. Solo sirven para
// mostrar u ocultar acciones: la base de datos vuelve a comprobarlos.
export function usePermisos() {
  const { user } = useAuth();
  const [permisos, setPermisos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPermisos(new Set());
      setLoading(false);
      return;
    }
    let activo = true;
    cargarPermisos(user.id).then((resultado) => {
      if (activo) {
        setPermisos(resultado);
        setLoading(false);
      }
    });
    return () => {
      activo = false;
    };
  }, [user]);

  return {
    permisos,
    loading,
    tiene: (permiso: Permiso) => permisos.has(permiso),
  };
}
