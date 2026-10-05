import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { toast } from "@/hooks/use-toast";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";

export type Aviso = Tables<"avisos">;

export interface DatosAvisos {
  avisos: Aviso[];
  // Total sin leer, aunque haya más de los que se muestran
  sinLeer: number;
}

// Avisos que se muestran en la campana
export const LIMITE_AVISOS = 30;

export const claveAvisos = (empleadoId: string | null) => ["avisos", empleadoId];

// Avisos del empleado de la sesión (los últimos y cuántos tiene sin leer), al
// día por Realtime, y funciones para marcarlos como leídos.
export function useAvisos() {
  const queryClient = useQueryClient();
  const { empleadoId } = useMiEmpleadoId();
  const clave = claveAvisos(empleadoId);

  const { data, isPending } = useQuery({
    queryKey: clave,
    queryFn: async (): Promise<DatosAvisos> => {
      const [lista, cuenta] = await Promise.all([
        supabase
          .from("avisos")
          .select("*")
          .eq("empleado_id", empleadoId!)
          .order("created_at", { ascending: false })
          .limit(LIMITE_AVISOS),
        supabase
          .from("avisos")
          .select("id", { count: "exact", head: true })
          .eq("empleado_id", empleadoId!)
          .is("leido_en", null),
      ]);
      const avisos = comprobar(lista) ?? [];
      if (cuenta.error) throw cuenta.error;
      return { avisos, sinLeer: cuenta.count ?? 0 };
    },
    enabled: !!empleadoId,
  });

  useInvalidarEnCambios(
    empleadoId ? `avisos-${empleadoId}` : null,
    [{ table: "avisos", filter: `empleado_id=eq.${empleadoId}` }],
    [clave]
  );

  // Sin ids, marca todos los avisos del empleado (también los que no se muestran)
  const marcar = useMutation({
    mutationFn: async (ids?: string[]) =>
      comprobar(await supabase.rpc("marcar_avisos_leidos", ids ? { p_ids: ids } : {})),
    // Se marcan en pantalla al momento; si falla, se deshace
    onMutate: async (ids?: string[]) => {
      await queryClient.cancelQueries({ queryKey: clave });
      const anterior = queryClient.getQueryData<DatosAvisos>(clave);
      if (anterior) {
        const ahora = new Date().toISOString();
        const afectado = (a: Aviso) => !a.leido_en && (!ids || ids.includes(a.id));
        const marcados = anterior.avisos.filter(afectado).length;
        queryClient.setQueryData<DatosAvisos>(clave, {
          avisos: anterior.avisos.map((a) => (afectado(a) ? { ...a, leido_en: ahora } : a)),
          sinLeer: ids ? Math.max(0, anterior.sinLeer - marcados) : 0,
        });
      }
      return { anterior };
    },
    onError: (error, _ids, contexto) => {
      console.error("Error al marcar los avisos como leídos:", error);
      if (contexto?.anterior) queryClient.setQueryData(clave, contexto.anterior);
      toast({ title: "Error", description: "No se pudieron marcar los avisos como leídos", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: clave }),
  });

  return {
    avisos: data?.avisos ?? [],
    sinLeer: data?.sinLeer ?? 0,
    loading: !!empleadoId && isPending,
    marcarLeido: (id: string) => marcar.mutate([id]),
    marcarTodos: () => marcar.mutate(undefined),
  };
}
