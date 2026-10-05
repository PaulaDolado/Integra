import { useState, useEffect, useRef } from "react";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, CalendarSearch, CalendarSync } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import {
  HOUR_HEIGHT,
  JORNADA,
  SCROLL_TO_HOUR,
  desplazarFecha,
  duracion,
  getDaysToDisplay,
  getViewTitle,
  huecosLibres,
  minutosDe,
  type ViewType,
} from "@/components/calendario/fechas";
import { useEventos } from "@/components/calendario/useEventos";
import { useEditorEvento } from "@/components/calendario/useEditorEvento";
import { RejillaHoraria } from "@/components/calendario/RejillaHoraria";
import { VistaMes } from "@/components/calendario/VistaMes";
import { VistaAnio } from "@/components/calendario/VistaAnio";
import { PanelLateral } from "@/components/calendario/PanelLateral";
import { DialogosEvento } from "@/components/calendario/DialogosEvento";

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>('weekly');
  const [now, setNow] = useState(new Date());
  const timeGridRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { events, upcomingEvents, loadingUpcoming } = useEventos(viewType, currentDate);
  const editor = useEditorEvento();
  const { profile } = useEmployeeProfile();
  const [tiempoLibre, setTiempoLibre] = useState(false);

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

  const handleComingSoon = (feature: string) => {
    toast({
      title: "Próximamente",
      description: `${feature} estará disponible en una próxima versión.`,
    });
  };

  const openDay = (day: Date) => {
    setCurrentDate(day);
    setViewType('daily');
  };

  const openMonth = (month: Date) => {
    setCurrentDate(month);
    setViewType('monthly');
  };

  const daysToDisplay = getDaysToDisplay(viewType, currentDate);
  const vistaHoraria = viewType === 'daily' || viewType === 'weekly';

  // El tiempo libre se ve en la rejilla horaria: desde el mes o el año se pasa a la semana
  const alternarTiempoLibre = () => {
    if (!tiempoLibre && !vistaHoraria) setViewType('weekly');
    setTiempoLibre(!tiempoLibre);
  };
  const huecosDe = (day: Date) => huecosLibres(events, day, profile?.id ?? null, now);
  const huecosVisibles = tiempoLibre && vistaHoraria ? daysToDisplay.flatMap(huecosDe) : [];
  const minutosLibres = huecosVisibles.reduce((total, hueco) => total + minutosDe(hueco), 0);

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
          <Button
            variant={tiempoLibre ? "secondary" : "outline"}
            className="gap-2"
            onClick={alternarTiempoLibre}
            aria-pressed={tiempoLibre}
          >
            <CalendarSearch className="w-4 h-4" />
            {tiempoLibre ? "Ocultar tiempo libre" : "Mostrar tiempo libre"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleComingSoon("La integración con Google Calendar")}>
            <CalendarSync className="w-4 h-4" />
            Google Calendar
          </Button>
          <Button className="gap-2" onClick={() => editor.openCreateEvent()}>
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
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(desplazarFecha(viewType, currentDate, -1))} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(desplazarFecha(viewType, currentDate, 1))} aria-label="Siguiente">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-lg sm:text-xl truncate">
                {getViewTitle(viewType, currentDate)}
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
            {tiempoLibre && vistaHoraria && (
              <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                {huecosVisibles.length === 0
                  ? `No te queda tiempo libre ${viewType === 'daily' ? 'este día' : 'esta semana'} en la jornada (de ${JORNADA.inicio}:00 a ${JORNADA.fin}:00).`
                  : `${duracion(minutosLibres)} libres en ${huecosVisibles.length} ${huecosVisibles.length === 1 ? 'hueco' : 'huecos'}, de ${JORNADA.inicio}:00 a ${JORNADA.fin}:00. Pulsa uno para crear un evento.`}
              </p>
            )}
            {vistaHoraria && (
              <RejillaHoraria
                days={daysToDisplay}
                events={events}
                now={now}
                contenedorRef={timeGridRef}
                onCrear={editor.openCreateEvent}
                onEditar={editor.handleEditEvent}
                onAbrirDia={openDay}
                huecosDe={tiempoLibre ? huecosDe : undefined}
              />
            )}
            {viewType === 'monthly' && (
              <VistaMes
                days={daysToDisplay}
                currentDate={currentDate}
                events={events}
                onCrear={editor.openCreateEvent}
                onEditar={editor.handleEditEvent}
                onAbrirDia={openDay}
              />
            )}
            {viewType === 'yearly' && (
              <VistaAnio months={daysToDisplay} events={events} onAbrirMes={openMonth} onAbrirDia={openDay} />
            )}
          </CardContent>
        </Card>

        <PanelLateral
          currentDate={currentDate}
          onCambiarFecha={setCurrentDate}
          upcomingEvents={upcomingEvents}
          loadingUpcoming={loadingUpcoming}
          onEditar={editor.handleEditEvent}
        />
      </div>

      <DialogosEvento editor={editor} />
    </div>
  );
}
