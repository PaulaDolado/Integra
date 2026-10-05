import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, HeartPulse, Loader2, Lock, Phone, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Fila = Database["public"]["Functions"]["contactos_emergencia_plantilla"]["Returns"][number];
type Filtro = "todos" | "sin_contacto";

interface Empleado {
  id: string;
  nombre: string;
  departamento: string | null;
  telefono: string | null;
  contactos: { id: string; nombre: string; relacion: string | null; telefono: string }[];
}

// Enlace tel: para poder llamar directamente desde el móvil
const Telefono = ({ numero }: { numero: string }) => (
  <a href={`tel:${numero.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 tabular-nums text-primary hover:underline">
    <Phone className="h-3 w-3" />
    {numero}
  </a>
);

export default function GestionContactosEmergencia() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const puedeVer = tiene("contactos_emergencia.ver");

  const { data: filas = [], isLoading: loading } = useQuery({
    queryKey: ["contactos-emergencia-plantilla"],
    queryFn: async (): Promise<Fila[]> => comprobar(await supabase.rpc("contactos_emergencia_plantilla")) ?? [],
    enabled: puedeVer,
  });

  // Una fila por contacto → un empleado con todos sus contactos
  const empleados = useMemo(() => {
    const mapa = new Map<string, Empleado>();
    for (const f of filas) {
      if (!mapa.has(f.empleado_id)) {
        mapa.set(f.empleado_id, { id: f.empleado_id, nombre: f.empleado, departamento: f.departamento, telefono: f.telefono_empleado, contactos: [] });
      }
      if (f.contacto_id && f.contacto && f.telefono) {
        mapa.get(f.empleado_id)!.contactos.push({ id: f.contacto_id, nombre: f.contacto, relacion: f.relacion, telefono: f.telefono });
      }
    }
    return [...mapa.values()];
  }, [filas]);

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
            <p className="font-medium">No tienes acceso a los contactos de emergencia</p>
            <p className="text-sm text-muted-foreground">Solo los puede consultar Recursos Humanos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const sinContacto = empleados.filter((e) => e.contactos.length === 0).length;
  const visibles = empleados
    .filter((e) => filtro === "todos" || e.contactos.length === 0)
    .filter(
      (e) =>
        !texto ||
        e.nombre.toLowerCase().includes(texto) ||
        (e.departamento ?? "").toLowerCase().includes(texto) ||
        e.contactos.some((c) => c.nombre.toLowerCase().includes(texto))
    );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-primary" />
          Contactos de emergencia
        </h1>
        <p className="text-muted-foreground mt-1">
          Personas a las que avisar en caso de emergencia. Datos confidenciales: úsalos solo cuando sea necesario.
        </p>
      </div>

      {/* Las pestañas filtran la tabla de abajo, que es su panel */}
      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)} className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="todos">Toda la plantilla ({empleados.length})</TabsTrigger>
            <TabsTrigger value="sin_contacto" className="gap-1.5">
              Sin contacto ({sinContacto})
            </TabsTrigger>
          </TabsList>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar empleado o contacto..." aria-label="Buscar empleado o contacto" className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>

        <TabsContent value={filtro} className="mt-0">
          <Card className="overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : visibles.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No hay empleados que coincidan</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Empleado</TableHead>
                      <TableHead>Contactos de emergencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((e) => (
                      <TableRow key={e.id} className="align-top">
                        <TableCell className="w-72">
                          <div className="font-medium">{e.nombre}</div>
                          <div className="text-xs text-muted-foreground">{e.departamento ?? "Sin departamento"}</div>
                          {e.telefono && (
                            <div className="mt-1 text-xs">
                              <Telefono numero={e.telefono} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {e.contactos.length === 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              No ha indicado ningún contacto
                            </span>
                          ) : (
                            <ul className="space-y-1.5">
                              {e.contactos.map((c) => (
                                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                                  <span className="font-medium">{c.nombre}</span>
                                  {c.relacion && <span className="text-muted-foreground">{c.relacion}</span>}
                                  <Telefono numero={c.telefono} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
