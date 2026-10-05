import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { capitalize, diasConEventos, solapa, weekDays, type Event } from "./fechas";

interface VistaAnioProps {
  months: Date[];
  events: Event[];
  onAbrirMes: (month: Date) => void;
  onAbrirDia: (day: Date) => void;
}

export function VistaAnio({ months, events, onAbrirMes, onAbrirDia }: VistaAnioProps) {
  const eventDays = diasConEventos(events);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {months.map((month) => {
        const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
        const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
        const monthDays = [];
        for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
          monthDays.push(day);
        }
        // Cuenta también los eventos que empezaron antes y siguen en este mes
        const monthEventCount = events.filter(event => solapa(event, startOfMonth(month), endOfMonth(month))).length;

        return (
          <div key={month.toISOString()} className="border rounded-lg p-3">
            <button
              type="button"
              className="w-full flex items-center justify-between mb-2 hover:text-primary transition-colors"
              onClick={() => onAbrirMes(month)}
            >
              <span className="font-semibold text-sm">{capitalize(format(month, 'MMMM', { locale: es }))}</span>
              {monthEventCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  {monthEventCount} {monthEventCount === 1 ? 'evento' : 'eventos'}
                </Badge>
              )}
            </button>
            <div className="grid grid-cols-7 text-center">
              {weekDays.map((day) => (
                <div key={day} className="text-[10px] text-muted-foreground pb-1">{day.charAt(0)}</div>
              ))}
              {monthDays.map((day) => {
                const inMonth = isSameMonth(day, month);
                const hasEvents = inMonth && eventDays.has(format(day, 'yyyy-MM-dd'));
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    disabled={!inMonth}
                    onClick={() => onAbrirDia(day)}
                    className={cn(
                      "relative h-7 text-xs rounded-full transition-colors",
                      !inMonth && "invisible",
                      inMonth && "hover:bg-muted",
                      isToday(day) && "bg-primary text-primary-foreground font-semibold hover:bg-primary"
                    )}
                  >
                    {format(day, 'd')}
                    {hasEvents && !isToday(day) && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
