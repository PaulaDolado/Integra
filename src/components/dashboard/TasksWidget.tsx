import { useState, useEffect } from "react";
import { CheckCircle, Clock, AlertCircle, Plus, Trash2, List, Kanban } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    case "completado":
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

type TaskStatus = 'pendiente' | 'en_progreso' | 'completado';
type TasksView = 'filas' | 'kanban';

const VIEW_STORAGE_KEY = 'integra:tasks-view';

const KANBAN_COLUMNS: TaskStatus[] = ['pendiente', 'en_progreso', 'completado'];

const getStoredView = (): TasksView => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'filas';
  } catch {
    return 'filas';
  }
};

export function TasksWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<TasksView>(getStoredView);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    titulo: '',
    descripcion: '',
    fecha_limite: ''
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('tasks-changes')
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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const { data: employeeData } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!employeeData) return;

      // Get or create a default project
      let { data: proyectos } = await supabase
        .from('proyectos')
        .select('id')
        .limit(1);

      let proyectoId;
      
      if (!proyectos || proyectos.length === 0) {
        // Create a default project if none exists
        const { data: newProject, error: projectError } = await supabase
          .from('proyectos')
          .insert([
            {
              nombre: 'Proyecto General',
              descripcion: 'Proyecto por defecto para tareas',
              fecha_inicio: new Date().toISOString().split('T')[0],
              fecha_fin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
              estado: 'en_progreso'
            }
          ])
          .select()
          .single();

        if (projectError || !newProject) {
          toast({
            title: "Error",
            description: "No se pudo crear el proyecto",
            variant: "destructive",
          });
          return;
        }
        proyectoId = newProject.id;
      } else {
        proyectoId = proyectos[0].id;
      }

      const { error } = await supabase
        .from('tareas')
        .insert([
          {
            titulo: taskForm.titulo,
            descripcion: taskForm.descripcion,
            fecha_limite: taskForm.fecha_limite || null,
            asignado_a_id: employeeData.id,
            proyecto_id: proyectoId,
            estado: 'pendiente'
          }
        ]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear la tarea",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tarea creada",
          description: "La tarea se ha creado exitosamente",
        });
        setIsCreateOpen(false);
        setTaskForm({ titulo: '', descripcion: '', fecha_limite: '' });
        fetchTasks();
      }
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditOpen(true);
  };

  const handleViewChange = (value: string) => {
    if (value !== 'filas' && value !== 'kanban') return;
    setView(value);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, value);
    } catch {
      // Sin almacenamiento disponible: la vista se mantiene solo en esta sesión
    }
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.estado === status) return;

    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, estado: status } : t)));
    handleUpdateTaskStatus(taskId, status);
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
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
          description: "El estado de la tarea se ha actualizado",
        });
        fetchTasks();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;

    try {
      const { error } = await supabase
        .from('tareas')
        .delete()
        .eq('id', selectedTask.id);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo eliminar la tarea",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tarea eliminada",
          description: "La tarea se ha eliminado exitosamente",
        });
        setIsDeleteAlertOpen(false);
        setIsEditOpen(false);
        setSelectedTask(null);
        fetchTasks();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const completedTasks = tasks.filter(task => task.estado === "completado").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const tasksByStatus = {
    completed: tasks.filter(task => task.estado === "completado").length,
    "in-progress": tasks.filter(task => task.estado === "en_progreso").length,
    pending: tasks.filter(task => task.estado === "pendiente").length,
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Mis Tareas</CardTitle>
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={view}
            onValueChange={handleViewChange}
            aria-label="Vista de tareas"
          >
            <ToggleGroupItem value="filas" aria-label="Vista por filas" title="Filas">
              <List className="w-4 h-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Vista kanban" title="Kanban">
              <Kanban className="w-4 h-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Nueva Tarea
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Tarea</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input
                    id="titulo"
                    value={taskForm.titulo}
                    onChange={(e) => setTaskForm({ ...taskForm, titulo: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={taskForm.descripcion}
                    onChange={(e) => setTaskForm({ ...taskForm, descripcion: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha_limite">Fecha límite</Label>
                  <Input
                    id="fecha_limite"
                    type="date"
                    value={taskForm.fecha_limite}
                    onChange={(e) => setTaskForm({ ...taskForm, fecha_limite: e.target.value })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Task Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Tarea</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <p className="text-sm font-medium">{selectedTask.titulo}</p>
                </div>
                {selectedTask.fecha_limite && (
                  <div className="space-y-2">
                    <Label>Fecha límite</Label>
                    <p className="text-sm">{new Date(selectedTask.fecha_limite).toLocaleDateString("es-ES")}</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedTask.estado === 'pendiente' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        handleUpdateTaskStatus(selectedTask.id, 'pendiente');
                        setIsEditOpen(false);
                      }}
                    >
                      Pendiente
                    </Button>
                    <Button
                      variant={selectedTask.estado === 'en_progreso' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        handleUpdateTaskStatus(selectedTask.id, 'en_progreso');
                        setIsEditOpen(false);
                      }}
                    >
                      En Progreso
                    </Button>
                    <Button
                      variant={selectedTask.estado === 'completado' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        handleUpdateTaskStatus(selectedTask.id, 'completado');
                        setIsEditOpen(false);
                      }}
                    >
                      Completada
                    </Button>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setIsDeleteAlertOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Tarea
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. La tarea será eliminada permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTask}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : view === 'kanban' ? (
          <>
            {/* Progreso general */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progreso General</span>
                <span className="text-sm text-muted-foreground">{completionRate}%</span>
              </div>
              <Progress value={completionRate} className="h-2" />
            </div>

            {/* Tablero kanban */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {KANBAN_COLUMNS.map((status) => {
                const statusConfig = getStatusConfig(status);
                const Icon = statusConfig.icon;
                const columnTasks = tasks.filter(task => task.estado === status);

                return (
                  <div
                    key={status}
                    className={`flex flex-col rounded-lg border p-2 min-h-[160px] transition-colors ${
                      dragOverColumn === status ? 'border-primary bg-accent/50' : 'border-border bg-muted/30'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverColumn(status);
                    }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className={`flex items-center justify-between px-2 py-1.5 mb-2 rounded-md ${statusConfig.bgColor}`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${statusConfig.textColor}`} />
                        <span className={`text-sm font-medium ${statusConfig.textColor}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${statusConfig.textColor}`}>
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2 flex-1">
                      {columnTasks.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Sin tareas
                        </p>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', task.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => setDragOverColumn(null)}
                            onClick={() => handleEditTask(task)}
                            className="p-2.5 rounded-md border border-border bg-card hover:bg-accent/50 transition-colors cursor-grab active:cursor-grabbing"
                          >
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {task.titulo}
                            </p>
                            {task.fecha_limite && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
                    <div 
                      key={task.id} 
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleEditTask(task)}
                    >
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