import { CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const tasks = [
  { id: 1, title: "Revisar documentación del proyecto", status: "completed", priority: "high", dueDate: "2024-01-15" },
  { id: 2, title: "Preparar presentación cliente", status: "in-progress", priority: "high", dueDate: "2024-01-18" },
  { id: 3, title: "Actualizar base de datos", status: "in-progress", priority: "medium", dueDate: "2024-01-20" },
  { id: 4, title: "Reunión equipo desarrollo", status: "pending", priority: "low", dueDate: "2024-01-22" },
  { id: 5, title: "Código revisión PR#234", status: "pending", priority: "medium", dueDate: "2024-01-25" },
];

const getStatusConfig = (status: string) => {
  switch (status) {
    case "completed":
      return {
        icon: CheckCircle,
        color: "success",
        label: "Completada",
        bgColor: "bg-success-light",
        textColor: "text-success",
      };
    case "in-progress":
      return {
        icon: Clock,
        color: "warning",
        label: "En Progreso",
        bgColor: "bg-warning-light",
        textColor: "text-warning",
      };
    default:
      return {
        icon: AlertCircle,
        color: "pending",
        label: "Pendiente",
        bgColor: "bg-pending-light",
        textColor: "text-pending",
      };
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "high":
      return "destructive";
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
};

export function TasksWidget() {
  const completedTasks = tasks.filter(task => task.status === "completed").length;
  const totalTasks = tasks.length;
  const completionRate = Math.round((completedTasks / totalTasks) * 100);

  const tasksByStatus = {
    completed: tasks.filter(task => task.status === "completed").length,
    "in-progress": tasks.filter(task => task.status === "in-progress").length,
    pending: tasks.filter(task => task.status === "pending").length,
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Mis Tareas</CardTitle>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Tarea
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de estado */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-success-light">
            <div className="text-2xl font-bold text-success">{tasksByStatus.completed}</div>
            <div className="text-sm text-success">Completadas</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-warning-light">
            <div className="text-2xl font-bold text-warning">{tasksByStatus["in-progress"]}</div>
            <div className="text-sm text-warning">En Progreso</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-pending-light">
            <div className="text-2xl font-bold text-pending">{tasksByStatus.pending}</div>
            <div className="text-sm text-pending">Pendientes</div>
          </div>
        </div>

        {/* Progreso general */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Progreso General</span>
            <span className="text-sm text-muted-foreground">{completionRate}%</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Lista de tareas recientes */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Tareas Recientes</h4>
          {tasks.slice(0, 3).map((task) => {
            const statusConfig = getStatusConfig(task.status);
            const Icon = statusConfig.icon;
            
            return (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <div className={`p-1 rounded-full ${statusConfig.bgColor}`}>
                  <Icon className={`w-3 h-3 ${statusConfig.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {task.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Vence: {new Date(task.dueDate).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <Badge variant={getPriorityColor(task.priority)} className="text-xs">
                  {task.priority === "high" ? "Alta" : task.priority === "medium" ? "Media" : "Baja"}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}