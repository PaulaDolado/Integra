import { format, addHours, isSameMonth, isToday, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { MONTH_EVENTS_VISIBLE, clasesEvento, etiquetaCrearEvento, eventosDelDia, nombreDelDia, weekDays, type Event } from "./fechas";

interface VistaMesProps {
  days: Date[];
  currentDate: Date;
  events: Event[];
  onCrear: (inicio: Date) => void;
  onEditar: (event: Event) => void;
  onAbrirDia: (day: Date) => void;
}

export function VistaMes({ days, currentDate, events, onCrear, onEditar, onAbrirDia }: VistaMesProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium uppercase text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const dayEvents = eventosDelDia(events, day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative min-h-[96px] sm:min-h-[112px] p-1.5 border-b border-r nth-[7n]:border-r-0 transition-colors hover:bg-muted/40",
                !isCurrentMonth && "bg-muted/20"
              )}
            >
              {/* Toda la celda crea un evento a las 9:00: es un botón por debajo del
                  contenido, para poder usarla con el teclado sin anidar botones */}
              <button
                type="button"
                className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onCrear(addHours(startOfDay(day), 9))}
                title="Crear evento"
                aria-label={etiquetaCrearEvento(day, false)}
              />
              <button
                type="button"
                onClick={() => onAbrirDia(day)}
                className={cn(
                  "relative flex items-center justify-center w-7 h-7 mb-1 rounded-full text-sm transition-colors hover:bg-muted",
                  isDayToday && "bg-primary text-primary-foreground font-semibold hover:bg-primary",
                  !isCurrentMonth && !isDayToday && "text-muted-foreground"
                )}
                title="Ver día"
                aria-label={`Ver el ${nombreDelDia(day)}`}
              >
                {format(day, 'd')}
              </button>

              {/* pointer-events-none: los huecos entre eventos siguen llegando al botón de crear */}
              <div className="relative space-y-0.5 pointer-events-none">
                {dayEvents.slice(0, MONTH_EVENTS_VISIBLE).map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    className={cn("pointer-events-auto w-full flex items-center gap-1 text-left text-[11px] px-1.5 py-0.5 rounded hover:brightness-95 transition truncate", clasesEvento(event))}
                    onClick={() => onEditar(event)}
                  >
                    {!event.todo_el_dia && (
                      <span className="hidden sm:inline font-medium shrink-0">
                        {format(new Date(event.fecha_inicio), 'HH:mm')}
                      </span>
                    )}
                    <span className="truncate">{event.titulo}</span>
                  </button>
                ))}
                {dayEvents.length > MONTH_EVENTS_VISIBLE && (
                  <button
                    type="button"
                    className="pointer-events-auto text-[11px] px-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => onAbrirDia(day)}
                  >
                    +{dayEvents.length - MONTH_EVENTS_VISIBLE} más
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
