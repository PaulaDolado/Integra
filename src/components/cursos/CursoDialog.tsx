import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leerHoras, MODALIDADES, validarCurso, type Curso, type FormCurso, type Modalidad } from "./cursos";

interface CursoDialogProps {
  open: boolean;
  // null = curso nuevo
  curso: Curso | null;
  empleadoId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const VACIO: FormCurso = {
  titulo: "",
  descripcion: "",
  modalidad: "presencial",
  lugar: "",
  enlace: "",
  fecha_inicio: "",
  fecha_fin: "",
  horas: "",
  certificado: false,
  plazo_inscripcion: "",
};

export function CursoDialog({ open, curso, empleadoId, onClose, onSaved }: CursoDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormCurso>(VACIO);
  const [guardando, setGuardando] = useState(false);

  // Al abrirse (o al cambiar de curso) el formulario parte del curso
  const [previo, setPrevio] = useState<{ open: boolean; curso: Curso | null }>({ open: false, curso: null });
  if (open !== previo.open || curso !== previo.curso) {
    setPrevio({ open, curso });
    if (open) {
      setForm(
        curso
          ? {
              titulo: curso.titulo,
              descripcion: curso.descripcion,
              modalidad: curso.modalidad === "online" ? "online" : "presencial",
              lugar: curso.lugar ?? "",
              enlace: curso.enlace ?? "",
              fecha_inicio: curso.fecha_inicio,
              fecha_fin: curso.fecha_fin,
              horas: curso.horas == null ? "" : String(curso.horas).replace(".", ","),
              certificado: curso.certificado,
              plazo_inscripcion: curso.plazo_inscripcion ?? "",
            }
          : VACIO
      );
    }
  }

  const cambiar = <K extends keyof FormCurso>(campo: K, valor: FormCurso[K]) => setForm({ ...form, [campo]: valor });

  const guardar = async () => {
    const problema = validarCurso(form);
    if (problema) {
      toast({ title: "Error", description: problema, variant: "destructive" });
      return;
    }
    const presencial = form.modalidad === "presencial";
    const valores = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim(),
      modalidad: form.modalidad,
      // Solo se guarda el dato de la modalidad elegida
      lugar: presencial ? form.lugar.trim() || null : null,
      enlace: presencial ? null : form.enlace.trim() || null,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      horas: leerHoras(form.horas),
      certificado: form.certificado,
      plazo_inscripcion: form.plazo_inscripcion || null,
    };

    setGuardando(true);
    const { error } = curso
      ? await supabase.from("cursos").update(valores).eq("id", curso.id)
      : await supabase.from("cursos").insert({ ...valores, creado_por: empleadoId });
    setGuardando(false);

    if (error) {
      console.error("Error saving curso:", error);
      toast({ title: "Error", description: "No se pudo guardar el curso", variant: "destructive" });
      return;
    }
    toast({ title: curso ? "Curso actualizado" : "Curso publicado", description: form.titulo.trim() });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{curso ? "Editar curso" : "Nuevo curso"}</DialogTitle>
          <DialogDescription>
            {curso ? "Los cambios los verá toda la plantilla en el catálogo." : "Se publicará en el catálogo para toda la plantilla."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="curso-titulo">Título *</Label>
            <Input id="curso-titulo" maxLength={200} value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="curso-descripcion">Descripción</Label>
            <Textarea
              id="curso-descripcion"
              rows={4}
              placeholder="Qué se aprende, a quién va dirigido, temario..."
              value={form.descripcion}
              onChange={(e) => cambiar("descripcion", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <p id="curso-modalidad" className="text-sm font-medium leading-none">
              Modalidad
            </p>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              className="justify-start"
              value={form.modalidad}
              onValueChange={(value) => value && cambiar("modalidad", value as Modalidad)}
              aria-labelledby="curso-modalidad"
            >
              {(Object.keys(MODALIDADES) as Modalidad[]).map((m) => (
                <ToggleGroupItem key={m} value={m} className="px-3 text-xs">
                  {MODALIDADES[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {form.modalidad === "presencial" ? (
            <div className="space-y-2">
              <Label htmlFor="curso-lugar">Lugar</Label>
              <Input
                id="curso-lugar"
                maxLength={300}
                placeholder="Sala de formación, planta 2"
                value={form.lugar}
                onChange={(e) => cambiar("lugar", e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="curso-enlace">Enlace a la sesión</Label>
              <Input
                id="curso-enlace"
                type="url"
                inputMode="url"
                placeholder="https://teams.microsoft.com/..."
                value={form.enlace}
                onChange={(e) => cambiar("enlace", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Solo lo verán las personas con la inscripción aprobada.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="curso-inicio">Fecha de inicio *</Label>
              <Input id="curso-inicio" type="date" value={form.fecha_inicio} onChange={(e) => cambiar("fecha_inicio", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curso-fin">Fecha de fin *</Label>
              <Input id="curso-fin" type="date" value={form.fecha_fin} onChange={(e) => cambiar("fecha_fin", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curso-plazo">Plazo de inscripción</Label>
              <Input
                id="curso-plazo"
                type="date"
                value={form.plazo_inscripcion}
                onChange={(e) => cambiar("plazo_inscripcion", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Último día para apuntarse. Vacío: hasta el día antes de empezar.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="curso-horas">Horas</Label>
              <Input
                id="curso-horas"
                inputMode="decimal"
                placeholder="12"
                value={form.horas}
                onChange={(e) => cambiar("horas", e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="curso-certificado" checked={form.certificado} onCheckedChange={(value) => cambiar("certificado", value)} />
            <Label htmlFor="curso-certificado" className="font-normal">
              Da certificado al terminarlo
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
            {curso ? "Guardar cambios" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
