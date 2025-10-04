import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const currentDate = new Date();
const currentWeekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1));

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface Event {
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
}

const getEventColor = () => {
  return "bg-primary/10 text-primary border-l-2 border-primary hover:bg-primary/20 transition-colors";
};

export function CalendarWidget() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('events-changes')
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
  }, []);

  const fetchEvents = async () => {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data, error } = await supabase
      .from("eventos")
      .select("id, titulo, fecha_inicio, fecha_fin")
      .gte("fecha_inicio", currentWeekStart.toISOString())
      .lt("fecha_inicio", weekEnd.toISOString())
      .order("fecha_inicio", { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const today = new Date().toDateString();

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.fecha_inicio);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold">Calendario Semanal</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium px-3">
            {currentWeekStart.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button 
            size="sm" 
            className="gap-2 ml-2"
            onClick={() => navigate("/calendario")}
          >
            <Plus className="w-4 h-4" />
            Nuevo Evento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isToday = date.toDateString() === today;
            
            return (
              <div key={index} className="space-y-2">
                <div className={`text-center p-2 rounded-lg border ${
                  isToday 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-muted/50 border-border"
                }`}>
                  <div className="text-xs font-medium">
                    {weekDays[index]}
                  </div>
                  <div className={`text-lg font-bold ${
                    isToday ? "text-primary-foreground" : "text-foreground"
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
                
                <div className="space-y-1 min-h-[120px]">
                  {loading ? (
                    <div className="text-xs text-muted-foreground">Cargando...</div>
                  ) : dayEvents.length === 0 ? (
                    <div className="text-xs text-muted-foreground/50"></div>
                  ) : (
                    dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`p-2 rounded-md text-xs cursor-pointer ${getEventColor()}`}
                        onClick={() => navigate("/calendario")}
                      >
                        <div className="font-medium truncate">{event.titulo}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}