import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { CalendarWidget } from "@/components/dashboard/CalendarWidget";
import { RecentItemsWidget } from "@/components/dashboard/RecentItemsWidget";
import { NewsWidget } from "@/components/dashboard/NewsWidget";
import { TicketsWidget } from "@/components/dashboard/TicketsWidget";

export default function Dashboard() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido a tu portal de empleado. Aquí tienes un resumen de tu actividad.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda */}
        <div className="space-y-6">
          {/* Widget de Tareas */}
          <TasksWidget />
          
          {/* Widget de Calendario semanal debajo de tareas */}
          <CalendarWidget />
        </div>
        
        {/* Columna derecha */}
        <div className="space-y-6">
          {/* Widget de Items Recientes al lado de tareas */}
          <RecentItemsWidget />
          
          {/* Widget de Noticias debajo de items recientes */}
          <NewsWidget />
          
          {/* Widget de Tickets debajo de noticias */}
          <TicketsWidget />
        </div>
      </div>
    </div>
  );
}