import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, ExternalLink, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { capitalize, type Event } from "./fechas";

// Cuándo es: «Jueves 8 de octubre, 10:00 – 11:00» o «Lunes 12 de octubre · Todo el día»
function cuando(event: Event) {
  const inicio = new Date(event.fecha_inicio);
  const fin = new Date(event.fecha_fin);
  const dia = capitalize(format(inicio, "EEEE d 'de' MMMM", { locale: es }));
  if (event.todo_el_dia) {
    // El fin de los de todo el día es el día siguiente (exclusivo)
    const ultimo = new Date(fin.getTime() - 1);
    return format(ultimo, "yyyy-MM-dd") === format(inicio, "yyyy-MM-dd")
      ? `${dia} · Todo el día`
      : `${dia} – ${format(ultimo, "EEEE d 'de' MMMM", { locale: es })} · Todo el día`;
  }
  return `${dia}, ${format(inicio, "HH:mm")} – ${format(fin, "HH:mm")}`;
}

interface DetalleEventoGoogleProps {
  event: Event | null;
  onClose: () => void;
}

// Un evento de Google Calendar: se ve aquí, pero se cambia en Google
export function DetalleEventoGoogle({ event, onClose }: DetalleEventoGoogleProps) {
  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {event && (
          <>
            <DialogHeader>
              <DialogTitle>{event.titulo}</DialogTitle>
              <DialogDescription>Evento de tu Google Calendar. Para cambiarlo, ábrelo en Google.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                {cuando(event)}
              </p>
              {event.ubicacion && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  {event.ubicacion}
                </p>
              )}
              {event.descripcion && <p className="whitespace-pre-line pt-1 text-muted-foreground">{event.descripcion}</p>}
              {event.ocupado === false && <p className="text-xs text-muted-foreground">En Google aparece como «Disponible».</p>}
            </div>
            {event.enlace && (
              <Button asChild variant="outline" className="w-fit gap-2">
                <a href={event.enlace} target="_blank" rel="noopener noreferrer">
                  Abrir en Google Calendar
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
