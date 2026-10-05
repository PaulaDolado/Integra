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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type AreaComunicado, AREAS } from "./areas";
import { calcularFin, type Duracion, DURACIONES, duracionDe, esEnlaceValido } from "./vigencia";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface Comunicado {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: string;
  autor_id: string | null;
  area: string;
  tipo: string;
  enlace: string | null;
  // null = fijo, no caduca
  fecha_fin: string | null;
}

type TipoNota = "comunicado" | "formulario";

interface ComunicadoDialogProps {
  open: boolean;
  // null = nuevo comunicado
  comunicado: Comunicado | null;
  // Áreas en las que el usuario puede publicar
  areas: AreaComunicado[];
  empleadoId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

// Un comunicado de hoy guarda la hora actual; uno de otro día, las 9:00
const toFechaPublicacion = (fecha: string) => {
  const dia = new Date(`${fecha}T09:00`);
  return (isToday(dia) ? new Date() : dia).toISOString();
};

export function ComunicadoDialog({ open, comunicado, areas, empleadoId, onClose, onSaved }: ComunicadoDialogProps) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fecha, setFecha] = useState("");
  const [area, setArea] = useState<AreaComunicado>(areas[0]);
  const [tipo, setTipo] = useState<TipoNota>("comunicado");
  const [enlace, setEnlace] = useState("");
  const [duracion, setDuracion] = useState<Duracion>("1");
  const [saving, setSaving] = useState(false);
  const areaPorDefecto = areas[0];

  // Al abrirse (o al cambiar el comunicado) el formulario parte del comunicado
  const [previo, setPrevio] = useState<{ open: boolean; comunicado: typeof comunicado }>({ open: false, comunicado: null });
  if (open !== previo.open || comunicado !== previo.comunicado) {
    setPrevio({ open, comunicado });
    if (open) {
      setTitulo(comunicado?.titulo ?? "");
      setContenido(comunicado?.contenido ?? "");
      setFecha(format(comunicado ? new Date(comunicado.fecha_publicacion) : new Date(), "yyyy-MM-dd"));
      setArea(comunicado ? (comunicado.area as AreaComunicado) : areaPorDefecto);
      setTipo(comunicado?.tipo === "formulario" ? "formulario" : "comunicado");
      setEnlace(comunicado?.enlace ?? "");
      setDuracion(comunicado ? duracionDe(comunicado.fecha_publicacion, comunicado.fecha_fin) : "1");
    }
  }

  const save = async () => {
    if (!titulo.trim() || !contenido.trim()) {
      toast({ title: "Error", description: "El título y el texto son obligatorios", variant: "destructive" });
      return;
    }
    if (tipo === "formulario" && !esEnlaceValido(enlace.trim())) {
      toast({
        title: "Error",
        description: "Indica el enlace al formulario (debe empezar por https://)",
        variant: "destructive",
      });
      return;
    }
    if (!fecha) {
      toast({ title: "Error", description: "Indica la fecha de publicación", variant: "destructive" });
      return;
    }

    const fechaOriginal = comunicado ? format(new Date(comunicado.fecha_publicacion), "yyyy-MM-dd") : null;
    // Al editar sin cambiar el día se conserva la hora original
    const fechaPublicacion = fecha === fechaOriginal ? comunicado!.fecha_publicacion : toFechaPublicacion(fecha);
    const duracionOriginal = comunicado ? duracionDe(comunicado.fecha_publicacion, comunicado.fecha_fin) : null;
    const values = {
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      fecha_publicacion: fechaPublicacion,
      tipo,
      enlace: tipo === "formulario" ? enlace.trim() : null,
      // Sin tocar la fecha ni la duración se conserva el fin original
      fecha_fin:
        fechaPublicacion === comunicado?.fecha_publicacion && duracion === duracionOriginal
          ? comunicado.fecha_fin
          : calcularFin(fechaPublicacion, duracion),
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
          {!comunicado && areas.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="comunicado-area">Área</Label>
              <Select value={area} onValueChange={(value) => setArea(value as AreaComunicado)}>
                <SelectTrigger id="comunicado-area" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREAS[a].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Tipo de nota</Label>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              className="justify-start"
              value={tipo}
              onValueChange={(value) => value && setTipo(value as TipoNota)}
              aria-label="Tipo de nota"
            >
              <ToggleGroupItem value="comunicado" className="px-3 text-xs">
                Comunicado
              </ToggleGroupItem>
              <ToggleGroupItem value="formulario" className="px-3 text-xs">
                Formulario
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comunicado-titulo">Título *</Label>
            <Input id="comunicado-titulo" maxLength={255} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="comunicado-contenido">{tipo === "formulario" ? "Descripción *" : "Texto *"}</Label>
            <Textarea
              id="comunicado-contenido"
              rows={tipo === "formulario" ? 5 : 8}
              placeholder={tipo === "formulario" ? "Para qué sirve el formulario, quién debe rellenarlo y hasta cuándo" : undefined}
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
            />
          </div>
          {tipo === "formulario" && (
            <div className="space-y-2">
              <Label htmlFor="comunicado-enlace">Enlace al formulario *</Label>
              <Input
                id="comunicado-enlace"
                type="url"
                inputMode="url"
                placeholder="https://forms.office.com/..."
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="comunicado-fecha">Fecha de publicación</Label>
              <Input
                id="comunicado-fecha"
                type="date"
                className="w-auto"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comunicado-duracion">Duración</Label>
              <Select value={duracion} onValueChange={(value) => setDuracion(value as Duracion)}>
                <SelectTrigger id="comunicado-duracion" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURACIONES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {duracion === "fijo"
              ? "Se queda en el tablón hasta que se elimine."
              : "Se retira del tablón al pasar ese tiempo desde la fecha de publicación."}
          </p>
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
