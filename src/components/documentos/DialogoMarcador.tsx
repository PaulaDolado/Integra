import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DialogoMarcadorProps {
  open: boolean;
  nombreInicial: string;
  onCancel: () => void;
  // Al cerrarse, el foco vuelve al editor (y no al botón de la barra)
  onCerrado?: () => void;
  onGuardar: (nombre: string) => void;
}

export function DialogoMarcador({ open, onCerrado, nombreInicial, onCancel, onGuardar }: DialogoMarcadorProps) {
  const [nombre, setNombre] = useState("");

  const [abierto, setAbierto] = useState(false);
  if (open !== abierto) {
    setAbierto(open);
    if (open) setNombre(nombreInicial);
  }

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim()) onGuardar(nombre.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent
        className="sm:max-w-sm"
        onCloseAutoFocus={(e) => {
          if (!onCerrado) return;
          e.preventDefault();
          onCerrado();
        }}
      >
        <form onSubmit={guardar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Añadir marcador</DialogTitle>
            <DialogDescription>Marca este punto para volver a él desde el panel de marcadores o enlazarlo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="marcador-nombre">Nombre</Label>
            <Input id="marcador-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nombre.trim()}>
              Añadir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
