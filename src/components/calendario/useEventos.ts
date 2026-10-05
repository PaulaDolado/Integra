import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { getViewRange, type ViewType } from "./fechas";

// Eventos del rango visible y próximos eventos, al día con los cambios en tiempo real
export function useEventos(viewType: ViewType, currentDate: Date) {
  // La clave depende del rango visible, no del día elegido: moverse dentro
  // de la misma semana o mes no vuelve a pedir los eventos
  const { start: rangeStart, end: rangeEnd } = getViewRange(viewType, currentDate);
  const { data: events = [], error } = useQuery({
    queryKey: ['eventos', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () =>
      comprobar(
        await supabase
          .from('eventos')
          .select('*')
          .lte('fecha_inicio', rangeEnd.toISOString())
          .gte('fecha_fin', rangeStart.toISOString())
          .order('fecha_inicio', { ascending: true })
      ) ?? [],
    // Mientras llegan los del nuevo rango se siguen viendo los anteriores
    placeholderData: keepPreviousData,
  });
  useAvisarError(error, "No se pudieron cargar los eventos");

  const { data: upcomingEvents = [], isPending: loadingUpcoming } = useQuery({
    queryKey: ['eventos', 'proximos'],
    queryFn: async () =>
      comprobar(
        await supabase
          .from('eventos')
          .select('*')
          .gte('fecha_fin', new Date().toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(5)
      ) ?? [],
  });

  useInvalidarEnCambios('calendario-page-changes', [{ table: 'eventos' }], [['eventos']]);

  return { events, upcomingEvents, loadingUpcoming };
}
