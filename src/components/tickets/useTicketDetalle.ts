import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { CLAVE_PERSONAS_TICKETS, CLAVE_TICKETS, claveTicket, type Seguimiento } from "./ticket-config";
import { urlsAdjuntos, type Adjunto } from "./adjuntos";

export type Plantilla = { id: string; nombre: string; contenido: string };
export type Tecnico = { id: string; nombre: string };

// Valores por defecto estables mientras no hay datos
const SIN_SEGUIMIENTOS: Seguimiento[] = [];
const SIN_ADJUNTOS: Adjunto[] = [];
const SIN_URLS = new Map<string, string>();
const SIN_PLANTILLAS: Plantilla[] = [];
const SIN_TECNICOS: Tecnico[] = [];

// Datos de la página de detalle de un ticket, al día con los cambios en tiempo real
export function useTicketDetalle(id: string | undefined, esSoporte: boolean) {
  const queryClient = useQueryClient();

  // Ticket, historial y adjuntos, con sus URLs firmadas (duran 1 hora y se renuevan en cada recarga)
  const {
    data: detalle,
    isLoading: cargandoTicket,
    error: errorTicket,
    refetch: reintentarTicket,
    isFetching: reintentando,
  } = useQuery({
    queryKey: claveTicket(id),
    queryFn: async () => {
      const [t, segs, adj] = await Promise.all([
        supabase.from("tickets").select("*").eq("id", id!).maybeSingle().then(comprobar),
        supabase.from("ticket_seguimientos").select("*").eq("ticket_id", id!).order("created_at").then(comprobar),
        supabase.from("ticket_adjuntos").select("*").eq("ticket_id", id!).order("created_at").then(comprobar),
      ]);
      const adjuntos = adj ?? [];
      return { ticket: t, seguimientos: segs ?? [], adjuntos, urls: await urlsAdjuntos(adjuntos) };
    },
    enabled: !!id,
  });

  const { data: personas, isLoading: cargandoPersonas } = useQuery({
    queryKey: CLAVE_PERSONAS_TICKETS,
    queryFn: async () => comprobar(await supabase.rpc("personas_tickets")),
  });

  const { data: plantillas = SIN_PLANTILLAS } = useQuery({
    queryKey: ["plantillas-solucion"],
    queryFn: async (): Promise<Plantilla[]> =>
      comprobar(await supabase.from("plantillas_solucion").select("id, nombre, contenido").order("orden")) ?? [],
  });

  const { data: tecnicos = SIN_TECNICOS } = useQuery({
    queryKey: ["tecnicos-tickets"],
    queryFn: async () => comprobar(await supabase.rpc("tecnicos_tickets")) ?? [],
    enabled: esSoporte,
  });

  useInvalidarEnCambios(
    id ? `ticket-${id}` : null,
    [
      { table: "ticket_seguimientos", filter: `ticket_id=eq.${id}` },
      { table: "tickets", filter: `id=eq.${id}` },
      { table: "ticket_adjuntos", filter: `ticket_id=eq.${id}` },
    ],
    [claveTicket(id)]
  );

  const nombres = useMemo(() => new Map((personas ?? []).map((p) => [p.id, p.nombre])), [personas]);

  // Tras una acción: recarga el ticket y deja anticuadas las listas de tickets
  const recargar = () => {
    queryClient.invalidateQueries({ queryKey: claveTicket(id) });
    queryClient.invalidateQueries({ queryKey: CLAVE_TICKETS });
  };

  return {
    ticket: detalle?.ticket ?? null,
    seguimientos: detalle?.seguimientos ?? SIN_SEGUIMIENTOS,
    adjuntos: detalle?.adjuntos ?? SIN_ADJUNTOS,
    urls: detalle?.urls ?? SIN_URLS,
    nombres,
    plantillas,
    tecnicos,
    cargando: cargandoTicket || cargandoPersonas,
    errorTicket,
    reintentarTicket,
    reintentando,
    recargar,
  };
}
