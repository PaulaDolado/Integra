import { Calendar as CalendarIcon, Clock, MapPin, Lock } from "lucide-react";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { capitalize, type Event } from "./fechas";

interface PanelLateralProps {
  currentDate: Date;
  onCambiarFecha: (date: Date) => void;
  upcomingEvents: Event[];
  loadingUpcoming: boolean;
  onEditar: (event: Event) => void;
}

// Barra lateral: minicalendario y próximos eventos
export function PanelLateral({ currentDate, onCambiarFecha, upcomingEvents, loadingUpcoming, onEditar }: PanelLateralProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 content-start">
      <Card>
        <CardContent className="p-3 flex justify-center">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => date && onCambiarFecha(date)}
            month={currentDate}
            onMonthChange={onCambiarFecha}
            locale={es}
            weekStartsOn={1}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Próximos eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingUpcoming ? (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay eventos próximos</p>
            </div>
          ) : (
            <div className="space-y-1">
              {upcomingEvents.map((event) => {
                const start = new Date(event.fecha_inicio);
                return (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => onEditar(event)}
                    className="w-full flex items-start gap-3 p-2 -mx-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center w-11 h-11 shrink-0 rounded-lg bg-accent text-accent-foreground">
                      <span className="text-[10px] uppercase leading-none">
                        {format(start, 'MMM', { locale: es }).replace('.', '')}
                      </span>
                      <span className="text-base font-bold leading-tight">{format(start, 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-medium text-sm truncate">{event.titulo}</h3>
                        {event.es_privado && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isToday(start) ? 'Hoy' : capitalize(format(start, 'EEEE', { locale: es }))} · {format(start, 'HH:mm')} – {format(new Date(event.fecha_fin), 'HH:mm')}
                      </p>
                      {event.ubicacion && (
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{event.ubicacion}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
