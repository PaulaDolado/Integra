import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampoMaestra } from "./AccesoBoveda";
import { errorMaestra } from "./contrasenas";
import { IndicadorFuerza } from "./IndicadorFuerza";

interface CambiarMaestraDialogProps {
  open: boolean;
  onCancel: () => void;
  // Devuelve un mensaje de error, o null si se ha cambiado
  onCambiar: (actual: string, nueva: string) => Promise<string | null>;
}

export function CambiarMaestraDialog({ open, onCancel, onCambiar }: CambiarMaestraDialogProps) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (open) {
      setActual("");
      setNueva("");
      setConfirmacion("");
      setError(null);
    }
  }, [open]);

  const cambiar = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalida = errorMaestra(nueva, confirmacion);
    if (invalida) return setError(invalida);
    if (nueva === actual) return setError("La nueva contraseña debe ser distinta de la actual");
    setCambiando(true);
    setError(await onCambiar(actual, nueva));
    setCambiando(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !cambiando && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={cambiar} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cambiar la contraseña maestra</DialogTitle>
            <DialogDescription>Todas tus contraseñas se cifrarán de nuevo con la nueva clave.</DialogDescription>
          </DialogHeader>
          <CampoMaestra id="maestra-actual" label="Contraseña maestra actual" value={actual} onChange={setActual} autoFocus autoComplete="current-password" />
          <div className="space-y-2">
            <CampoMaestra id="maestra-cambio" label="Nueva contraseña maestra" value={nueva} onChange={setNueva} autoComplete="new-password" />
            <IndicadorFuerza contrasena={nueva} />
          </div>
          <CampoMaestra id="maestra-cambio-confirmar" label="Repite la nueva contraseña" value={confirmacion} onChange={setConfirmacion} autoComplete="new-password" />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={cambiando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={cambiando || !actual || !nueva}>
              {cambiando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cambiar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
