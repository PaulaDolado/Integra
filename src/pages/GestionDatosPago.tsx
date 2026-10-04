import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Copy, Download, Eye, EyeOff, History, Landmark, Loader2, Lock, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descargarCsv } from "@/components/fichajes/calculo";

type Fila = Database["public"]["Functions"]["datos_pago_plantilla"]["Returns"][number];

const CLAVE_ACCESOS = ["accesos-datos-pago"];
const FORMAS: Record<string, string> = { transferencia: "Transferencia" };
const agrupar = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

export default function GestionDatosPago() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  // IBAN completos que se han pedido en esta sesión (se ocultan al salir de la página).
  // Van en estado local a propósito, no en la caché de consultas: cada uno se pide
  // solo al pulsar «Mostrar», porque ver_iban() deja constancia en la auditoría.
  const [visibles, setVisibles] = useState<Map<string, string>>(new Map());
  const [consultando, setConsultando] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  const puedeVer = tiene("datos_pago.ver");

  // La plantilla solo trae el IBAN enmascarado
  const { data: filas = [], isLoading: loading } = useQuery({
    queryKey: ["datos-pago-plantilla"],
    queryFn: async () => comprobar(await supabase.rpc("datos_pago_plantilla")) ?? [],
    enabled: puedeVer,
  });
  const { data: accesos = [] } = useQuery({
    queryKey: CLAVE_ACCESOS,
    queryFn: async () => comprobar(await supabase.rpc("accesos_datos_pago_recientes")) ?? [],
    enabled: puedeVer,
  });

  // Consultar un IBAN o exportar queda en el historial: se vuelve a pedir
  const recargarAccesos = () => queryClient.invalidateQueries({ queryKey: CLAVE_ACCESOS });

  const alternar = async (fila: Fila) => {
    if (visibles.has(fila.empleado_id)) {
      const siguiente = new Map(visibles);
      siguiente.delete(fila.empleado_id);
      setVisibles(siguiente);
      return;
    }
    setConsultando(fila.empleado_id);
    const { data, error } = await supabase.rpc("ver_iban", { p_empleado: fila.empleado_id });
    setConsultando(null);
    if (error || !data) {
      toast({ title: "Error", description: error?.message ?? "No se pudo consultar el IBAN", variant: "destructive" });
      return;
    }
    setVisibles(new Map(visibles).set(fila.empleado_id, data));
    recargarAccesos();
  };

  const copiar = async (iban: string) => {
    try {
      await navigator.clipboard.writeText(iban);
      toast({ title: "IBAN copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const exportar = async () => {
    setExportando(true);
    const { data, error } = await supabase.rpc("exportar_datos_pago");
    setExportando(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    descargarCsv(`datos_pago_${format(new Date(), "yyyy-MM-dd")}.csv`, [
      ["Empleado", "Departamento", "Forma de pago", "IBAN"],
      ...(data ?? []).map((d) => [d.empleado, d.departamento ?? "", FORMAS[d.forma_pago] ?? d.forma_pago, d.iban ?? ""]),
    ]);
    toast({ title: "Exportación generada", description: "Queda registrada en el historial de accesos" });
    recargarAccesos();
  };

  if (cargandoPermisos) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!puedeVer) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No tienes acceso a los datos de pago</p>
            <p className="text-sm text-muted-foreground">Solo los puede consultar Finanzas y Contabilidad.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const mostrados = filas.filter(
    (f) => !texto || f.empleado.toLowerCase().includes(texto) || (f.departamento ?? "").toLowerCase().includes(texto)
  );
  const sinIban = filas.filter((f) => !f.iban_enmascarado).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Datos de pago
          </h1>
          <p className="text-muted-foreground mt-1">Forma de pago e IBAN de la plantilla para la nómina.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportar} disabled={exportando || filas.length === sinIban}>
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar para la nómina
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p>
          Los IBAN se muestran ocultos. Cada vez que consultas uno completo o exportas el listado, queda registrado quién lo
          hizo y cuándo.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filas.length} empleado{filas.length === 1 ? "" : "s"} activo{filas.length === 1 ? "" : "s"}
          {sinIban > 0 && <span className="text-amber-700 dark:text-amber-400"> · {sinIban} sin IBAN</span>}
        </p>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar empleado o departamento..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : mostrados.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No hay empleados que coincidan</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Empleado</TableHead>
                  <TableHead>Forma de pago</TableHead>
                  <TableHead>IBAN</TableHead>
                  <TableHead>Actualizado</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mostrados.map((f) => {
                  const completo = visibles.get(f.empleado_id);
                  return (
                    <TableRow key={f.empleado_id}>
                      <TableCell>
                        <div className="font-medium">{f.empleado}</div>
                        <div className="text-xs text-muted-foreground">{f.departamento ?? "Sin departamento"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{f.forma_pago ? FORMAS[f.forma_pago] ?? f.forma_pago : "—"}</TableCell>
                      <TableCell className="font-mono text-sm tabular-nums">
                        {f.iban_enmascarado ? (
                          agrupar(completo ?? f.iban_enmascarado)
                        ) : (
                          <span className="font-sans text-amber-700 dark:text-amber-400">Sin IBAN</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {f.actualizado ? format(new Date(f.actualizado), "d MMM yyyy", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell>
                        {f.iban_enmascarado && (
                          <div className="flex justify-end gap-1">
                            {completo && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Copiar IBAN" onClick={() => copiar(completo)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={completo ? "Ocultar IBAN" : "Mostrar IBAN completo"}
                              title={completo ? "Ocultar" : "Mostrar (queda registrado)"}
                              onClick={() => alternar(f)}
                              disabled={consultando === f.empleado_id}
                            >
                              {consultando === f.empleado_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : completo ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            Últimos accesos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accesos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie ha consultado todavía ningún IBAN completo.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {accesos.map((a) => (
                <li key={a.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{a.autor}</span>
                  {a.accion === "exportar" ? "exportó los datos de pago de la plantilla" : <>consultó el IBAN de {a.empleado}</>}
                  <span>· {format(new Date(a.created_at), "d MMM yyyy HH:mm", { locale: es })}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
