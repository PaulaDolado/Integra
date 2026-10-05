import { useState } from "react";
import { CheckCircle2, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAvisarFallo } from "./useAvisarFallo";

interface ValoracionSolucionProps {
  ticketId: string;
  // Compartido con el redactor: mientras se envía algo no se puede hacer otra acción
  enviando: boolean;
  setEnviando: (enviando: boolean) => void;
  recargar: () => void;
}

// Aviso al solicitante de un ticket resuelto para que apruebe o rechace la solución
export function ValoracionSolucion({ ticketId, enviando, setEnviando, recargar }: ValoracionSolucionProps) {
  const { toast } = useToast();
  const avisarFallo = useAvisarFallo();
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");

  const valorar = async (aprobar: boolean) => {
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("valorar_solucion", {
        p_ticket: ticketId,
        p_aprobar: aprobar,
        p_comentario: aprobar ? undefined : motivoRechazo.trim(),
      });
      if (error) {
        avisarFallo(error);
        return;
      }
      toast({ title: aprobar ? "Solución aprobada" : "Solución rechazada", description: aprobar ? "El ticket se ha cerrado" : "El ticket vuelve a estar en curso" });
      setRechazando(false);
      setMotivoRechazo("");
      recargar();
    } catch (error) {
      avisarFallo(error);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-medium">Se ha propuesto una solución</p>
              <p className="text-sm text-muted-foreground">¿Resuelve tu solicitud? Si la apruebas, el ticket se cierra.</p>
            </div>
          </div>
          {!rechazando && (
            <div className="flex gap-2 sm:shrink-0">
              <Button variant="outline" className="gap-1" onClick={() => setRechazando(true)} disabled={enviando}>
                <ThumbsDown className="w-4 h-4" />
                Rechazar
              </Button>
              <Button className="gap-1" onClick={() => valorar(true)} disabled={enviando}>
                <ThumbsUp className="w-4 h-4" />
                Aprobar solución
              </Button>
            </div>
          )}
        </div>
        {rechazando && (
          <div className="space-y-2">
            <Label htmlFor="motivo-rechazo">¿Por qué no resuelve tu solicitud?</Label>
            <Textarea
              id="motivo-rechazo"
              rows={3}
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="El ticket volverá a estar en curso con tu comentario"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRechazando(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={() => valorar(false)} disabled={enviando || !motivoRechazo.trim()}>
                Rechazar solución
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
