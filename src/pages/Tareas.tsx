import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Clock, AlertCircle, CheckCircle, Pencil, ListChecks, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { TaskDetailDialog } from "@/components/tareas/TaskDetailDialog";
import { activarConTeclado } from "@/lib/teclado";
import { type Task, type TaskStatus, getSubtareas } from "@/components/tareas/task-utils";

const COLUMNS: { status: TaskStatus; title: string; empty: string; icon: typeof Clock; iconClass: string }[] = [
  { status: "pendiente", title: "Pendientes", empty: "No hay tareas pendientes", icon: AlertCircle, iconClass: "text-pending" },
  { status: "en_progreso", title: "En Progreso", empty: "No hay tareas en progreso", icon: Clock, iconClass: "text-warning" },
  { status: "completado", title: "Completadas", empty: "No hay tareas completadas", icon: CheckCircle, iconClass: "text-success" },
];

const MAX_CARD_TAGS = 3;

export default function Tareas() {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  // undefined = cerrado, null = nueva tarea
  const [openTask, setOpenTask] = useState<Task | null | undefined>(undefined);
  const { empleadoId, loading: cargandoEmpleado } = useMiEmpleadoId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // TasksWidget usa el mismo prefijo: invalidar esta clave actualiza los dos
  const clave = ["tareas", empleadoId];
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: clave,
    queryFn: async () =>
      comprobar(
        await supabase
          .from('tareas')
          .select('*')
          .eq('asignado_a_id', empleadoId!)
          .order('fecha_limite', { ascending: true, nullsFirst: false })
      ) ?? [],
    enabled: !!empleadoId,
  });
  useAvisarError(error, "No se pudieron cargar las tareas");
  const loading = cargandoEmpleado || isLoading;

  useInvalidarEnCambios(empleadoId ? 'tareas-page-changes' : null, [{ table: 'tareas' }], [clave]);

  // Cambia el estado en todas las listas de tareas en caché (esta página y el widget)
  const cambiarEstadoEnCache = (taskId: string, estado: TaskStatus) =>
    queryClient.setQueriesData<Task[]>({ queryKey: clave }, prev =>
      prev?.map(t => (t.id === taskId ? { ...t, estado } : t))
    );

  const updateTaskStatus = async (task: Task, newStatus: TaskStatus) => {
    // Se mueve la tarjeta al instante y se revierte si Supabase falla
    cambiarEstadoEnCache(task.id, newStatus);

    const { error } = await supabase
      .from('tareas')
      .update({ estado: newStatus })
      .eq('id', task.id);

    if (error) {
      console.error('Error updating task:', error);
      cambiarEstadoEnCache(task.id, task.estado);
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const task = draggedTask ?? tasks.find(t => t.id === e.dataTransfer.getData('text/plain'));
    handleDragEnd();
    if (task && task.estado !== newStatus) {
      updateTaskStatus(task, newStatus);
    }
  };

  // Tras crear, guardar o eliminar se vuelve a pedir la lista
  const handleChanged = () => {
    setOpenTask(undefined);
    queryClient.invalidateQueries({ queryKey: clave });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            Gestión de Tareas
          </h1>
          <p className="text-muted-foreground">
            Organiza y gestiona todas tus tareas pendientes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={() => setOpenTask(null)} disabled={!empleadoId}>
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
          {COLUMNS.map(({ status, title, empty, icon: Icon, iconClass }) => {
            const columnTasks = tasks.filter(t => t.estado === status);
            const isTarget = draggedTask !== null && draggedTask.estado !== status;

            return (
              <Card
                key={status}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null);
                }}
                onDrop={(e) => handleDrop(e, status)}
                className={`transition-colors ${
                  dragOverColumn === status && isTarget
                    ? 'ring-2 ring-primary bg-accent/40'
                    : isTarget
                      ? 'ring-2 ring-primary/30'
                      : ''
                }`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className={`w-5 h-5 ${iconClass}`} />
                    {title} ({columnTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 min-h-[200px]">
                  {columnTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {empty}
                    </p>
                  ) : (
                    columnTasks.map((task) => {
                      const subtareas = getSubtareas(task);
                      const hechas = subtareas.filter(s => s.completada).length;
                      const resumen = task.resumen || task.descripcion;
                      const etiquetas = task.etiquetas ?? [];

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setOpenTask(task)}
                          // Arrastrar no se puede con el teclado: el estado se cambia en el detalle
                          role="button"
                          tabIndex={0}
                          onKeyDown={activarConTeclado(() => setOpenTask(task))}
                          className={`group p-3 border rounded-lg hover:bg-accent/50 transition-[background-color,box-shadow] duration-150 ease-out cursor-move hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            status === 'completado' ? 'opacity-75' : ''
                          } ${draggedTask?.id === task.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={`font-medium text-sm mb-1 ${status === 'completado' ? 'line-through' : ''}`}>
                              {task.titulo}
                            </h3>
                            <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </div>
                          {resumen && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {resumen}
                            </p>
                          )}
                          {etiquetas.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {etiquetas.slice(0, MAX_CARD_TAGS).map((etiqueta) => (
                                <Badge key={etiqueta} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                  {etiqueta}
                                </Badge>
                              ))}
                              {etiquetas.length > MAX_CARD_TAGS && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{etiquetas.length - MAX_CARD_TAGS}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {task.fecha_limite && (
                              <span>Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}</span>
                            )}
                            {subtareas.length > 0 && (
                              <span className="flex items-center gap-1">
                                <ListChecks className="w-3 h-3" />
                                {hechas}/{subtareas.length}
                              </span>
                            )}
                            {(task.tiempo_estimado_min || (task.tiempo_real_min ?? 0) > 0) && (
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {task.tiempo_real_min ?? 0}
                                {task.tiempo_estimado_min ? `/${task.tiempo_estimado_min}` : ""} min
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TaskDetailDialog
        open={openTask !== undefined}
        task={openTask ?? null}
        empleadoId={empleadoId}
        onClose={() => setOpenTask(undefined)}
        onSaved={handleChanged}
        onDeleted={handleChanged}
      />
    </div>
  );
}
