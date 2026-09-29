import { useEffect, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Task,
  type TaskStatus,
  type Subtarea,
  TASK_STATUSES,
  getSubtareas,
  getPropiedades,
} from "./task-utils";

const IMAGE_BUCKET = "tareas";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const NO_PROJECT = "none";

interface Draft {
  titulo: string;
  resumen: string;
  descripcion: string;
  imagen_path: string | null;
  estado: TaskStatus;
  subtareas: Subtarea[];
  fecha_limite: string;
  proyecto_id: string;
  etiquetas: string[];
  propiedades: { clave: string; valor: string }[];
  tiempo_estimado_min: string;
  tiempo_real_min: number;
}

const toDraft = (task: Task | null): Draft => ({
  titulo: task?.titulo ?? "",
  resumen: task?.resumen ?? "",
  descripcion: task?.descripcion ?? "",
  imagen_path: task?.imagen_path ?? null,
  estado: task?.estado ?? "pendiente",
  subtareas: getSubtareas(task),
  fecha_limite: task?.fecha_limite ? task.fecha_limite.slice(0, 10) : "",
  proyecto_id: task?.proyecto_id ?? NO_PROJECT,
  etiquetas: task?.etiquetas ?? [],
  propiedades: Object.entries(getPropiedades(task)).map(([clave, valor]) => ({ clave, valor })),
  tiempo_estimado_min: task?.tiempo_estimado_min?.toString() ?? "",
  tiempo_real_min: task?.tiempo_real_min ?? 0,
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
      {children}
    </p>
  );
}

// Campo de texto con botón OK que también responde a Intro
function AddInput({
  placeholder,
  onAdd,
  className,
}: {
  placeholder: string;
  onAdd: (value: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  };
  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button type="button" variant="outline" onClick={submit} disabled={!value.trim()}>
        OK
      </Button>
    </div>
  );
}

interface TaskDetailDialogProps {
  open: boolean;
  // null = crear una tarea nueva
  task: Task | null;
  empleadoId: string | null;
  onClose: () => void;
  onSaved: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

export function TaskDetailDialog({ open, task, empleadoId, onClose, onSaved, onDeleted }: TaskDetailDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(task));
  const [proyectos, setProyectos] = useState<{ id: string; nombre: string }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [minutosRegistro, setMinutosRegistro] = useState("");
  const [nuevaPropiedad, setNuevaPropiedad] = useState(false);
  // Imágenes subidas en esta edición que aún no se han guardado en la tarea
  const pendingUploads = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const isNew = task === null;

  useEffect(() => {
    if (!open) return;
    setDraft(toDraft(task));
    setMinutosRegistro("");
    setNuevaPropiedad(false);
    pendingUploads.current = [];
    supabase
      .from("proyectos")
      .select("id, nombre")
      .order("nombre")
      .then(({ data }) => setProyectos(data ?? []));
  }, [open, task]);

  useEffect(() => {
    if (!draft.imagen_path) {
      setImageUrl(null);
      return;
    }
    supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrl(draft.imagen_path, 3600)
      .then(({ data }) => setImageUrl(data?.signedUrl ?? null));
  }, [draft.imagen_path]);

  const update = (changes: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...changes }));

  const removeFiles = async (paths: string[]) => {
    if (paths.length > 0) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  };

  const close = async () => {
    await removeFiles(pendingUploads.current);
    pendingUploads.current = [];
    onClose();
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "El archivo debe ser una imagen", variant: "destructive" });
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast({ title: "Error", description: "La imagen no puede superar los 5 MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file);
    setUploading(false);

    if (error) {
      console.error("Error uploading task image:", error);
      toast({ title: "Error", description: "No se pudo subir la imagen", variant: "destructive" });
      return;
    }
    pendingUploads.current.push(path);
    update({ imagen_path: path });
  };

  const addSubtarea = (titulo: string) =>
    update({ subtareas: [...draft.subtareas, { id: crypto.randomUUID(), titulo, completada: false }] });

  const toggleSubtarea = (id: string) =>
    update({
      subtareas: draft.subtareas.map((s) => (s.id === id ? { ...s, completada: !s.completada } : s)),
    });

  const removeSubtarea = (id: string) => update({ subtareas: draft.subtareas.filter((s) => s.id !== id) });

  const addEtiqueta = (etiqueta: string) => {
    if (draft.etiquetas.some((e) => e.toLowerCase() === etiqueta.toLowerCase())) return;
    update({ etiquetas: [...draft.etiquetas, etiqueta] });
  };

  const addPropiedad = (clave: string) => {
    if (draft.propiedades.some((p) => p.clave.toLowerCase() === clave.toLowerCase())) return;
    update({ propiedades: [...draft.propiedades, { clave, valor: "" }] });
    setNuevaPropiedad(false);
  };

  const registrarTiempo = () => {
    const minutos = parseInt(minutosRegistro, 10);
    if (!minutos || minutos <= 0) return;
    update({ tiempo_real_min: draft.tiempo_real_min + minutos });
    setMinutosRegistro("");
  };

  const save = async () => {
    if (!draft.titulo.trim()) {
      toast({ title: "Error", description: "El título es obligatorio", variant: "destructive" });
      return;
    }
    const estimado = draft.tiempo_estimado_min.trim() ? parseInt(draft.tiempo_estimado_min, 10) : null;
    if (estimado !== null && (Number.isNaN(estimado) || estimado < 0)) {
      toast({ title: "Error", description: "El tiempo estimado no es válido", variant: "destructive" });
      return;
    }

    const values = {
      titulo: draft.titulo.trim(),
      resumen: draft.resumen.trim() || null,
      descripcion: draft.descripcion.trim() || null,
      imagen_path: draft.imagen_path,
      estado: draft.estado,
      subtareas: draft.subtareas,
      fecha_limite: draft.fecha_limite || null,
      proyecto_id: draft.proyecto_id === NO_PROJECT ? null : draft.proyecto_id,
      etiquetas: draft.etiquetas,
      propiedades: Object.fromEntries(
        draft.propiedades.filter((p) => p.clave.trim()).map((p) => [p.clave.trim(), p.valor])
      ),
      tiempo_estimado_min: estimado,
      tiempo_real_min: draft.tiempo_real_min,
    };

    setSaving(true);
    const { data, error } = isNew
      ? await supabase
          .from("tareas")
          .insert({ ...values, asignado_a_id: empleadoId })
          .select("*")
          .single()
      : await supabase.from("tareas").update(values).eq("id", task.id).select("*").single();
    setSaving(false);

    if (error || !data) {
      console.error("Error saving task:", error);
      toast({
        title: "Error",
        description: isNew ? "No se pudo crear la tarea" : "No se pudieron guardar los cambios",
        variant: "destructive",
      });
      return;
    }

    // La imagen anterior y las subidas descartadas ya no se usan
    const unused = pendingUploads.current.filter((p) => p !== data.imagen_path);
    if (task?.imagen_path && task.imagen_path !== data.imagen_path) unused.push(task.imagen_path);
    pendingUploads.current = [];
    await removeFiles(unused);

    toast({
      title: isNew ? "Tarea creada" : "Tarea actualizada",
      description: isNew ? "La tarea se ha creado correctamente" : "Los cambios se han guardado correctamente",
    });
    onSaved(data);
  };

  const deleteTask = async () => {
    if (!task) return;
    const { error } = await supabase.from("tareas").delete().eq("id", task.id);
    if (error) {
      console.error("Error deleting task:", error);
      toast({ title: "Error", description: "No se pudo eliminar la tarea", variant: "destructive" });
      return;
    }
    await removeFiles([...pendingUploads.current, ...(task.imagen_path ? [task.imagen_path] : [])]);
    pendingUploads.current = [];
    setConfirmDelete(false);
    toast({ title: "Tarea eliminada", description: "La tarea se ha eliminado correctamente" });
    onDeleted(task.id);
  };

  const completadas = draft.subtareas.filter((s) => s.completada).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">{isNew ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
          <Input
            aria-label="Título de la tarea"
            value={draft.titulo}
            placeholder={isNew ? "Nueva tarea" : "Título de la tarea"}
            onChange={(e) => update({ titulo: e.target.value })}
            className="h-auto border-transparent bg-transparent px-2 py-1 pr-8 text-2xl font-semibold shadow-none hover:border-input focus-visible:border-input"
            autoFocus={isNew}
          />

          <div className="grid gap-6 md:grid-cols-2">
            {/* Columna izquierda: imagen y descripción */}
            <div className="space-y-4">
              <div>
                {imageUrl ? (
                  <div className="relative overflow-hidden rounded-lg border">
                    <img src={imageUrl} alt="Imagen de la tarea" className="max-h-56 w-full object-cover" />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="absolute right-2 top-2 h-7 w-7"
                      aria-label="Quitar imagen"
                      onClick={() => update({ imagen_path: null })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 px-2 text-muted-foreground"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <ImagePlus className="w-4 h-4" />
                    {uploading ? "Subiendo..." : "Añadir imagen"}
                  </Button>
                )}
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              </div>

              <div>
                <SectionLabel>Descripción</SectionLabel>
                <div className="space-y-3">
                  <Textarea
                    aria-label="Resumen corto"
                    placeholder="Resumen corto (opcional)"
                    rows={2}
                    maxLength={255}
                    value={draft.resumen}
                    onChange={(e) => update({ resumen: e.target.value })}
                    className="font-medium"
                  />
                  <Textarea
                    aria-label="Descripción"
                    placeholder="Escribe aquí..."
                    rows={10}
                    value={draft.descripcion}
                    onChange={(e) => update({ descripcion: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Columna derecha: detalles */}
            <div className="space-y-5 md:border-l md:pl-6">
              <div>
                <SectionLabel>Estado</SectionLabel>
                <Select value={draft.estado} onValueChange={(value) => update({ estado: value as TaskStatus })}>
                  <SelectTrigger aria-label="Estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <SectionLabel>
                  Subtareas{draft.subtareas.length > 0 && ` (${completadas}/${draft.subtareas.length})`}
                </SectionLabel>
                {draft.subtareas.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {draft.subtareas.map((s) => (
                      <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
                        <Checkbox
                          checked={s.completada}
                          onCheckedChange={() => toggleSubtarea(s.id)}
                          aria-label={`Completar ${s.titulo}`}
                        />
                        <span className={`flex-1 text-sm ${s.completada ? "line-through text-muted-foreground" : ""}`}>
                          {s.titulo}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSubtarea(s.id)}
                          className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label={`Eliminar ${s.titulo}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <AddInput placeholder="+ Paso" onAdd={addSubtarea} />
              </div>

              <div>
                <SectionLabel>Fecha límite</SectionLabel>
                <Input
                  type="date"
                  aria-label="Fecha límite"
                  className="w-auto"
                  value={draft.fecha_limite}
                  onChange={(e) => update({ fecha_limite: e.target.value })}
                />
              </div>

              <div>
                <SectionLabel>Proyecto</SectionLabel>
                <Select value={draft.proyecto_id} onValueChange={(value) => update({ proyecto_id: value })}>
                  <SelectTrigger aria-label="Proyecto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>Sin proyecto</SelectItem>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <SectionLabel>Etiquetas</SectionLabel>
                {draft.etiquetas.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {draft.etiquetas.map((etiqueta) => (
                      <Badge key={etiqueta} variant="secondary" className="gap-1 pr-1">
                        {etiqueta}
                        <button
                          type="button"
                          onClick={() => update({ etiquetas: draft.etiquetas.filter((e) => e !== etiqueta) })}
                          className="rounded-full p-0.5 hover:bg-background"
                          aria-label={`Quitar etiqueta ${etiqueta}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <AddInput placeholder="+ etiqueta" onAdd={addEtiqueta} className="max-w-xs" />
              </div>

              <div>
                <SectionLabel>Propiedades personalizadas</SectionLabel>
                <div className="space-y-3">
                  {draft.propiedades.map((p, index) => (
                    <div key={p.clave}>
                      <div className="mb-1 flex items-center justify-between">
                        <label htmlFor={`propiedad-${index}`} className="text-sm">
                          {p.clave}
                        </label>
                        <button
                          type="button"
                          onClick={() => update({ propiedades: draft.propiedades.filter((_, i) => i !== index) })}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar propiedad ${p.clave}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Input
                        id={`propiedad-${index}`}
                        value={p.valor}
                        onChange={(e) =>
                          update({
                            propiedades: draft.propiedades.map((q, i) =>
                              i === index ? { ...q, valor: e.target.value } : q
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                  {nuevaPropiedad ? (
                    <AddInput placeholder="Nombre de la propiedad" onAdd={addPropiedad} />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1 px-2 text-muted-foreground"
                      onClick={() => setNuevaPropiedad(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Añadir propiedad
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <SectionLabel>Tiempo (minutos)</SectionLabel>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label htmlFor="tiempo-estimado">Estimado</label>
                  <Input
                    id="tiempo-estimado"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    className="w-20"
                    value={draft.tiempo_estimado_min}
                    onChange={(e) => update({ tiempo_estimado_min: e.target.value })}
                  />
                  <span className="ml-2">Real: {draft.tiempo_real_min}</span>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="+m"
                    aria-label="Minutos a registrar"
                    className="w-20"
                    value={minutosRegistro}
                    onChange={(e) => setMinutosRegistro(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        registrarTiempo();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={registrarTiempo} disabled={!minutosRegistro}>
                    Registrar
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {isNew ? (
              <span />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Eliminar tarea
              </Button>
            )}
            <div className="flex gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={close} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={save} disabled={saving || uploading}>
                {saving ? "Guardando..." : isNew ? "Crear tarea" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{task?.titulo}" junto con sus subtareas y su imagen. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
