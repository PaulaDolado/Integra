import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatIban, isValidIban, normalizeIban } from "@/lib/iban";
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

interface DatosPagoDialogProps {
  // null = cerrado
  empleado: { id: string; nombre: string; iban_enmascarado: string | null } | null;
  onClose: () => void;
}

// RRHH cambia el IBAN de un empleado sin llegar a ver el completo
export function DatosPagoDialog({ empleado, onClose }: DatosPagoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [iban, setIban] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Nunca se precarga el IBAN guardado: hay que escribirlo completo
  const [previo, setPrevio] = useState(empleado?.id);
  if (empleado?.id !== previo) {
    setPrevio(empleado?.id);
    setIban("");
  }

  const guardar = async () => {
    if (!empleado) return;
    if (!isValidIban(iban)) {
      toast({ title: "Error", description: "El IBAN no es válido", variant: "destructive" });
      return;
    }
    setGuardando(true);
    const { error } = await supabase.rpc("guardar_datos_pago", {
      p_empleado: empleado.id,
      p_forma_pago: "transferencia",
      p_iban: normalizeIban(iban),
    });
    if (!error) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["datos-pago-plantilla"] }),
        queryClient.invalidateQueries({ queryKey: ["accesos-datos-pago"] }),
        // La sección de Configuración del propio empleado
        queryClient.invalidateQueries({ queryKey: ["datos-pago", empleado.id] }),
      ]);
    }
    setGuardando(false);

    if (error) {
      console.error("Error saving payment data:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el IBAN", variant: "destructive" });
      return;
    }
    toast({ title: "IBAN actualizado", description: "El cambio queda registrado en el historial de accesos" });
    onClose();
  };

  return (
    <Dialog open={!!empleado} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar datos de pago</DialogTitle>
          <DialogDescription>{empleado?.nombre}. El cambio queda registrado con tu nombre.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">Forma de pago</span>
            <span>Transferencia</span>
            <span className="text-muted-foreground">IBAN actual</span>
            <span className="font-mono tabular-nums">
              {empleado?.iban_enmascarado ? formatIban(empleado.iban_enmascarado) : "Sin IBAN"}
            </span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rrhh-iban">Nuevo IBAN</Label>
            <Input
              id="rrhh-iban"
              className="font-mono"
              placeholder="ES00 0000 0000 0000 0000 0000"
              autoComplete="off"
              value={iban}
              onChange={(e) => setIban(formatIban(e.target.value))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !iban}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
