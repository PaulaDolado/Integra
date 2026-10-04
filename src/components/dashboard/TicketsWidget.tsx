import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Ticket as TicketIcon, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { NuevoTicketDialog } from "@/components/tickets/NuevoTicketDialog";
import { TicketBadge } from "@/components/tickets/TicketBadge";
import { CLAVE_TICKETS, ESTADOS, numeroTicket, type EstadoTicket } from "@/components/tickets/ticket-config";

// Estados que se resumen en el widget (los cerrados no requieren atención)
const RESUMEN: { estado: EstadoTicket; label: string; clases: string }[] = [
  { estado: "nuevo", label: "Nuevos", clases: "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-300" },
  { estado: "en_curso", label: "En curso", clases: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300" },
  { estado: "en_espera", label: "En espera", clases: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-900 dark:text-violet-300" },
  { estado: "resuelto", label: "Resueltos", clases: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/40 dark:border-green-900 dark:text-green-300" },
];

export function TicketsWidget() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { empleadoId, loading: cargandoEmpleado } = useMiEmpleadoId();
  const navigate = useNavigate();

  // Tickets abiertos por este empleado o asignados a él
  const { data: tickets = [], isLoading, error } = useQuery({
    queryKey: [...CLAVE_TICKETS, "widget", empleadoId],
    queryFn: async () =>
      comprobar(
        await supabase
          .from("tickets")
          .select("*")
          .or(`autor_id.eq.${empleadoId},asignado_a_id.eq.${empleadoId}`)
          .order("updated_at", { ascending: false })
          .limit(20)
      ) ?? [],
    enabled: !!empleadoId,
  });
  useAvisarError(error, "No se pudieron cargar los tickets");

  useInvalidarEnCambios(empleadoId ? "tickets-changes" : null, [{ table: "tickets" }], [CLAVE_TICKETS]);

  const loading = cargandoEmpleado || isLoading;

  const recientes = tickets.filter((t) => t.estado !== "cerrado").slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TicketIcon className="w-5 h-5 text-primary" />
          Mis Tickets
        </CardTitle>
        <Button size="sm" className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          Nuevo Ticket
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Resumen de estados */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RESUMEN.map(({ estado, label, clases }) => (
                <div key={estado} className={`rounded-lg border p-2 text-center ${clases}`} title={ESTADOS[estado].label}>
                  <div className="text-base font-bold tabular-nums">{tickets.filter((t) => t.estado === estado).length}</div>
                  <div className="text-xs">{label}</div>
                </div>
              ))}
            </div>

            {/* Tickets abiertos más recientes */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Tickets Recientes</h4>
              {recientes.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <TicketIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tienes tickets abiertos</p>
                </div>
              ) : (
                recientes.map((ticket) => (
                  <button
                    type="button"
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="w-full space-y-2 rounded-lg border border-border p-2.5 text-left transition-colors duration-150 ease-out hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{numeroTicket(ticket.id)}</span>
                      <TicketBadge clase="prioridad" valor={ticket.prioridad} />
                    </div>
                    <p className="text-sm font-medium leading-tight text-foreground line-clamp-2">{ticket.titulo}</p>
                    <div className="flex items-center justify-between gap-2">
                      <TicketBadge clase="estado" valor={ticket.estado} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.fecha_creacion).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => navigate("/tickets")}
                className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-muted/60 transition-colors"
              >
                Ver todos los tickets →
              </button>
            </div>
          </>
        )}
      </CardContent>

      <NuevoTicketDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onCreated={(id) => navigate(`/tickets/${id}`)} />
    </Card>
  );
}
