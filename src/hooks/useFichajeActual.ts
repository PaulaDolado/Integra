import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";

type TipoFichaje = "entrada" | "salida";

// Clave común de todo lo que muestra fichajes del empleado: al cambiar uno,
// se actualizan la barra superior y la página de fichajes a la vez
export const claveMisFichajes = (empleadoId: string | null) => ["fichajes", empleadoId];

// Estado de fichaje del empleado de la sesión: si está dentro (última entrada de
// hoy sin salida) y una función para registrar la entrada o la salida.
// La hora la pone el servidor; aquí solo se decide el tipo.
export function useFichajeActual() {
  const queryClient = useQueryClient();
  const { empleadoId, loading: cargandoEmpleado } = useMiEmpleadoId();
  const [registrando, setRegistrando] = useState(false);

  const { data: dentroDesde = null, isPending } = useQuery({
    queryKey: [...claveMisFichajes(empleadoId), "actual"],
    queryFn: async () => {
      const hoy = new Date();
      const ultimo = comprobar(
        await supabase
          .from("fichajes")
          .select("tipo, fecha_hora")
          .eq("empleado_id", empleadoId!)
          .eq("anulado", false)
          .gte("fecha_hora", startOfDay(hoy).toISOString())
          .lte("fecha_hora", endOfDay(hoy).toISOString())
          .order("fecha_hora", { ascending: false })
          .limit(1)
          .maybeSingle()
      );
      return ultimo?.tipo === "entrada" ? new Date(ultimo.fecha_hora) : null;
    },
    enabled: !!empleadoId,
  });

  useInvalidarEnCambios(
    empleadoId ? `mi-fichaje-${empleadoId}` : null,
    [{ table: "fichajes", filter: `empleado_id=eq.${empleadoId}` }],
    [claveMisFichajes(empleadoId)]
  );

  const fichar = useCallback(async (): Promise<{ tipo: TipoFichaje; error: string | null }> => {
    const tipo: TipoFichaje = dentroDesde ? "salida" : "entrada";
    if (!empleadoId) return { tipo, error: "Tu usuario no tiene un perfil de empleado asociado" };

    setRegistrando(true);
    const { error } = await supabase.from("fichajes").insert({ empleado_id: empleadoId, tipo });
    setRegistrando(false);
    if (error) {
      console.error("Error registering fichaje:", error);
      return { tipo, error: "No se pudo registrar el fichaje" };
    }
    await queryClient.invalidateQueries({ queryKey: claveMisFichajes(empleadoId) });
    return { tipo, error: null };
  }, [dentroDesde, empleadoId, queryClient]);

  const loading = cargandoEmpleado || (!!empleadoId && isPending);
  return { dentro: dentroDesde !== null, dentroDesde, loading, registrando, fichar };
}
