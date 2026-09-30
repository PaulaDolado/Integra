import { useEffect, useState } from "react";
import { format, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AreaComunicado, AREAS } from "./areas";

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: string;
  autor_id: string | null;
  area: string;
}

interface ComunicadoDialogProps {
  open: boolean;
  // null = nuevo comunicado
  comunicado: Comunicado | null;
  area: AreaComunicado;
  empleadoId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

// Un comunicado de hoy guarda la hora actual; uno de otro día, las 9:00
const toFechaPublicacion = (fecha: string) => {
  const dia = new Date(`${fecha}T09:00`);
  return (isToday(dia) ? new Date() : dia).toISOString();
};

export function ComunicadoDialog({ open, comunicado, area, empleadoId, onClose, onSaved }: ComunicadoDialogProps) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fecha, setFecha] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo(comunicado?.titulo ?? "");
    setContenido(comunicado?.contenido ?? "");
    setFecha(format(comunicado ? new Date(comunicado.fecha_publicacion) : new Date(), "yyyy-MM-dd"));
  }, [open, comunicado]);

  const save = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      toast({ title: "Error", description: "El título y el texto son obligatorios", variant: "destructive" });
      return;
    }
    if (!fecha) {
      toast({ title: "Error", description: "Indica la fecha de publicación", variant: "destructive" });
      return;
    }

    const fechaOriginal = comunicado ? format(new Date(comunicado.fecha_publicacion), "yyyy-MM-dd") : null;
    const values = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      // Al editar sin cambiar el día se conserva la hora original
      fecha_publicacion: fecha === fechaOriginal ? comunicado!.fecha_publicacion : toFechaPublicacion(fecha),
    };

    setSaving(true);
    const { error } = comunicado
      ? await supabase.from("anuncios").update(values).eq("id", comunicado.id)
      : await supabase.from("anuncios").insert({ ...values, area, autor_id: empleadoId });
    setSaving(false);

    if (error) {
      console.error("Error saving comunicado:", error);
      toast({
        title: "Error",
        description: comunicado ? "No se pudo guardar el comunicado" : "No se pudo publicar el comunicado",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: comunicado ? "Comunicado actualizado" : "Comunicado publicado",
      description: `Se ha ${comunicado ? "actualizado" : "publicado"} en el tablón de ${AREAS[area].label}`,
    });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{comunicado ? "Editar comunicado" : "Nuevo comunicado"}</DialogTitle>
          <DialogDescription>
            Se publicará en el tablón como comunicado de{" "}
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${AREAS[area].etiqueta}`}>
              {AREAS[area].label}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comunicado-titulo">Título *</Label>
            <Input id="comunicado-titulo" maxLength={255} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comunicado-contenido">Texto *</Label>
            <Textarea
              id="comunicado-contenido"
              rows={8}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comunicado-fecha">Fecha de publicación</Label>
            <Input
              id="comunicado-fecha"
              type="date"
              className="w-auto"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">El comunicado aparece en el tablón del mes de esta fecha.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Guardando..." : comunicado ? "Guardar cambios" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
