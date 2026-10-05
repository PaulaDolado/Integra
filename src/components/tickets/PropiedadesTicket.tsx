import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TicketBadge } from "./TicketBadge";
import {
  ESTADOS,
  ORDEN_ESTADOS,
  ORDEN_PRIORIDADES,
  ORDEN_TIPOS,
  PRIORIDADES,
  TIPOS,
  fechaCorta,
  type Ticket,
} from "./ticket-config";
import { useAvisarFallo } from "./useAvisarFallo";
import type { Tecnico } from "./useTicketDetalle";

const SIN_ASIGNAR = "none";

interface PropiedadesTicketProps {
  ticket: Ticket;
  // Soporte puede cambiar tipo, estado, prioridad y asignación mientras el ticket no esté cerrado
  editable: boolean;
  tecnicos: Tecnico[];
  miId: string | null;
  nombre: (empleadoId: string | null) => string;
  recargar: () => void;
}

// Panel lateral con las propiedades del ticket, editables por soporte
export function PropiedadesTicket({ ticket, editable, tecnicos, miId, nombre, recargar }: PropiedadesTicketProps) {
  const { toast } = useToast();
  const avisarFallo = useAvisarFallo();
  const [propiedades, setPropiedades] = useState({ tipo: "", prioridad: "", estado: "", asignado: SIN_ASIGNAR });
  const [guardandoPropiedades, setGuardandoPropiedades] = useState(false);

  // El formulario de propiedades vuelve a los valores del ticket cada vez que este cambia
  const [ticketPrevio, setTicketPrevio] = useState<Ticket | null>(null);
  if (ticket !== ticketPrevio) {
    setTicketPrevio(ticket);
    setPropiedades({ tipo: ticket.tipo, prioridad: ticket.prioridad, estado: ticket.estado, asignado: ticket.asignado_a_id ?? SIN_ASIGNAR });
  }

  const propiedadesCambiadas =
    propiedades.tipo !== ticket.tipo ||
    propiedades.prioridad !== ticket.prioridad ||
    propiedades.estado !== ticket.estado ||
    propiedades.asignado !== (ticket.asignado_a_id ?? SIN_ASIGNAR);

  const guardarPropiedades = async () => {
    setGuardandoPropiedades(true);
    try {
      const { error } = await supabase.rpc("actualizar_ticket", {
        p_ticket: ticket.id,
        p_tipo: propiedades.tipo,
        p_prioridad: propiedades.prioridad,
        p_estado: propiedades.estado,
        p_asignado: propiedades.asignado === SIN_ASIGNAR ? null : propiedades.asignado,
      });
      if (error) {
        avisarFallo(error);
        return;
      }
      toast({ title: "Ticket actualizado" });
      recargar();
    } catch (error) {
      avisarFallo(error);
    } finally {
      setGuardandoPropiedades(false);
    }
  };

  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Detalles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editable ? (
          <>
            <Propiedad label="Tipo">
              <Select value={propiedades.tipo} onValueChange={(v) => setPropiedades({ ...propiedades, tipo: v })}>
                <SelectTrigger aria-label="Tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEN_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPOS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Propiedad>
            <Propiedad label="Estado">
              <Select value={propiedades.estado} onValueChange={(v) => setPropiedades({ ...propiedades, estado: v })}>
                <SelectTrigger aria-label="Estado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEN_ESTADOS.map((e) => (
                    <SelectItem
                      key={e}
                      value={e}
                      // Solo se resuelve añadiendo una solución
                      disabled={e === "resuelto" && ticket.estado !== "resuelto"}
                    >
                      {ESTADOS[e].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Propiedad>
            <Propiedad label="Prioridad">
              <Select value={propiedades.prioridad} onValueChange={(v) => setPropiedades({ ...propiedades, prioridad: v })}>
                <SelectTrigger aria-label="Prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEN_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADES[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Propiedad>
            <Propiedad label="Asignado a">
              <Select value={propiedades.asignado} onValueChange={(v) => setPropiedades({ ...propiedades, asignado: v })}>
                <SelectTrigger aria-label="Asignado a">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {tecnicos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.id === miId ? `${t.nombre} (tú)` : t.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Propiedad>
            {propiedadesCambiadas && (
              <Button className="w-full" onClick={guardarPropiedades} disabled={guardandoPropiedades}>
                {guardandoPropiedades && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar cambios
              </Button>
            )}
          </>
        ) : (
          <>
            <Propiedad label="Tipo">
              <TicketBadge clase="tipo" valor={ticket.tipo} />
            </Propiedad>
            <Propiedad label="Estado">
              <TicketBadge clase="estado" valor={ticket.estado} />
            </Propiedad>
            <Propiedad label="Prioridad">
              <TicketBadge clase="prioridad" valor={ticket.prioridad} />
            </Propiedad>
            <Propiedad label="Asignado a">
              <span className="text-sm">{ticket.asignado_a_id ? nombre(ticket.asignado_a_id) : "Sin asignar"}</span>
            </Propiedad>
          </>
        )}
        <div className="space-y-2 border-t pt-4 text-sm">
          <Dato label="Solicitante" valor={nombre(ticket.autor_id)} />
          <Dato label="Abierto" valor={fechaCorta(ticket.fecha_creacion)} />
          {ticket.fecha_resolucion && <Dato label="Resuelto" valor={fechaCorta(ticket.fecha_resolucion)} />}
          {ticket.fecha_cierre && <Dato label="Cerrado" valor={fechaCorta(ticket.fecha_cierre)} />}
        </div>
      </CardContent>
    </Card>
  );
}

function Propiedad({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
