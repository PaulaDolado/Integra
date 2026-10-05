import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface ComentarioDialogProps {
  open: boolean;
  titulo: string;
  descripcion: string;
  confirmar: string;
  destructivo?: boolean;
  // Si es obligatorio, no se puede confirmar sin escribir nada
  comentarioObligatorio?: boolean;
  onCancel: () => void;
  onConfirm: (comentario: string) => Promise<void>;
}

// Confirmación con un comentario opcional u obligatorio (aceptar, rechazar, aprobar)
export function ComentarioDialog({
  open,
  titulo,
  descripcion,
  confirmar,
  destructivo,
  comentarioObligatorio,
  onCancel,
  onConfirm,
}: ComentarioDialogProps) {
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Al abrirse, el comentario empieza vacío
  const [abierto, setAbierto] = useState(false);
  if (open !== abierto) {
    setAbierto(open);
    if (open) setComentario("");
  }

  const enviar = async () => {
    setEnviando(true);
    await onConfirm(comentario.trim());
    setEnviando(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="comentario-turno">Comentario {comentarioObligatorio ? "*" : "(opcional)"}</Label>
          <Textarea id="comentario-turno" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant={destructivo ? "destructive" : "default"}
            onClick={enviar}
            disabled={enviando || (comentarioObligatorio && !comentario.trim())}
          >
            {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
