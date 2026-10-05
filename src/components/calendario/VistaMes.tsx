import { format, addHours, isSameMonth, isToday, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { MONTH_EVENTS_VISIBLE, eventosDelDia, weekDays, type Event } from "./fechas";

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
                "min-h-[96px] sm:min-h-[112px] p-1.5 border-b border-r nth-[7n]:border-r-0 cursor-pointer transition-colors hover:bg-muted/40",
                !isCurrentMonth && "bg-muted/20"
              )}
              onClick={() => onCrear(addHours(startOfDay(day), 9))}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAbrirDia(day);
                }}
                className={cn(
                  "flex items-center justify-center w-7 h-7 mb-1 rounded-full text-sm transition-colors hover:bg-muted",
                  isDayToday && "bg-primary text-primary-foreground font-semibold hover:bg-primary",
                  !isCurrentMonth && !isDayToday && "text-muted-foreground"
                )}
                title="Ver día"
              >
                {format(day, 'd')}
              </button>

              <div className="space-y-0.5">
                {dayEvents.slice(0, MONTH_EVENTS_VISIBLE).map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    className="w-full flex items-center gap-1 text-left text-[11px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground hover:brightness-95 transition truncate"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditar(event);
                    }}
                  >
                    <span className="hidden sm:inline font-medium shrink-0">
                      {format(new Date(event.fecha_inicio), 'HH:mm')}
                    </span>
                    <span className="truncate">{event.titulo}</span>
                  </button>
                ))}
                {dayEvents.length > MONTH_EVENTS_VISIBLE && (
                  <button
                    type="button"
                    className="text-[11px] px-1.5 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAbrirDia(day);
                    }}
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
