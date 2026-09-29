import { useState, useEffect } from "react";
import { CheckSquare, Plus, Clock, AlertCircle, CheckCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TaskStatus = 'pendiente' | 'en_progreso' | 'completado';

interface Task {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: TaskStatus;
  fecha_limite: string | null;
  proyecto_id: string;
}

const COLUMNS: { status: TaskStatus; title: string; empty: string; icon: typeof Clock; iconClass: string }[] = [
  { status: "pendiente", title: "Pendientes", empty: "No hay tareas pendientes", icon: AlertCircle, iconClass: "text-pending" },
  { status: "en_progreso", title: "En Progreso", empty: "No hay tareas en progreso", icon: Clock, iconClass: "text-warning" },
  { status: "completado", title: "Completadas", empty: "No hay tareas completadas", icon: CheckCircle, iconClass: "text-success" },
];

const emptyForm = { titulo: "", descripcion: "", fecha_limite: "", estado: "pendiente" as TaskStatus };

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
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState(emptyForm);
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
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
      setEmpleadoId(employeeData.id);

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

  const updateTaskStatus = async (task: Task, newStatus: TaskStatus) => {
    // Se mueve la tarjeta al instante y se revierte si Supabase falla
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, estado: newStatus } : t)));

    const { error } = await supabase
      .from('tareas')
      .update({ estado: newStatus })
      .eq('id', task.id);

    if (error) {
      console.error('Error updating task:', error);
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, estado: task.estado } : t)));
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

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setEditForm({
      titulo: task.titulo,
      descripcion: task.descripcion ?? "",
      fecha_limite: task.fecha_limite ? task.fecha_limite.slice(0, 10) : "",
      estado: task.estado,
    });
  };

  const openCreate = () => {
    setEditingTask(null);
    setEditForm(emptyForm);
    setCreating(true);
  };

  const closeDialog = () => {
    setEditingTask(null);
    setCreating(false);
  };

  // Las tareas cuelgan de un proyecto: se usa el primero o se crea uno general
  const getDefaultProjectId = async () => {
    const { data: proyectos } = await supabase.from('proyectos').select('id').limit(1);
    if (proyectos && proyectos.length > 0) return proyectos[0].id;

    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(today.getFullYear() + 1);
    const { data: newProject, error } = await supabase
      .from('proyectos')
      .insert({
        nombre: 'Proyecto General',
        descripcion: 'Proyecto por defecto para tareas',
        fecha_inicio: today.toISOString().split('T')[0],
        fecha_fin: nextYear.toISOString().split('T')[0],
        estado: 'en_progreso',
      })
      .select('id')
      .single();
    if (error) console.error('Error creating default project:', error);
    return newProject?.id ?? null;
  };

  const saveCreate = async () => {
    if (!empleadoId) return;

    setSaving(true);
    const proyectoId = await getDefaultProjectId();
    if (!proyectoId) {
      setSaving(false);
      toast({
        title: "Error",
        description: "No se pudo asignar un proyecto a la tarea",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from('tareas')
      .insert({
        titulo: editForm.titulo.trim(),
        descripcion: editForm.descripcion.trim() || null,
        fecha_limite: editForm.fecha_limite || null,
        estado: editForm.estado,
        asignado_a_id: empleadoId,
        proyecto_id: proyectoId,
      })
      .select('*')
      .single();
    setSaving(false);

    if (error || !data) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive",
      });
      return;
    }

    setTasks(prev => (prev.some(t => t.id === data.id) ? prev : [...prev, data]));
    closeDialog();
    toast({
      title: "Tarea creada",
      description: "La tarea se ha creado correctamente",
    });
  };

  const saveEdit = async () => {
    if (!editForm.titulo.trim()) {
      toast({
        title: "Error",
        description: "El título es obligatorio",
        variant: "destructive",
      });
      return;
    }
    if (creating) {
      await saveCreate();
      return;
    }
    if (!editingTask) return;

    const changes = {
      titulo: editForm.titulo.trim(),
      descripcion: editForm.descripcion.trim() || null,
      fecha_limite: editForm.fecha_limite || null,
      estado: editForm.estado,
    };

    setSaving(true);
    const { error } = await supabase
      .from('tareas')
      .update(changes)
      .eq('id', editingTask.id);
    setSaving(false);

    if (error) {
      console.error('Error editing task:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios",
        variant: "destructive",
      });
      return;
    }

    setTasks(prev => prev.map(t => (t.id === editingTask.id ? { ...t, ...changes } : t)));
    setEditingTask(null);
    toast({
      title: "Tarea actualizada",
      description: "Los cambios se han guardado correctamente",
    });
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
          <Button className="gap-2" onClick={openCreate} disabled={!empleadoId}>
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
                    columnTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openEdit(task)}
                        className={`group p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-move hover:shadow-md ${
                          status === 'completado' ? 'opacity-75' : ''
                        } ${draggedTask?.id === task.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={`font-medium text-sm mb-1 ${status === 'completado' ? 'line-through' : ''}`}>
                            {task.titulo}
                          </h4>
                          <Pencil className="w-3.5 h-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
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
            );
          })}
        </div>
      )}

      <Dialog open={creating || !!editingTask} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creating ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-titulo">Título *</Label>
              <Input
                id="edit-titulo"
                value={editForm.titulo}
                onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-descripcion">Descripción</Label>
              <Textarea
                id="edit-descripcion"
                rows={4}
                value={editForm.descripcion}
                onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-fecha">Fecha límite</Label>
                <Input
                  id="edit-fecha"
                  type="date"
                  value={editForm.fecha_limite}
                  onChange={(e) => setEditForm({ ...editForm, fecha_limite: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-estado">Estado</Label>
                <Select
                  value={editForm.estado}
                  onValueChange={(value) => setEditForm({ ...editForm, estado: value as TaskStatus })}
                >
                  <SelectTrigger id="edit-estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMNS.map((c) => (
                      <SelectItem key={c.status} value={c.status}>
                        {getStatusConfig(c.status).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Guardando..." : creating ? "Crear tarea" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
