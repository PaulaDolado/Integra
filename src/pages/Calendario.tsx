import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin, Users, Edit, Trash2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, addWeeks, subWeeks, addYears, subYears, isSameMonth, isSameDay, isToday, startOfDay, endOfDay, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Event {
  id: string;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion?: string;
  es_privado: boolean;
  creador_id: string;
}

type ViewType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('weekly');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();
  const { user } = useAuth();

  // Form state
  const [eventForm, setEventForm] = useState({
    titulo: '',
    descripcion: '',
    fecha_inicio: '',
    fecha_fin: '',
    ubicacion: '',
    es_privado: false
  });

  useEffect(() => {
    fetchEvents();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('calendario-page-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eventos'
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDate, viewType]);

  const fetchEvents = async () => {
    try {
      let startDate: Date;
      let endDate: Date;

      switch (viewType) {
        case 'daily':
          startDate = startOfDay(currentDate);
          endDate = endOfDay(currentDate);
          break;
        case 'weekly':
          startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
          endDate = endOfWeek(currentDate, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(currentDate);
          endDate = endOfMonth(currentDate);
          break;
        case 'yearly':
          startDate = startOfYear(currentDate);
          endDate = endOfYear(currentDate);
          break;
      }

      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .lte('fecha_inicio', endDate.toISOString())
        .gte('fecha_fin', startDate.toISOString())
        .order('fecha_inicio', { ascending: true });

      if (error) {
        console.error('Error fetching events:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los eventos",
          variant: "destructive",
        });
      } else {
        setEvents(data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const { error } = await supabase
        .from('eventos')
        .insert([
          {
            ...eventForm,
            creador_id: user.id,
            fecha_inicio: new Date(eventForm.fecha_inicio).toISOString(),
            fecha_fin: new Date(eventForm.fecha_fin).toISOString(),
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
        setEventForm({
          titulo: '',
          descripcion: '',
          fecha_inicio: '',
          fecha_fin: '',
          ubicacion: '',
          es_privado: false
        });
        fetchEvents();
      }
    } catch (error) {
      console.error('Error creating event:', error);
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

  const getViewTitle = () => {
    switch (viewType) {
      case 'daily':
        return format(currentDate, "d 'de' MMMM yyyy", { locale: es });
      case 'weekly':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `${format(weekStart, 'd MMM', { locale: es })} - ${format(weekEnd, 'd MMM yyyy', { locale: es })}`;
      case 'monthly':
        return format(currentDate, 'MMMM yyyy', { locale: es });
      case 'yearly':
        return format(currentDate, 'yyyy');
    }
  };

  const getDaysToDisplay = () => {
    switch (viewType) {
      case 'daily':
        return [currentDate];
      case 'weekly':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = [];
        for (let i = 0; i < 7; i++) {
          days.push(addDays(weekStart, i));
        }
        return days;
      case 'monthly':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const monthDays = [];
        let day = calendarStart;
        while (day <= calendarEnd) {
          monthDays.push(day);
          day = addDays(day, 1);
        }
        return monthDays;
      case 'yearly':
        const yearMonths = [];
        for (let i = 0; i < 12; i++) {
          yearMonths.push(addMonths(startOfYear(currentDate), i));
        }
        return yearMonths;
    }
  };

  const getEventsForDay = (date: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.fecha_inicio);
      const eventEnd = new Date(event.fecha_fin);
      return date >= eventStart && date <= eventEnd;
    });
  };

  const daysToDisplay = getDaysToDisplay();
  const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-primary" />
            Calendario
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus eventos, reuniones y recordatorios.
          </p>
        </div>
        
        <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Evento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título del evento</Label>
                <Input
                  id="titulo"
                  value={eventForm.titulo}
                  onChange={(e) => setEventForm({ ...eventForm, titulo: e.target.value })}
                  placeholder="Ingrese el título del evento"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={eventForm.descripcion}
                  onChange={(e) => setEventForm({ ...eventForm, descripcion: e.target.value })}
                  placeholder="Describe el evento..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio">Fecha y hora de inicio</Label>
                  <Input
                    id="fecha_inicio"
                    type="datetime-local"
                    value={eventForm.fecha_inicio}
                    onChange={(e) => setEventForm({ ...eventForm, fecha_inicio: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fecha_fin">Fecha y hora de fin</Label>
                  <Input
                    id="fecha_fin"
                    type="datetime-local"
                    value={eventForm.fecha_fin}
                    onChange={(e) => setEventForm({ ...eventForm, fecha_fin: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ubicacion">Ubicación (opcional)</Label>
                <Input
                  id="ubicacion"
                  value={eventForm.ubicacion}
                  onChange={(e) => setEventForm({ ...eventForm, ubicacion: e.target.value })}
                  placeholder="Ubicación del evento"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="es_privado"
                  checked={eventForm.es_privado}
                  onChange={(e) => setEventForm({ ...eventForm, es_privado: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="es_privado">Evento privado</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateEventOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  Crear Evento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar View */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl">
                {getViewTitle()}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <ToggleGroup type="single" value={viewType} onValueChange={(value) => value && setViewType(value as ViewType)}>
                  <ToggleGroupItem value="daily" aria-label="Vista diaria">
                    Día
                  </ToggleGroupItem>
                  <ToggleGroupItem value="weekly" aria-label="Vista semanal">
                    Semana
                  </ToggleGroupItem>
                  <ToggleGroupItem value="monthly" aria-label="Vista mensual">
                    Mes
                  </ToggleGroupItem>
                  <ToggleGroupItem value="yearly" aria-label="Vista anual">
                    Año
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="icon" onClick={navigatePrevious}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={navigateNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {viewType === 'daily' && (
                <div className="space-y-4">
                  <div className="text-center py-4 border rounded-lg bg-muted/20">
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {format(currentDate, 'd')}
                    </h3>
                    <p className="text-muted-foreground">
                      {format(currentDate, "EEEE, MMMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {getEventsForDay(currentDate).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay eventos para este día</p>
                      </div>
                    ) : (
                      getEventsForDay(currentDate).map((event) => (
                        <div
                          key={event.id}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <h4 className="font-medium">{event.titulo}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(event.fecha_inicio), 'HH:mm', { locale: es })} - {format(new Date(event.fecha_fin), 'HH:mm', { locale: es })}
                          </p>
                          {event.descripcion && (
                            <p className="text-sm text-muted-foreground mt-2">{event.descripcion}</p>
                          )}
                          {event.ubicacion && (
                            <div className="flex items-center gap-1 mt-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{event.ubicacion}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {viewType === 'weekly' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="text-center text-sm font-medium text-muted-foreground p-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {daysToDisplay.map((day, index) => {
                      const dayEvents = getEventsForDay(day);
                      const isDayToday = isToday(day);
                      
                      return (
                        <div
                          key={index}
                          className={cn(
                            "min-h-[150px] p-3 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
                            isDayToday && "bg-primary/10 border-primary",
                            "bg-background"
                          )}
                          onClick={() => setSelectedDate(day)}
                        >
                          <div className={cn(
                            "text-center text-lg font-bold mb-2",
                            isDayToday && "text-primary"
                          )}>
                            {format(day, 'd')}
                          </div>
                          
                          <div className="space-y-1">
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className="text-xs p-1.5 bg-primary/20 text-primary rounded truncate"
                              >
                                <div className="font-medium">{event.titulo}</div>
                                <div className="opacity-75">{format(new Date(event.fecha_inicio), 'HH:mm', { locale: es })}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {viewType === 'monthly' && (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="text-center text-sm font-medium text-muted-foreground p-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {daysToDisplay.map((day, index) => {
                      const dayEvents = getEventsForDay(day);
                      const isCurrentMonth = isSameMonth(day, currentDate);
                      const isDayToday = isToday(day);
                      
                      return (
                        <div
                          key={index}
                          className={cn(
                            "min-h-[100px] p-2 border rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
                            !isCurrentMonth && "text-muted-foreground bg-muted/20",
                            isDayToday && "bg-primary/10 border-primary",
                            isCurrentMonth && "bg-background"
                          )}
                          onClick={() => setSelectedDate(day)}
                        >
                          <div className={cn(
                            "text-sm font-medium mb-1",
                            isDayToday && "text-primary font-bold"
                          )}>
                            {format(day, 'd')}
                          </div>
                          
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className="text-xs p-1 bg-primary/20 text-primary rounded truncate"
                              >
                                {event.titulo}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayEvents.length - 2} más
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {viewType === 'yearly' && (
                <div className="grid grid-cols-3 gap-4">
                  {daysToDisplay.map((month, index) => {
                    const monthEvents = events.filter(event => {
                      const eventDate = new Date(event.fecha_inicio);
                      return eventDate.getMonth() === month.getMonth();
                    });
                    
                    return (
                      <div
                        key={index}
                        className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setCurrentDate(month);
                          setViewType('monthly');
                        }}
                      >
                        <h3 className="font-semibold text-center mb-2">
                          {format(month, 'MMMM', { locale: es })}
                        </h3>
                        <div className="text-center text-2xl font-bold text-primary">
                          {monthEvents.length}
                        </div>
                        <div className="text-center text-xs text-muted-foreground">
                          {monthEvents.length === 1 ? 'evento' : 'eventos'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Próximos Eventos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay eventos programados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{event.titulo}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(event.fecha_inicio), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </p>
                          {event.ubicacion && (
                            <div className="flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">{event.ubicacion}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {event.es_privado && (
                            <Badge variant="secondary" className="text-xs">
                              Privado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mini Calendar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vista Rápida</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}