import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CambioTabla {
  table: string;
  // Filtro de Realtime, por ejemplo `empleado_id=eq.${id}`
  filter?: string;
}

// Escucha los cambios de una o varias tablas por Realtime e invalida las
// consultas indicadas, que se vuelven a pedir si hay alguien usándolas.
// `canal` debe ser único entre los componentes montados a la vez.
export function useInvalidarEnCambios(canal: string | null, cambios: CambioTabla[], claves: QueryKey[]) {
  const queryClient = useQueryClient();
  // Las listas cambian de referencia en cada render: se comparan por contenido
  const cambiosJson = JSON.stringify(cambios);
  const clavesJson = JSON.stringify(claves);

  useEffect(() => {
    if (!canal) return;
    const tablas: CambioTabla[] = JSON.parse(cambiosJson);
    const aInvalidar: QueryKey[] = JSON.parse(clavesJson);
    const invalidar = () => {
      for (const queryKey of aInvalidar) queryClient.invalidateQueries({ queryKey });
    };

    let channel = supabase.channel(canal);
    for (const { table, filter } of tablas) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, invalidar);
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canal, cambiosJson, clavesJson, queryClient]);
}
