import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Landmark, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useAvisarError } from "@/hooks/useAvisarError";
import { formatIban, isValidIban, normalizeIban } from "@/lib/iban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FORMAS: Record<string, string> = { transferencia: "Transferencia" };
const CLAVE_DATOS_PAGO_PLANTILLA = ["datos-pago-plantilla"];

// Datos de pago de un empleado, dentro de su ficha en Gestión de Empleados.
// El IBAN llega siempre enmascarado: se puede cambiar, pero no ver entero.
export function DatosPagoPanel({ empleadoId }: { empleadoId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cambiando, setCambiando] = useState(false);
  const [iban, setIban] = useState("");
  const [guardando, setGuardando] = useState(false);

  // La plantilla ya viene enmascarada en el servidor; la comparte la página de Finanzas
  const { data: plantilla = [], isPending: cargando, error } = useQuery({
    queryKey: CLAVE_DATOS_PAGO_PLANTILLA,
    queryFn: async () => comprobar(await supabase.rpc("datos_pago_plantilla")) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar los datos de pago");
  const datos = plantilla.find((f) => f.empleado_id === empleadoId);

  const guardar = async () => {
    if (!isValidIban(iban)) {
      toast({ title: "Error", description: "El IBAN no es válido", variant: "destructive" });
      return;
    }
    setGuardando(true);
    const { error } = await supabase.rpc("guardar_datos_pago", {
      p_empleado: empleadoId,
      p_forma_pago: "transferencia",
      p_iban: normalizeIban(iban),
    });
    if (!error) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CLAVE_DATOS_PAGO_PLANTILLA }),
        queryClient.invalidateQueries({ queryKey: ["accesos-datos-pago"] }),
        // La sección de Configuración del propio empleado
        queryClient.invalidateQueries({ queryKey: ["datos-pago", empleadoId] }),
      ]);
    }
    setGuardando(false);

    if (error) {
      console.error("Error saving payment data:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el IBAN", variant: "destructive" });
      return;
    }
    toast({ title: "IBAN actualizado", description: "El cambio queda registrado con tu nombre" });
    setCambiando(false);
  };

  return (
    <section aria-labelledby="ficha-pago" className="space-y-3">
      <h3 id="ficha-pago" className="flex items-center gap-2 text-sm font-semibold">
        <Landmark className="h-4 w-4 text-primary" aria-hidden />
        Datos de pago
      </h3>

      {cargando ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Forma de pago</dt>
            <dd>{datos?.forma_pago ? (FORMAS[datos.forma_pago] ?? datos.forma_pago) : "—"}</dd>
            <dt className="text-muted-foreground">IBAN</dt>
            <dd className="font-mono tabular-nums">
              {datos?.iban_enmascarado ? (
                formatIban(datos.iban_enmascarado)
              ) : (
                <span className="font-sans text-amber-700 dark:text-amber-400">Sin IBAN</span>
              )}
            </dd>
            {datos?.actualizado && (
              <>
                <dt className="text-muted-foreground">Actualizado</dt>
                <dd>{format(new Date(datos.actualizado), "d MMM yyyy", { locale: es })}</dd>
              </>
            )}
          </dl>

          {cambiando ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="ficha-iban">Nuevo IBAN</Label>
                <Input
                  id="ficha-iban"
                  className="font-mono"
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  autoComplete="off"
                  value={iban}
                  onChange={(e) => setIban(formatIban(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">El cambio queda registrado con tu nombre.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCambiando(false)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={guardar} disabled={guardando || !iban}>
                  {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                  Guardar IBAN
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Nunca se precarga el IBAN guardado: hay que escribirlo completo
                setIban("");
                setCambiando(true);
              }}
            >
              Cambiar IBAN
            </Button>
          )}
        </>
      )}
    </section>
  );
}
