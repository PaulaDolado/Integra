import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { Link } from "react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

type CalendarView = "dia" | "semana" | "mes" | "agenda";

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "agenda", label: "Agenda" },
];

const VIEW_STORAGE_KEY = "integra:calendar-view";
const AGENDA_DAYS = 30;
const MONTH_MAX_EVENTS = 2;
const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEK_OPTIONS = { weekStartsOn: 1 as const };

interface Event {
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
}

const getEventColor = () => {
  return "bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/20 transition-colors";
};

const getStoredView = (): CalendarView => {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.some((v) => v.value === stored) ? (stored as CalendarView) : "semana";
  } catch {
    return "semana";
  }
};

const getRange = (view: CalendarView, anchor: Date) => {
  switch (view) {
    case "dia":
      return { start: startOfDay(anchor), end: endOfDay(anchor) };
    case "mes":
      return {
        start: startOfWeek(startOfMonth(anchor), WEEK_OPTIONS),
        end: endOfWeek(endOfMonth(anchor), WEEK_OPTIONS),
      };
    case "agenda":
      return { start: startOfDay(anchor), end: endOfDay(addDays(anchor, AGENDA_DAYS - 1)) };
    default:
      return { start: startOfWeek(anchor, WEEK_OPTIONS), end: endOfWeek(anchor, WEEK_OPTIONS) };
  }
};

const shiftAnchor = (view: CalendarView, anchor: Date, direction: 1 | -1) => {
  switch (view) {
    case "dia":
      return addDays(anchor, direction);
    case "mes":
      return addMonths(anchor, direction);
    case "agenda":
      return addDays(anchor, direction * AGENDA_DAYS);
    default:
      return addWeeks(anchor, direction);
  }
};

const getRangeLabel = (view: CalendarView, anchor: Date, start: Date, end: Date) => {
  switch (view) {
    case "dia":
      return format(anchor, "EEEE, d 'de' MMMM yyyy", { locale: es });
    case "mes":
      return format(anchor, "MMMM yyyy", { locale: es });
    default:
      return `${format(start, "d MMM", { locale: es })} – ${format(end, "d MMM yyyy", { locale: es })}`;
  }
};

const formatTimeRange = (event: Event) =>
  `${format(new Date(event.fecha_inicio), "HH:mm")} – ${format(new Date(event.fecha_fin), "HH:mm")}`;

export function CalendarWidget() {
  const [view, setView] = useState<CalendarView>(getStoredView);
  const [anchor, setAnchor] = useState(() => new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    descripcion: "",
    fecha_inicio: "",
    fecha_fin: "",
    ubicacion: "",
    es_privado: false,
  });
  const { user } = useAuth();
  const { empleadoId, loading: cargandoEmpleado } = useMiEmpleadoId();
  const queryClient = useQueryClient();

  const { start: rangeStart, end: rangeEnd } = getRange(view, anchor);

  // Solo trae algunas columnas: su clave no coincide con las del Calendario,
  // pero comparte el prefijo "eventos" para invalidarse a la vez
  const { data: events = [], isPending: loading } = useQuery({
    queryKey: ["eventos", "resumen", rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () =>
      comprobar(
        await supabase
          .from("eventos")
          .select("id, titulo, fecha_inicio, fecha_fin")
          .lte("fecha_inicio", rangeEnd.toISOString())
          .gte("fecha_fin", rangeStart.toISOString())
          .order("fecha_inicio", { ascending: true })
      ) ?? [],
    // Mientras llegan los del nuevo periodo se siguen viendo los anteriores
    placeholderData: keepPreviousData,
  });

  useInvalidarEnCambios("events-changes", [{ table: "eventos" }], [["eventos"]]);

  const handleViewChange = (value: string) => {
    if (!VIEWS.some((v) => v.value === value)) return;
    setView(value as CalendarView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, value);
    } catch {
      // Sin almacenamiento disponible: la vista se mantiene solo en esta sesión
    }
  };

  const openDay = (date: Date) => {
    setAnchor(date);
    handleViewChange("dia");
  };

  const handleCreateEvent = async () => {
    if (!formData.titulo || !formData.fecha_inicio || !formData.fecha_fin) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    // creador_id apunta a empleados, no al usuario de autenticación
    if (!empleadoId) {
      toast({
        title: "Error",
        description: "Tu usuario no tiene un perfil de empleado asociado",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.from("eventos").insert({
      titulo: formData.titulo,
      descripcion: formData.descripcion,
      fecha_inicio: formData.fecha_inicio,
      fecha_fin: formData.fecha_fin,
      ubicacion: formData.ubicacion,
      es_privado: formData.es_privado,
      creador_id: empleadoId,
    });

    if (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el evento",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Éxito",
      description: "Evento creado correctamente",
    });

    setIsCreateDialogOpen(false);
    setFormData({
      titulo: "",
      descripcion: "",
      fecha_inicio: "",
      fecha_fin: "",
      ubicacion: "",
      es_privado: false,
    });
    queryClient.invalidateQueries({ queryKey: ["eventos"] });
  };

  const today = new Date();

  const getEventsForDate = (date: Date) => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    return events.filter((event) => {
      const eventStart = new Date(event.fecha_inicio);
      const eventEnd = new Date(event.fecha_fin);
      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
  };

  const renderEvent = (event: Event, showTime = false) => (
    <Link
      key={event.id}
      to="/calendario"
      className={`block p-2 rounded-md text-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${getEventColor()}`}
    >
      <span className="block font-medium truncate">{event.titulo}</span>
      {showTime && <span className="block opacity-80">{formatTimeRange(event)}</span>}
    </Link>
  );

  const renderWeek = () => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, index) => {
          const dayEvents = getEventsForDate(date);
          const isToday = isSameDay(date, today);

          return (
            <div key={index} className="space-y-2">
              <button
                type="button"
                onClick={() => openDay(date)}
                className={`w-full text-center p-2 rounded-lg border transition-colors ${
                  isToday
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 border-border hover:bg-muted"
                }`}
              >
                <div className="text-xs font-medium">{weekDays[index]}</div>
                <div className={`text-lg font-bold ${isToday ? "text-primary-foreground" : "text-foreground"}`}>
                  {date.getDate()}
                </div>
              </button>

              <div className="space-y-1 min-h-[120px]">
                {loading ? (
                  <div className="text-xs text-muted-foreground">Cargando...</div>
                ) : (
                  dayEvents.map((event) => renderEvent(event))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dayEvents = getEventsForDate(anchor);
    return (
      <div className="space-y-2 min-h-[160px]">
        {loading ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : dayEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No hay eventos este día</p>
        ) : (
          dayEvents.map((event) => renderEvent(event, true))
        )}
      </div>
    );
  };

  const renderMonth = () => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date) => {
            const dayEvents = getEventsForDate(date);
            const isToday = isSameDay(date, today);
            const inMonth = isSameMonth(date, anchor);

            return (
              <button
                type="button"
                key={date.toISOString()}
                onClick={() => openDay(date)}
                className={`min-h-[84px] rounded-md border p-1 text-left align-top transition-colors hover:bg-accent/50 ${
                  inMonth ? "border-border" : "border-transparent bg-muted/30 text-muted-foreground"
                }`}
              >
                <div
                  className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? "bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, MONTH_MAX_EVENTS).map((event) => (
                    <div key={event.id} className={`truncate rounded px-1 py-0.5 text-[11px] ${getEventColor()}`}>
                      {event.titulo}
                    </div>
                  ))}
                  {dayEvents.length > MONTH_MAX_EVENTS && (
                    <div className="px-1 text-[11px] text-muted-foreground">
                      +{dayEvents.length - MONTH_MAX_EVENTS} más
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAgenda = () => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
      .map((date) => ({ date, dayEvents: getEventsForDate(date) }))
      .filter(({ dayEvents }) => dayEvents.length > 0);

    if (loading) return <div className="text-sm text-muted-foreground">Cargando...</div>;
    if (days.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-10">
          No hay eventos en los próximos {AGENDA_DAYS} días
        </p>
      );
    }

    return (
      <div className="divide-y divide-border">
        {days.map(({ date, dayEvents }) => (
          <div key={date.toISOString()} className="flex gap-4 py-3 first:pt-0 last:pb-0">
            <button
              type="button"
              onClick={() => openDay(date)}
              className={`w-24 shrink-0 text-left text-sm ${isSameDay(date, today) ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <div className="capitalize">{format(date, "EEE d", { locale: es })}</div>
              <div className="text-xs">{format(date, "MMMM", { locale: es })}</div>
            </button>
            <div className="flex-1 space-y-1">{dayEvents.map((event) => renderEvent(event, true))}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Calendario</CardTitle>
          </div>
          <Button
            size="icon"
            className="h-8 w-8"
            aria-label="Nuevo evento"
            title="Nuevo evento"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={handleViewChange}
            aria-label="Vista del calendario"
          >
            {VIEWS.map((v) => (
              <ToggleGroupItem key={v.value} value={v.value} className="px-2.5 text-xs">
                {v.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Periodo anterior"
              onClick={() => setAnchor(shiftAnchor(view, anchor, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAnchor(new Date())}>
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Periodo siguiente"
              onClick={() => setAnchor(shiftAnchor(view, anchor, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm font-medium px-1 first-letter:uppercase">
            {getRangeLabel(view, anchor, rangeStart, rangeEnd)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {view === "dia" && renderDay()}
        {view === "semana" && renderWeek()}
        {view === "mes" && renderMonth()}
        {view === "agenda" && renderAgenda()}
      </CardContent>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Título del evento"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del evento"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha Inicio *</Label>
                <Input
                  id="fecha_inicio"
                  type="datetime-local"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha Fin *</Label>
                <Input
                  id="fecha_fin"
                  type="datetime-local"
                  value={formData.fecha_fin}
                  onChange={(e) => setFormData({ ...formData, fecha_fin: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                value={formData.ubicacion}
                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ubicación del evento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEvent} disabled={cargandoEmpleado}>
              Crear Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
