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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Widget de Tareas - ocupa 2 columnas en pantallas grandes */}
        <TasksWidget />
        
        {/* Widget de Tickets */}
        <TicketsWidget />
        
        {/* Widget de Items Recientes */}
        <RecentItemsWidget />
        
        {/* Widget de Noticias */}
        <NewsWidget />
      </div>

      {/* Widget de Calendario - ocupa todo el ancho */}
      <CalendarWidget />
    </div>
  );
}