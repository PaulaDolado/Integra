import { useState, useEffect } from "react";
import { CheckSquare, Plus, Filter, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  fecha_limite: string | null;
  proyecto_id: string;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "completado":
      return {
        icon: CheckCircle,
        color: "success",
        label: "Completada",
        variant: "default" as const,
      };
    case "en_progreso":
      return {
        icon: Clock,
        color: "warning",
        label: "En Progreso",
        variant: "secondary" as const,
      };
    default:
      return {
        icon: AlertCircle,
        color: "pending",
        label: "Pendiente",
        variant: "outline" as const,
      };
  }
};

export default function Tareas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('tareas-page-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tareas'
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    try {
      const { data: employeeData, error: empError } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empError || !employeeData) {
        console.error('Error fetching employee:', empError);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tareas')
        .select('*')
        .eq('asignado_a_id', employeeData.id)
        .order('fecha_limite', { ascending: true, nullsFirst: false });

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

  const updateTaskStatus = async (taskId: string, newStatus: 'pendiente' | 'en_progreso' | 'completado') => {
    try {
      const { error } = await supabase
        .from('tareas')
        .update({ estado: newStatus })
        .eq('id', taskId);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo actualizar la tarea",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tarea actualizada",
          description: "El estado se ha actualizado correctamente",
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'pendiente' | 'en_progreso' | 'completado') => {
    e.preventDefault();
    if (!draggedTask) return;

    if (draggedTask.estado !== newStatus) {
      await updateTaskStatus(draggedTask.id, newStatus);
    }
    setDraggedTask(null);
  };

  const groupedTasks = {
    pendiente: tasks.filter(t => t.estado === "pendiente"),
    en_progreso: tasks.filter(t => t.estado === "en_progreso"),
    completado: tasks.filter(t => t.estado === "completado"),
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare className="w-8 h-8 text-primary" />
            Gestión de Tareas
          </h1>
          <p className="text-muted-foreground">
            Organiza y gestiona todas tus tareas pendientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Pendientes */}
          <Card 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'pendiente')}
            className={draggedTask && draggedTask.estado !== 'pendiente' ? 'ring-2 ring-primary/50' : ''}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-pending" />
                Pendientes ({groupedTasks.pendiente.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {groupedTasks.pendiente.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tareas pendientes
                </p>
              ) : (
                groupedTasks.pendiente.map((task) => (
                  <div 
                    key={task.id} 
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-move hover:shadow-md"
                  >
                    <h4 className="font-medium text-sm mb-1">{task.titulo}</h4>
                    {task.descripcion && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.descripcion}
                      </p>
                    )}
                    {task.fecha_limite && (
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* En Progreso */}
          <Card
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'en_progreso')}
            className={draggedTask && draggedTask.estado !== 'en_progreso' ? 'ring-2 ring-primary/50' : ''}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-warning" />
                En Progreso ({groupedTasks.en_progreso.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {groupedTasks.en_progreso.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tareas en progreso
                </p>
              ) : (
                groupedTasks.en_progreso.map((task) => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-move hover:shadow-md"
                  >
                    <h4 className="font-medium text-sm mb-1">{task.titulo}</h4>
                    {task.descripcion && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.descripcion}
                      </p>
                    )}
                    {task.fecha_limite && (
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Completadas */}
          <Card
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'completado')}
            className={draggedTask && draggedTask.estado !== 'completado' ? 'ring-2 ring-primary/50' : ''}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-5 h-5 text-success" />
                Completadas ({groupedTasks.completado.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {groupedTasks.completado.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tareas completadas
                </p>
              ) : (
                groupedTasks.completado.map((task) => (
                  <div 
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    className="p-3 border rounded-lg hover:bg-accent/50 transition-colors opacity-75 cursor-move hover:shadow-md"
                  >
                    <h4 className="font-medium text-sm mb-1 line-through">{task.titulo}</h4>
                    {task.descripcion && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {task.descripcion}
                      </p>
                    )}
                    {task.fecha_limite && (
                      <p className="text-xs text-muted-foreground">
                        Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}