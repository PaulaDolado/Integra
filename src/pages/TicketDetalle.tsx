import { useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TicketBadge } from "@/components/tickets/TicketBadge";
import { numeroTicket } from "@/components/tickets/ticket-config";
import { useTicketDetalle } from "@/components/tickets/useTicketDetalle";
import { HistorialTicket } from "@/components/tickets/HistorialTicket";
import { RedactorTicket } from "@/components/tickets/RedactorTicket";
import { ValoracionSolucion } from "@/components/tickets/ValoracionSolucion";
import { PropiedadesTicket } from "@/components/tickets/PropiedadesTicket";

export default function TicketDetalle() {
  const { id } = useParams<{ id: string }>();
  const { tiene } = usePermisos();
  const { empleadoId: miId, loading: cargandoEmpleado } = useMiEmpleadoId();
  // Compartido entre responder y valorar la solución: mientras se envía una, la otra espera
  const [enviando, setEnviando] = useState(false);

  const esSoporte = tiene("tickets.gestionar");
  const {
    ticket,
    seguimientos,
    adjuntos,
    urls,
    nombres,
    plantillas,
    tecnicos,
    cargando,
    errorTicket,
    reintentarTicket,
    reintentando,
    recargar,
  } = useTicketDetalle(id, esSoporte);

  if (cargando || cargandoEmpleado) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Un fallo de red no es lo mismo que un ticket que no existe
  if (errorTicket && !ticket) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild className="gap-2 px-2">
          <Link to="/tickets">
            <ArrowLeft className="w-4 h-4" />
            Volver a los tickets
          </Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <p className="text-muted-foreground">No se pudo cargar el ticket. Comprueba la conexión e inténtalo de nuevo.</p>
            <Button variant="outline" onClick={() => reintentarTicket()} disabled={reintentando}>
              {reintentando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild className="gap-2 px-2">
          <Link to="/tickets">
            <ArrowLeft className="w-4 h-4" />
            Volver a los tickets
          </Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            El ticket no existe o no tienes acceso a él.
          </CardContent>
        </Card>
      </div>
    );
  }

  const nombre = (empleadoId: string | null) =>
    !empleadoId ? "Sistema" : empleadoId === miId ? "Tú" : nombres.get(empleadoId) ?? "Empleado";

  const soySolicitante = ticket.autor_id === miId;
  const soyTecnico = esSoporte || ticket.asignado_a_id === miId;
  const cerrado = ticket.estado === "cerrado";
  const puedeSolucionar = soyTecnico && !["resuelto", "cerrado"].includes(ticket.estado);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" asChild className="-ml-2 gap-2 px-2 text-muted-foreground">
          <Link to={esSoporte ? "/gestion-tickets" : "/tickets"}>
            <ArrowLeft className="w-4 h-4" />
            {esSoporte ? "Todos los tickets" : "Mis tickets"}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{numeroTicket(ticket.id)}</span>
          <TicketBadge clase="tipo" valor={ticket.tipo} />
          <TicketBadge clase="estado" valor={ticket.estado} />
          <TicketBadge clase="prioridad" valor={ticket.prioridad} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.titulo}</h1>
      </div>

      {ticket.estado === "resuelto" && soySolicitante && (
        <ValoracionSolucion ticketId={ticket.id} enviando={enviando} setEnviando={setEnviando} recargar={recargar} />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Historial */}
        <div className="space-y-4">
          <HistorialTicket ticket={ticket} seguimientos={seguimientos} adjuntos={adjuntos} urls={urls} nombre={nombre} />

          {cerrado ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Este ticket está cerrado. Si el problema vuelve a aparecer, abre un ticket nuevo.
            </p>
          ) : (
            <RedactorTicket
              ticket={ticket}
              puedeSolucionar={puedeSolucionar}
              soySolicitante={soySolicitante}
              plantillas={plantillas}
              enviando={enviando}
              setEnviando={setEnviando}
              recargar={recargar}
            />
          )}
        </div>

        {/* Detalles */}
        <PropiedadesTicket
          ticket={ticket}
          editable={esSoporte && !cerrado}
          tecnicos={tecnicos}
          miId={miId}
          nombre={nombre}
          recargar={recargar}
        />
      </div>
    </div>
  );
}
