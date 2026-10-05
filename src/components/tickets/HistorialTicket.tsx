import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { History } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fechaCorta, type Seguimiento, type Ticket } from "./ticket-config";
import { GaleriaAdjuntos } from "./GaleriaAdjuntos";
import type { Adjunto } from "./adjuntos";

interface HistorialTicketProps {
  ticket: Ticket;
  seguimientos: Seguimiento[];
  adjuntos: Adjunto[];
  urls: Map<string, string>;
  nombre: (empleadoId: string | null) => string;
}

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();

// Descripción del ticket seguida de respuestas, soluciones y eventos, con sus imágenes
export function HistorialTicket({ ticket, seguimientos, adjuntos, urls, nombre }: HistorialTicketProps) {
  const adjuntosDe = (seguimientoId: string | null) => adjuntos.filter((a) => a.seguimiento_id === seguimientoId);

  return (
    <ol className="space-y-4">
      <li>
        <Mensaje
          autor={nombre(ticket.autor_id)}
          fecha={ticket.fecha_creacion}
          etiqueta="Descripción"
          contenido={ticket.descripcion}
        >
          <GaleriaAdjuntos adjuntos={adjuntosDe(null)} urls={urls} />
        </Mensaje>
      </li>
      {seguimientos.map((s) =>
        s.tipo === "evento" ? (
          <li key={s.id} className="flex gap-3 pl-3 text-sm text-muted-foreground">
            <History className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="whitespace-pre-line">{s.contenido}</p>
              <p className="text-xs">
                {nombre(s.autor_id)} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: es })}
              </p>
            </div>
          </li>
        ) : (
          <li key={s.id}>
            <Mensaje
              autor={nombre(s.autor_id)}
              fecha={s.created_at}
              etiqueta={s.tipo === "solucion" ? "Solución" : undefined}
              contenido={s.contenido}
              solucion={s.tipo === "solucion"}
            >
              <GaleriaAdjuntos adjuntos={adjuntosDe(s.id)} urls={urls} />
            </Mensaje>
          </li>
        )
      )}
    </ol>
  );
}

function Mensaje({
  autor,
  fecha,
  contenido,
  etiqueta,
  solucion = false,
  children,
}: {
  autor: string;
  fecha: string;
  contenido: string;
  etiqueta?: string;
  solucion?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={`text-xs font-medium ${solucion ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
          {autor === "Tú" ? "TÚ" : iniciales(autor)}
        </AvatarFallback>
      </Avatar>
      <div
        className={`min-w-0 flex-1 rounded-xl border p-4 ${
          solucion ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30" : "bg-card"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{autor}</span>
          {etiqueta && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                solucion ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200" : "bg-muted text-muted-foreground"
              }`}
            >
              {etiqueta}
            </span>
          )}
          <span className="text-xs text-muted-foreground" title={fechaCorta(fecha)}>
            {formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es })}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed">{contenido}</p>
        {children}
      </div>
    </div>
  );
}
