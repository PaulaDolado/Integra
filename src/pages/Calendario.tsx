import { useState, useEffect, useRef } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin, Lock, CalendarSearch, CalendarSync } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears, addHours, isSameMonth, isToday, startOfDay, endOfDay, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Event {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
  es_privado: boolean;
  creador_id: string;
}

interface EventFormData {
  titulo: string;
  descripcion: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string;
  es_privado: boolean;
}

interface PositionedEvent {
  event: Event;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

type ViewType = 'daily' | 'weekly' | 'monthly' | 'yearly';

const getViewRange = (viewType: ViewType, currentDate: Date) => {
  switch (viewType) {
    case 'daily':
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case 'weekly':
      return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    case 'monthly':
      return {
        start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
      };
    case 'yearly':
      return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
  }
};

const HOUR_HEIGHT = 48; // px por hora en las vistas de día y semana
const MIN_EVENT_HEIGHT = 22;
const SCROLL_TO_HOUR = 7; // la rejilla horaria se abre centrada en la jornada laboral
const MONTH_EVENTS_VISIBLE = 3;

const EMPTY_FORM: EventFormData = {
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  ubicacion: '',
  es_privado: false
};

const hours = Array.from({ length: 24 }, (_, i) => i);
const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const toInputValue = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm");

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Coloca los eventos de un día en la rejilla horaria. Los que se solapan
// se reparten en carriles para que no queden uno encima de otro.
const layoutDayEvents = (dayEvents: Event[], day: Date): PositionedEvent[] => {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();

  const segments = dayEvents
    .map(event => ({
      event,
      start: Math.max(new Date(event.fecha_inicio).getTime(), dayStart),
      end: Math.min(new Date(event.fecha_fin).getTime(), dayEnd),
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedEvent[] = [];
  let cluster: (PositionedEvent & { end: number })[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    cluster.forEach(item => {
      const { end: _end, ...positioned } = item;
      result.push({ ...positioned, lanes: laneEnds.length });
    });
    cluster = [];
    laneEnds = [];
  };

  segments.forEach(({ event, start, end }) => {
    if (start >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = cluster.length === 0 ? end : Math.max(clusterEnd, end);

    const top = ((start - dayStart) / 3_600_000) * HOUR_HEIGHT;
    const height = Math.max(((end - start) / 3_600_000) * HOUR_HEIGHT, MIN_EVENT_HEIGHT);
    cluster.push({ event, top, height, lane, lanes: 1, end });
  });
  closeCluster();

  return result;
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('weekly');
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [now, setNow] = useState(new Date());
  const timeGridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useEmployeeProfile();
  const queryClient = useQueryClient();

  const [eventForm, setEventForm] = useState<EventFormData>(EMPTY_FORM);

  // La clave depende del rango visible, no del día elegido: moverse dentro
  // de la misma semana o mes no vuelve a pedir los eventos
  const { start: rangeStart, end: rangeEnd } = getViewRange(viewType, currentDate);
  const { data: events = [], isPending: loading, error } = useQuery({
    queryKey: ['eventos', rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () =>
      comprobar(
        await supabase
          .from('eventos')
          .select('*')
          .lte('fecha_inicio', rangeEnd.toISOString())
          .gte('fecha_fin', rangeStart.toISOString())
          .order('fecha_inicio', { ascending: true })
      ) ?? [],
    // Mientras llegan los del nuevo rango se siguen viendo los anteriores
    placeholderData: keepPreviousData,
  });
  useAvisarError(error, "No se pudieron cargar los eventos");

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['eventos', 'proximos'],
    queryFn: async () =>
      comprobar(
        await supabase
          .from('eventos')
          .select('*')
          .gte('fecha_fin', new Date().toISOString())
          .order('fecha_inicio', { ascending: true })
          .limit(5)
      ) ?? [],
  });

  useInvalidarEnCambios('calendario-page-changes', [{ table: 'eventos' }], [['eventos']]);

  // Mantiene al día la línea de la hora actual
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Al cambiar a una vista horaria, desplaza la rejilla hasta el inicio de la jornada
  useEffect(() => {
    if (timeGridRef.current) {
      timeGridRef.current.scrollTop = SCROLL_TO_HOUR * HOUR_HEIGHT;
    }
  }, [viewType]);

  const openCreateEvent = (start?: Date) => {
    const inicio = start ?? addHours(startOfDay(new Date()), new Date().getHours() + 1);
    setEventForm({
      ...EMPTY_FORM,
      fecha_inicio: toInputValue(inicio),
      fecha_fin: toInputValue(addHours(inicio, 1)),
    });
    setIsCreateEventOpen(true);
  };

  const handleComingSoon = (feature: string) => {
    toast({
      title: "Próximamente",
      description: `${feature} estará disponible en una próxima versión.`,
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: "Sesión requerida", description: "Inicia sesión para crear eventos", variant: "destructive" });
      return;
    }
    if (!profile) {
      toast({ title: "Perfil de empleado no encontrado", description: "Crea tu perfil de empleado para poder crear eventos", variant: "destructive" });
      return;
    }
    const inicio = new Date(eventForm.fecha_inicio);
    const fin = new Date(eventForm.fecha_fin);
    if (!(eventForm.titulo && eventForm.fecha_inicio && eventForm.fecha_fin) || isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio >= fin) {
      toast({ title: "Datos no válidos", description: "Revisa título y que la fecha fin sea posterior al inicio", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('eventos')
        .insert([
          {
            ...eventForm,
            creador_id: profile.id,
            fecha_inicio: inicio.toISOString(),
            fecha_fin: fin.toISOString(),
          }
        ]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento creado",
          description: "El evento se ha creado exitosamente",
        });
        setIsCreateEventOpen(false);
        setEventForm(EMPTY_FORM);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEventForm({
      titulo: event.titulo,
      descripcion: event.descripcion || '',
      fecha_inicio: toInputValue(new Date(event.fecha_inicio)),
      fecha_fin: toInputValue(new Date(event.fecha_fin)),
      ubicacion: event.ubicacion || '',
      es_privado: event.es_privado
    });
    setIsEditEventOpen(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !profile) return;

    const inicio = new Date(eventForm.fecha_inicio);
    const fin = new Date(eventForm.fecha_fin);
    if (!(eventForm.titulo && eventForm.fecha_inicio && eventForm.fecha_fin) || isNaN(inicio.getTime()) || isNaN(fin.getTime()) || inicio >= fin) {
      toast({ title: "Datos no válidos", description: "Revisa título y que la fecha fin sea posterior al inicio", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('eventos')
        .update({
          titulo: eventForm.titulo,
          descripcion: eventForm.descripcion,
          fecha_inicio: inicio.toISOString(),
          fecha_fin: fin.toISOString(),
          ubicacion: eventForm.ubicacion,
          es_privado: eventForm.es_privado,
        })
        .eq('id', selectedEvent.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento actualizado",
          description: "El evento se ha actualizado exitosamente",
        });
        setIsEditEventOpen(false);
        setSelectedEvent(null);
        setEventForm(EMPTY_FORM);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error updating event:', error);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const { error } = await supabase
        .from('eventos')
        .delete()
        .eq('id', selectedEvent.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento eliminado",
          description: "El evento se ha eliminado exitosamente",
        });
        setIsEditEventOpen(false);
        setSelectedEvent(null);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const navigatePrevious = () => {
    switch (viewType) {
      case 'daily':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'weekly':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'monthly':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'yearly':
        setCurrentDate(subYears(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (viewType) {
      case 'daily':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'weekly':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'monthly':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'yearly':
        setCurrentDate(addYears(currentDate, 1));
        break;
    }
  };

  const openDay = (day: Date) => {
    setCurrentDate(day);
    setViewType('daily');
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'daily':
        return capitalize(format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es }));
      case 'weekly': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
      }
      case 'monthly':
        return capitalize(format(currentDate, 'MMMM yyyy', { locale: es }));
      case 'yearly':
        return format(currentDate, 'yyyy');
    }
  };

  const getDaysToDisplay = () => {
    switch (viewType) {
      case 'daily':
        return [currentDate];
      case 'weekly': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
      }
      case 'monthly': {
        const { start, end } = getViewRange(viewType, currentDate);
        const monthDays = [];
        let day = start;
        while (day <= end) {
          monthDays.push(day);
          day = addDays(day, 1);
        }
        return monthDays;
      }
      case 'yearly':
        return Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(currentDate), i));
    }
  };

  const getEventsForDay = (date: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    return events.filter(event => {
      const eventStart = new Date(event.fecha_inicio);
      const eventEnd = new Date(event.fecha_fin);
      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
  };

  const daysToDisplay = getDaysToDisplay();
  const nowTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;

  const renderEventFields = (prefix: string) => (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}titulo`}>Título del evento</Label>
        <Input
          id={`${prefix}titulo`}
          value={eventForm.titulo}
          onChange={(e) => setEventForm({ ...eventForm, titulo: e.target.value })}
          placeholder="Ingrese el título del evento"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}descripcion`}>Descripción</Label>
        <Textarea
          id={`${prefix}descripcion`}
          value={eventForm.descripcion}
          onChange={(e) => setEventForm({ ...eventForm, descripcion: e.target.value })}
          placeholder="Describe el evento..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}fecha_inicio`}>Inicio</Label>
          <Input
            id={`${prefix}fecha_inicio`}
            type="datetime-local"
            value={eventForm.fecha_inicio}
            onChange={(e) => setEventForm({ ...eventForm, fecha_inicio: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${prefix}fecha_fin`}>Fin</Label>
          <Input
            id={`${prefix}fecha_fin`}
            type="datetime-local"
            value={eventForm.fecha_fin}
            onChange={(e) => setEventForm({ ...eventForm, fecha_fin: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}ubicacion`}>Ubicación (opcional)</Label>
        <Input
          id={`${prefix}ubicacion`}
          value={eventForm.ubicacion}
          onChange={(e) => setEventForm({ ...eventForm, ubicacion: e.target.value })}
          placeholder="Ubicación del evento"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={`${prefix}es_privado`}
          checked={eventForm.es_privado}
          onChange={(e) => setEventForm({ ...eventForm, es_privado: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor={`${prefix}es_privado`}>Evento privado</Label>
      </div>
    </>
  );

  // Rejilla horaria compartida por las vistas de día y semana
  const renderTimeGrid = (days: Date[]) => (
    <div
      ref={timeGridRef}
      className="border rounded-lg overflow-auto max-h-[calc(100vh-18rem)] min-h-[420px]"
    >
      <div className={cn(days.length > 1 && "min-w-[640px]")}>
        {/* Cabecera de días */}
        <div className="flex border-b bg-card sticky top-0 z-20">
          <div className="w-14 shrink-0 border-r" />
          {days.map((day) => {
            const isDayToday = isToday(day);
            return (
              <button
                type="button"
                key={day.toISOString()}
                onClick={() => days.length > 1 && openDay(day)}
                className={cn(
                  "flex-1 min-w-0 flex items-center justify-center gap-2 py-2 border-r last:border-r-0",
                  days.length > 1 && "hover:bg-muted/50 transition-colors cursor-pointer",
                  days.length === 1 && "cursor-default"
                )}
              >
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
              </button>
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
            const positioned = layoutDayEvents(getEventsForDay(day), day);

            return (
              <div
                key={day.toISOString()}
                className={cn("flex-1 min-w-0 relative border-r last:border-r-0", isDayToday && "bg-primary/3")}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => openCreateEvent(addHours(startOfDay(day), hour))}
                    title="Crear evento"
                  />
                ))}

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
                        onClick={() => handleEditEvent(event)}
                        className="w-full h-full text-left rounded-md border-l-[3px] border-primary bg-accent text-accent-foreground px-2 py-1 overflow-hidden shadow-sm hover:brightness-95 transition"
                      >
                        <div className={cn("flex items-center gap-1 font-medium truncate", compact ? "text-[11px]" : "text-xs")}>
                          {event.es_privado && <Lock className="w-3 h-3 shrink-0" />}
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

  const renderMonthView = () => (
    <div className="border rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium uppercase text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {daysToDisplay.map((day) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isDayToday = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[96px] sm:min-h-[112px] p-1.5 border-b border-r nth-[7n]:border-r-0 cursor-pointer transition-colors hover:bg-muted/40",
                !isCurrentMonth && "bg-muted/20"
              )}
              onClick={() => openCreateEvent(addHours(startOfDay(day), 9))}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDay(day);
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
                      handleEditEvent(event);
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
                      openDay(day);
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

  const renderYearView = () => {
    const eventDays = new Set<string>();
    events.forEach(event => {
      let day = startOfDay(new Date(event.fecha_inicio));
      const end = new Date(event.fecha_fin);
      while (day <= end) {
        eventDays.add(format(day, 'yyyy-MM-dd'));
        day = addDays(day, 1);
      }
    });

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {daysToDisplay.map((month) => {
          const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
          const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
          const monthDays = [];
          for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
            monthDays.push(day);
          }
          const monthEventCount = events.filter(event => isSameMonth(new Date(event.fecha_inicio), month)).length;

          return (
            <div key={month.toISOString()} className="border rounded-lg p-3">
              <button
                type="button"
                className="w-full flex items-center justify-between mb-2 hover:text-primary transition-colors"
                onClick={() => {
                  setCurrentDate(month);
                  setViewType('monthly');
                }}
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
                      onClick={() => openDay(day)}
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
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Cabecera de la página */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Calendario
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus eventos, reuniones y recordatorios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => handleComingSoon("Mostrar tiempo libre")}>
            <CalendarSearch className="w-4 h-4" />
            Mostrar tiempo libre
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleComingSoon("La integración con Google Calendar")}>
            <CalendarSync className="w-4 h-4" />
            Google Calendar
          </Button>
          <Button className="gap-2" onClick={() => openCreateEvent()}>
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
        {/* Vista del calendario */}
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                Hoy
              </Button>
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrevious} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext} aria-label="Siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg sm:text-xl truncate">
                {getViewTitle()}
              </CardTitle>
            </div>

            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={viewType}
              onValueChange={(value) => value && setViewType(value as ViewType)}
              className="justify-start"
            >
              <ToggleGroupItem value="daily" aria-label="Vista diaria">Día</ToggleGroupItem>
              <ToggleGroupItem value="weekly" aria-label="Vista semanal">Semana</ToggleGroupItem>
              <ToggleGroupItem value="monthly" aria-label="Vista mensual">Mes</ToggleGroupItem>
              <ToggleGroupItem value="yearly" aria-label="Vista anual">Año</ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>
          <CardContent>
            {(viewType === 'daily' || viewType === 'weekly') && renderTimeGrid(daysToDisplay)}
            {viewType === 'monthly' && renderMonthView()}
            {viewType === 'yearly' && renderYearView()}
          </CardContent>
        </Card>

        {/* Barra lateral */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 content-start">
          <Card>
            <CardContent className="p-3 flex justify-center">
              <Calendar
                mode="single"
                selected={currentDate}
                onSelect={(date) => date && setCurrentDate(date)}
                month={currentDate}
                onMonthChange={setCurrentDate}
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
              {loading ? (
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
                        onClick={() => handleEditEvent(event)}
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
                            <h4 className="font-medium text-sm truncate">{event.titulo}</h4>
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
      </div>

      <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            {renderEventFields('')}
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateEventOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Crear Evento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEvent} className="space-y-4">
            {renderEventFields('edit-')}
            <div className="flex justify-between pt-4">
              <Button type="button" variant="destructive" onClick={handleDeleteEvent}>
                Eliminar
              </Button>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditEventOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
