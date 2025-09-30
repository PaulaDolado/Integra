import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  titulo: string;
  estado: string;
  fecha_limite: string | null;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "completada":
      return {
        icon: CheckCircle,
        color: "success",
        label: "Completada",
        bgColor: "bg-success-light",
        textColor: "text-success",
      };
    case "en_progreso":
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

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      // First get the employee profile
      const { data: employeeData, error: empError } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empError || !employeeData) {
        console.error('Error fetching employee:', empError);
        setTasks([]);
        setLoading(false);
        return;
      }

      // Then get tasks assigned to this employee
      const { data, error } = await supabase
        .from('tareas')
        .select('id, titulo, estado, fecha_limite')
        .eq('asignado_a_id', employeeData.id)
        .order('fecha_limite', { ascending: true, nullsFirst: false })
        .limit(10);

      if (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las tareas",
          variant: "destructive",
        });
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedTasks = tasks.filter(task => task.estado === "completada").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tasksByStatus = {
    completed: tasks.filter(task => task.estado === "completada").length,
    "in-progress": tasks.filter(task => task.estado === "en_progreso").length,
    pending: tasks.filter(task => task.estado === "pendiente").length,
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
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          <>
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
              {tasks.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tienes tareas asignadas</p>
                </div>
              ) : (
                tasks.slice(0, 3).map((task) => {
                  const statusConfig = getStatusConfig(task.estado);
                  const Icon = statusConfig.icon;
                  
                  return (
                    <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                      <div className={`p-1 rounded-full ${statusConfig.bgColor}`}>
                        <Icon className={`w-3 h-3 ${statusConfig.textColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {task.titulo}
                        </p>
                        {task.fecha_limite && (
                          <p className="text-xs text-muted-foreground">
                            Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {statusConfig.label}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}