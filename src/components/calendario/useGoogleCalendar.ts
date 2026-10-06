import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { appUrl } from "@/lib/app-url";
import { useAvisarError } from "@/hooks/useAvisarError";
import type { Event } from "./fechas";

const FUNCION = "google-calendar";
export const CLAVE_CONEXION_GOOGLE = ["google-calendar", "conexion"];

// Lo que devuelve la Edge Function por cada evento de Google
interface EventoGoogle {
  id: string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  todo_el_dia: boolean;
  ocupado: boolean;
  enlace: string | null;
}

type RespuestaEventos = { conectado: false; motivo?: string } | { conectado: true; email: string | null; eventos: EventoGoogle[] };

// Al tipo de evento del Calendario, marcado como de Google (solo lectura)
const aEvento = (e: EventoGoogle): Event => ({
  id: `google:${e.id}`,
  titulo: e.titulo,
  descripcion: e.descripcion,
  fecha_inicio: e.fecha_inicio,
  fecha_fin: e.fecha_fin,
  ubicacion: e.ubicacion,
  es_privado: false,
  creador_id: "",
  origen: "google",
  enlace: e.enlace,
  todo_el_dia: e.todo_el_dia,
  ocupado: e.ocupado,
});

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FUNCION, { body: cuerpo });
  if (error) throw error;
  return data as T;
}

// Conexión con Google Calendar de la persona y sus eventos del rango visible
export function useGoogleCalendar(desde: Date, hasta: Date) {
  const queryClient = useQueryClient();

  const { data: conexion = null, isPending: cargandoConexion } = useQuery({
    queryKey: CLAVE_CONEXION_GOOGLE,
    queryFn: async () => comprobar(await supabase.rpc("mi_conexion_google_calendar"))?.[0] ?? null,
    staleTime: 5 * 60_000,
  });

  const { data: eventos = [], error } = useQuery({
    queryKey: ["google-calendar", "eventos", desde.toISOString(), hasta.toISOString()],
    queryFn: async () => {
      const r = await llamar<RespuestaEventos>({ accion: "eventos", desde: desde.toISOString(), hasta: hasta.toISOString() });
      if (!r.conectado) {
        // Ha retirado el permiso en Google: la conexión ya no existe
        queryClient.invalidateQueries({ queryKey: CLAVE_CONEXION_GOOGLE });
        return [];
      }
      return r.eventos.map(aEvento);
    },
    enabled: !!conexion,
    // Google no avisa de los cambios: se vuelven a pedir pasados unos minutos
    staleTime: 5 * 60_000,
  });
  useAvisarError(error, "No se pudieron cargar los eventos de Google Calendar");

  // Lleva a Google para dar permiso; al terminar, Google vuelve a /calendario?google=...
  const conectar = async () => {
    const { url } = await llamar<{ url: string }>({ accion: "iniciar", volver: appUrl("calendario") });
    window.location.assign(url);
  };

  const desconectar = async () => {
    await llamar({ accion: "desconectar" });
    queryClient.setQueryData(CLAVE_CONEXION_GOOGLE, null);
    queryClient.removeQueries({ queryKey: ["google-calendar", "eventos"] });
  };

  return { conexion, cargandoConexion, eventos: conexion ? eventos : [], conectar, desconectar };
}
