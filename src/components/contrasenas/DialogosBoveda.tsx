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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EntradaDescifrada } from "./contrasenas";
import { Generador } from "./Generador";

export function VaciarBovedaDialog({
  open,
  onOpenChange,
  onVaciar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVaciar: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Vaciar la bóveda?</AlertDialogTitle>
          <AlertDialogDescription>
            La contraseña maestra no se puede recuperar: tus contraseñas están cifradas con ella y nadie más tiene la
            clave. La única opción es borrar la bóveda con todo su contenido y crear una nueva. Esto no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onVaciar}>
            Vaciar la bóveda
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BorrarEntradaDialog({
  entrada,
  onCancel,
  onBorrar,
}: {
  entrada: EntradaDescifrada | null;
  onCancel: () => void;
  onBorrar: () => void;
}) {
  return (
    <AlertDialog open={entrada !== null} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar «{entrada?.nombre}»?</AlertDialogTitle>
          <AlertDialogDescription>La contraseña se borrará de tu bóveda. Esto no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onBorrar}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function GeneradorDialog({
  open,
  onOpenChange,
  onCopiar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopiar: (contrasena: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generador de contraseñas</DialogTitle>
          <DialogDescription>Contraseñas aleatorias generadas en tu navegador.</DialogDescription>
        </DialogHeader>
        <Generador onCopiar={onCopiar} />
      </DialogContent>
    </Dialog>
  );
}
