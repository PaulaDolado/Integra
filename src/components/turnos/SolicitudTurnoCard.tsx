import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRight, Repeat } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ESTADOS_TURNO } from "./estados";

export type SolicitudTurno = Database["public"]["Functions"]["solicitudes_turno_detalle"]["Returns"][number];

export function EstadoTurnoBadge({ estado }: { estado: string }) {
  const e = ESTADOS_TURNO[estado] ?? { label: estado, clases: "bg-muted text-muted-foreground border-border" };
  return <span className={cn("whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium", e.clases)}>{e.label}</span>;
}

const fechaLarga = (fecha: string) => format(new Date(`${fecha}T00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
const momento = (fecha: string) => format(new Date(fecha), "d MMM yyyy, HH:mm", { locale: es });

interface SolicitudTurnoCardProps {
  solicitud: SolicitudTurno;
  // Cómo nombrar a las personas desde el punto de vista de quien mira
  nombreSolicitante?: string;
  nombreCompanero?: string;
  mostrarDepartamento?: boolean;
  acciones?: React.ReactNode;
}

// Tarjeta con el cambio pedido, el intercambio (si lo hay) y su historial
export function SolicitudTurnoCard({
  solicitud: s,
  nombreSolicitante,
  nombreCompanero,
  mostrarDepartamento,
  acciones,
}: SolicitudTurnoCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold first-letter:uppercase">{fechaLarga(s.fecha)}</span>
              <EstadoTurnoBadge estado={s.estado} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-md bg-muted px-2 py-0.5">{s.turno_actual}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" aria-label="pasa a" />
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">{s.turno_solicitado}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {nombreSolicitante ?? s.solicitante}
              {mostrarDepartamento && s.departamento && ` · ${s.departamento}`}
            </p>
            {s.companero_id && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Repeat className="h-3.5 w-3.5" />
                Intercambio con {nombreCompanero ?? s.companero}, que pasa al turno {s.turno_actual.split(" (")[0].toLowerCase()}
              </p>
            )}
            <p className="text-sm">
              <span className="text-muted-foreground">Motivo:</span> {s.motivo}
            </p>
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p>Solicitado el {momento(s.created_at)}</p>
              {s.fecha_respuesta_companero && (
                <p>
                  {s.estado === "rechazada" && !s.fecha_revision ? "Rechazado" : "Aceptado"} por {nombreCompanero ?? s.companero} el{" "}
                  {momento(s.fecha_respuesta_companero)}
                  {s.respuesta_companero && <span className="italic"> · «{s.respuesta_companero}»</span>}
                </p>
              )}
              {s.fecha_revision && (
                <p>
                  {s.estado === "aprobada" ? "Aprobado" : "Rechazado"} por {s.revisor} el {momento(s.fecha_revision)}
                  {s.comentario_revision && <span className="italic"> · «{s.comentario_revision}»</span>}
                </p>
              )}
            </div>
          </div>
          {acciones && <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">{acciones}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
