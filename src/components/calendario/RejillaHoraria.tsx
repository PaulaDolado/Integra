import type { RefObject } from "react";
import { MapPin, Lock } from "lucide-react";
import { format, addHours, isToday, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { HOUR_HEIGHT, etiquetaCrearEvento, eventosDelDia, hours, layoutDayEvents, nombreDelDia, type Event } from "./fechas";

interface RejillaHorariaProps {
  days: Date[];
  events: Event[];
  now: Date;
  contenedorRef: RefObject<HTMLDivElement | null>;
  onCrear: (inicio: Date) => void;
  onEditar: (event: Event) => void;
  onAbrirDia: (day: Date) => void;
}

// Rejilla horaria compartida por las vistas de día y semana
export function RejillaHoraria({ days, events, now, contenedorRef, onCrear, onEditar, onAbrirDia }: RejillaHorariaProps) {
  const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;

  return (
    <div
      ref={contenedorRef}
      className="border rounded-lg overflow-auto max-h-[calc(100vh-18rem)] min-h-[420px]"
    >
      <div className={cn(days.length > 1 && "min-w-[640px]")}>
        {/* Cabecera de días */}
        <div className="flex border-b bg-card sticky top-0 z-20">
          <div className="w-14 shrink-0 border-r" />
          {days.map((day) => {
            const isDayToday = isToday(day);
            const contenido = (
              <>
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {format(day, 'EEE', { locale: es })}
                </span>
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold",
                    isDayToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}
                >
                  {format(day, 'd')}
                </span>
              </>
            );
            const clases = "flex-1 min-w-0 flex items-center justify-center gap-2 py-2 border-r last:border-r-0";
            // En la vista de un solo día la cabecera no hace nada: no es un botón
            return days.length > 1 ? (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => onAbrirDia(day)}
                aria-label={`Ver el ${nombreDelDia(day)}`}
                className={cn(clases, "hover:bg-muted/50 transition-colors cursor-pointer")}
              >
                {contenido}
              </button>
            ) : (
              <div key={day.toISOString()} className={clases}>
                {contenido}
              </div>
            );
          })}
        </div>

        {/* Rejilla */}
        <div className="flex">
          <div className="w-14 shrink-0 border-r">
            {hours.map((hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                {hour > 0 && (
                  <span className="absolute -top-2 right-2 text-[11px] text-muted-foreground bg-card px-0.5">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const isDayToday = isToday(day);
            const positioned = layoutDayEvents(eventosDelDia(events, day), day);

            return (
              <div
                key={day.toISOString()}
                className={cn("flex-1 min-w-0 relative border-r last:border-r-0", isDayToday && "bg-primary/3")}
              >
                {hours.map((hour) => {
                  const inicio = addHours(startOfDay(day), hour);
                  return (
                    <button
                      type="button"
                      key={hour}
                      className="block w-full border-b border-border/60 hover:bg-muted/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => onCrear(inicio)}
                      title="Crear evento"
                      aria-label={etiquetaCrearEvento(inicio)}
                    />
                  );
                })}

                {positioned.map(({ event, top, height, lane, lanes }) => {
                  const compact = height < 40;
                  return (
                    <div
                      key={event.id}
                      className="absolute z-10 px-0.5"
                      style={{
                        top,
                        height,
                        left: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onEditar(event)}
                        className="w-full h-full text-left rounded-md border-l-[3px] border-primary bg-accent text-accent-foreground px-2 py-1 overflow-hidden shadow-sm hover:brightness-95 transition"
                      >
                        <div className={cn("flex items-center gap-1 font-medium truncate", compact ? "text-[11px]" : "text-xs")}>
                          {event.es_privado && (
                            <>
                              <Lock className="w-3 h-3 shrink-0" />
                              <span className="sr-only">Privado:</span>
                            </>
                          )}
                          <span className="truncate">{event.titulo}</span>
                          {compact && (
                            <span className="font-normal opacity-80 shrink-0">
                              {format(new Date(event.fecha_inicio), 'HH:mm')}
                            </span>
                          )}
                        </div>
                        {!compact && (
                          <div className="text-[11px] opacity-80">
                            {format(new Date(event.fecha_inicio), 'HH:mm')} – {format(new Date(event.fecha_fin), 'HH:mm')}
                          </div>
                        )}
                        {event.ubicacion && height > 64 && (
                          <div className="flex items-center gap-1 text-[11px] opacity-80 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{event.ubicacion}</span>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}

                {isDayToday && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowTop }}>
                    <div className="relative h-0.5 bg-destructive">
                      <span className="absolute -left-1 top-[-3px] w-2 h-2 rounded-full bg-destructive" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
