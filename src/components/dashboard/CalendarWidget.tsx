import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const currentDate = new Date();
const currentWeekStart = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay() + 1));

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const events = [
  { id: 1, title: "Reunión equipo", time: "09:00", date: "2024-01-15", type: "meeting" },
  { id: 2, title: "Presentación cliente", time: "14:30", date: "2024-01-16", type: "presentation" },
  { id: 3, title: "Formación React", time: "10:00", date: "2024-01-17", type: "training" },
  { id: 4, title: "Revisión código", time: "16:00", date: "2024-01-18", type: "review" },
];

const getEventColor = (type: string) => {
  switch (type) {
    case "meeting":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "presentation":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "training":
      return "bg-green-100 text-green-700 border-green-200";
    case "review":
      return "bg-orange-100 text-orange-700 border-orange-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

export function CalendarWidget() {
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
    const dateStr = date.toISOString().split("T")[0];
    return events.filter(event => event.date === dateStr);
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
          <Button size="sm" className="gap-2 ml-2">
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
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-2 rounded-md border text-xs cursor-pointer hover:shadow-sm transition-shadow ${getEventColor(event.type)}`}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      <div className="opacity-75">{event.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}