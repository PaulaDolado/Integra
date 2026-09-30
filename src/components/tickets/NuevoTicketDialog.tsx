import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import {
  ORDEN_PRIORIDADES,
  ORDEN_TIPOS,
  PRIORIDADES,
  TIPOS,
  type PrioridadTicket,
  type TipoTicket,
} from "./ticket-config";
import { SelectorImagenes } from "./SelectorImagenes";
import { imagenesDelPortapapeles, subirAdjuntos, validarImagenes } from "./adjuntos";

interface NuevoTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticketId: string) => void;
}

export function NuevoTicketDialog({ open, onOpenChange, onCreated }: NuevoTicketDialogProps) {
  const { toast } = useToast();
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<TipoTicket>("incidencia");
  const [prioridad, setPrioridad] = useState<PrioridadTicket>("media");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitulo("");
    setDescripcion("");
    setTipo("incidencia");
    setPrioridad("media");
    setArchivos([]);
  }, [open]);

  const pegar = (event: React.ClipboardEvent) => {
    const imagenes = imagenesDelPortapapeles(event);
    if (imagenes.length === 0) return;
    event.preventDefault();
    const { validas, errores } = validarImagenes(imagenes, archivos);
    if (errores.length > 0) toast({ title: "Algunas imágenes no se han añadido", description: errores.join(". "), variant: "destructive" });
    setArchivos([...archivos, ...validas]);
  };

  const crear = async () => {
    if (!titulo.trim() || !descripcion.trim()) {
      toast({ title: "Error", description: "El título y la descripción son obligatorios", variant: "destructive" });
      return;
    }

    setEnviando(true);
    const { data: autorId } = await supabase.rpc("mi_empleado_id");
    const { data, error } = await supabase
      .from("tickets")
      .insert({ titulo: titulo.trim(), descripcion: descripcion.trim(), tipo, prioridad, autor_id: autorId, estado: "nuevo" })
      .select("id")
      .single();
    if (error || !data) {
      setEnviando(false);
      console.error("Error creating ticket:", error);
      toast({ title: "Error", description: "No se pudo crear el ticket", variant: "destructive" });
      return;
    }

    const { fallidas } = await subirAdjuntos(data.id, null, archivos);
    setEnviando(false);

    toast({
      title: "Ticket creado",
      description: fallidas > 0
        ? `No se pudieron adjuntar ${fallidas} imagen(es); puedes añadirlas desde el ticket`
        : "El equipo de soporte lo revisará en breve",
      variant: fallidas > 0 ? "destructive" : undefined,
    });
    onOpenChange(false);
    onCreated?.(data.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo ticket</DialogTitle>
          <DialogDescription>Describe la incidencia o la petición para el equipo de soporte.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoTicket)}>
                <SelectTrigger id="ticket-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEN_TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPOS[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-prioridad">Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as PrioridadTicket)}>
                <SelectTrigger id="ticket-prioridad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDEN_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORIDADES[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-titulo">Título *</Label>
            <Input
              id="ticket-titulo"
              maxLength={255}
              placeholder={tipo === "incidencia" ? "Ej.: No puedo acceder al correo" : "Ej.: Necesito un monitor adicional"}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-descripcion">Descripción *</Label>
            <Textarea
              id="ticket-descripcion"
              rows={6}
              placeholder="Qué ocurre, desde cuándo y cualquier detalle que ayude a resolverlo"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              onPaste={pegar}
            />
            <SelectorImagenes archivos={archivos} onChange={setArchivos} disabled={enviando} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={enviando}>
            {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
