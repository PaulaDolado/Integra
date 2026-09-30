import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, ChevronDown, Clock, Download, Loader2, Lock, PencilLine, Plus, Search, UserCheck, UserX, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePermisos } from "@/hooks/usePermisos";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { descargarCsv, esCorregido, formatHoras, resumirFichajes, type Fichaje } from "@/components/fichajes/calculo";
import { CorreccionFichajesDialog } from "@/components/fichajes/CorreccionFichajesDialog";

type Empleado = Database["public"]["Functions"]["plantilla_fichajes"]["Returns"][number];
type Correccion = Database["public"]["Tables"]["fichaje_correcciones"]["Row"];

const CAMPOS_FICHAJE = "id, empleado_id, tipo, fecha_hora, es_manual, anulado, fecha_hora_original, justificacion";

const describirCorreccion = (c: Correccion) => {
  const tipo = c.tipo === "entrada" ? "entrada" : "salida";
  const h = (v: string | null) => (v ? format(new Date(v), "d MMM HH:mm", { locale: es }) : "");
  switch (c.accion) {
    case "alta":
      return `Añadida ${tipo} de ${h(c.fecha_hora_nueva)}`;
    case "modificacion":
      return `Cambiada ${tipo}: ${h(c.fecha_hora_anterior)} → ${format(new Date(c.fecha_hora_nueva ?? ""), "HH:mm")}`;
    default:
      return `Anulada ${tipo} de ${h(c.fecha_hora_anterior)}`;
  }
};
type Periodo = "hoy" | "semana" | "mes" | "personalizado";

const TODOS = "todos";
const SEMANA = { weekStartsOn: 1 as const };

const hora = (fecha: Date) => format(fecha, "HH:mm");

function rangoDe(periodo: Periodo, desde: string, hasta: string) {
  const hoy = new Date();
  switch (periodo) {
    case "hoy":
      return { inicio: startOfDay(hoy), fin: endOfDay(hoy) };
    case "semana":
      return { inicio: startOfWeek(hoy, SEMANA), fin: endOfWeek(hoy, SEMANA) };
    case "mes":
      return { inicio: startOfMonth(hoy), fin: endOfMonth(hoy) };
    default:
      return { inicio: startOfDay(new Date(`${desde}T00:00`)), fin: endOfDay(new Date(`${hasta}T00:00`)) };
  }
}

export default function GestionFichajes() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const [plantilla, setPlantilla] = useState<Empleado[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [fichajesHoy, setFichajesHoy] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [desde, setDesde] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [hasta, setHasta] = useState(format(new Date(), "yyyy-MM-dd"));
  const [departamento, setDepartamento] = useState(TODOS);
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [correcciones, setCorrecciones] = useState<Correccion[]>([]);
  const [autores, setAutores] = useState<Map<string, string>>(new Map());
  const [miId, setMiId] = useState<string | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<{ empleado: Empleado; fecha: string } | null>(null);

  const puedeVer = tiene("fichajes.ver_todos");
  // Nadie corrige sus propios fichajes
  const puedeCorregir = (empleadoId: string) => tiene("fichajes.editar") && empleadoId !== miId;
  const { inicio, fin } = rangoDe(periodo, desde, hasta);
  const rangoValido = inicio <= fin;

  const cargar = useCallback(async () => {
    if (!rangoValido) return;
    const hoy = new Date();
    const desdeIso = inicio.toISOString();
    const hastaIso = fin.toISOString();
    const [p, f, h, c, a, yo] = await Promise.all([
      supabase.rpc("plantilla_fichajes"),
      supabase.from("fichajes").select(CAMPOS_FICHAJE).gte("fecha_hora", desdeIso).lte("fecha_hora", hastaIso).order("fecha_hora"),
      // "Trabajando ahora" siempre se calcula con los fichajes de hoy
      supabase
        .from("fichajes")
        .select(CAMPOS_FICHAJE)
        .gte("fecha_hora", startOfDay(hoy).toISOString())
        .lte("fecha_hora", endOfDay(hoy).toISOString())
        .order("fecha_hora"),
      // Correcciones que afectan a fichajes del periodo
      supabase
        .from("fichaje_correcciones")
        .select("*")
        .or(
          `and(fecha_hora_nueva.gte.${desdeIso},fecha_hora_nueva.lte.${hastaIso}),and(fecha_hora_anterior.gte.${desdeIso},fecha_hora_anterior.lte.${hastaIso})`
        )
        .order("created_at", { ascending: false }),
      supabase.rpc("autores_correcciones_fichajes"),
      supabase.rpc("mi_empleado_id"),
    ]);
    if (p.error || f.error || h.error) {
      console.error("Error fetching fichajes:", p.error ?? f.error ?? h.error);
      toast({ title: "Error", description: "No se pudieron cargar los fichajes", variant: "destructive" });
    } else {
      setPlantilla(p.data ?? []);
      setFichajes(f.data ?? []);
      setFichajesHoy(h.data ?? []);
      setCorrecciones(c.data ?? []);
      setAutores(new Map((a.data ?? []).map((x) => [x.id, x.nombre])));
      setMiId(yo.data ?? null);
    }
    setLoading(false);
    // inicio y fin se derivan de periodo/desde/hasta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, desde, hasta, rangoValido, toast]);

  useEffect(() => {
    if (!puedeVer) return;
    cargar();
    const channel = supabase
      .channel("gestion-fichajes-changes")
      // Altas, modificaciones y anulaciones
      .on("postgres_changes", { event: "*", schema: "public", table: "fichajes" }, () => cargar())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [puedeVer, cargar]);

  const departamentos = useMemo(() => {
    const mapa = new Map<string, string>();
    plantilla.forEach((e) => e.departamento_id && e.departamento && mapa.set(e.departamento_id, e.departamento));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [plantilla]);

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return plantilla
      .filter((e) => departamento === TODOS || e.departamento_id === departamento)
      .filter((e) => !texto || e.nombre.toLowerCase().includes(texto))
      .map((e) => ({
        empleado: e,
        resumen: resumirFichajes(fichajes.filter((f) => f.empleado_id === e.id)),
        hoy: resumirFichajes(fichajesHoy.filter((f) => f.empleado_id === e.id)),
      }));
  }, [plantilla, fichajes, fichajesHoy, departamento, busqueda]);

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
            <p className="font-medium">No tienes acceso a los fichajes de la plantilla</p>
            <p className="text-sm text-muted-foreground">Solo los pueden ver Recursos Humanos y Dirección General.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trabajando = filas.filter((f) => f.hoy.trabajandoDesde).length;
  const hanFichadoHoy = filas.filter((f) => f.hoy.ultimoFichaje).length;
  const sinFichar = filas.length - hanFichadoHoy;
  const minutosTotales = filas.reduce((total, f) => total + f.resumen.minutos, 0);
  const incidencias = filas.reduce((total, f) => total + f.resumen.incidencias, 0);

  const exportar = () => {
    const nombres = new Map(plantilla.map((e) => [e.id, e]));
    const visibles = new Set(filas.map((f) => f.empleado.id));
    // Incluye los fichajes corregidos y anulados, con su estado y motivo, para la auditoría
    const lineas: (string | number)[][] = [
      ["Empleado", "Departamento", "Fecha", "Hora", "Tipo", "Estado", "Hora original", "Justificación"],
    ];
    const estado = (f: Fichaje) => (f.anulado ? "Anulado" : f.es_manual ? "Añadido manualmente" : f.fecha_hora_original ? "Hora modificada" : "Original");
    fichajes
      .filter((f) => visibles.has(f.empleado_id))
      .forEach((f) => {
        const e = nombres.get(f.empleado_id);
        const momento = new Date(f.fecha_hora);
        lineas.push([
          e?.nombre ?? "",
          e?.departamento ?? "",
          format(momento, "dd/MM/yyyy"),
          format(momento, "HH:mm:ss"),
          f.tipo === "entrada" ? "Entrada" : "Salida",
          estado(f),
          f.fecha_hora_original ? format(new Date(f.fecha_hora_original), "HH:mm:ss") : "",
          esCorregido(f) || f.anulado ? f.justificacion ?? "" : "",
        ]);
      });
    descargarCsv(`fichajes_${format(inicio, "yyyy-MM-dd")}_${format(fin, "yyyy-MM-dd")}.csv`, lineas);
  };

  const etiquetaPeriodo =
    periodo === "hoy"
      ? format(inicio, "EEEE, d 'de' MMMM", { locale: es })
      : `${format(inicio, "d MMM", { locale: es })} – ${format(fin, "d MMM yyyy", { locale: es })}`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Fichajes de la plantilla
          </h1>
          <p className="text-muted-foreground mt-1">Horas trabajadas, quién está trabajando y fichajes incompletos.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportar} disabled={!rangoValido || fichajes.length === 0}>
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Hoy */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador icono={UserCheck} etiqueta="Trabajando ahora" valor={trabajando} tono="text-green-600" />
        <Indicador icono={Users} etiqueta="Han fichado hoy" valor={hanFichadoHoy} tono="text-primary" />
        <Indicador icono={UserX} etiqueta="Sin fichar hoy" valor={sinFichar} tono="text-muted-foreground" />
        <Indicador icono={AlertTriangle} etiqueta="Incidencias del periodo" valor={incidencias} tono={incidencias ? "text-amber-600" : "text-muted-foreground"} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <ToggleGroup
            type="single"
            variant="outline"
            value={periodo}
            onValueChange={(v) => v && setPeriodo(v as Periodo)}
            aria-label="Periodo"
          >
            <ToggleGroupItem value="hoy" className="px-3">Hoy</ToggleGroupItem>
            <ToggleGroupItem value="semana" className="px-3">Esta semana</ToggleGroupItem>
            <ToggleGroupItem value="mes" className="px-3">Este mes</ToggleGroupItem>
            <ToggleGroupItem value="personalizado" className="px-3">Personalizado</ToggleGroupItem>
          </ToggleGroup>
          {periodo === "personalizado" && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="fichajes-desde" className="text-xs">Desde</Label>
                <Input id="fichajes-desde" type="date" className="w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fichajes-hasta" className="text-xs">Hasta</Label>
                <Input id="fichajes-hasta" type="date" className="w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </div>
          )}
          <span className="pb-2 text-sm text-muted-foreground first-letter:uppercase">
            {rangoValido ? etiquetaPeriodo : "La fecha de inicio es posterior a la de fin"}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={departamento} onValueChange={setDepartamento}>
            <SelectTrigger className="sm:w-56" aria-label="Filtrar por departamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los departamentos</SelectItem>
              {departamentos.map(([id, nombre]) => (
                <SelectItem key={id} value={id}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar empleado..." className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No hay empleados que coincidan</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Empleado</TableHead>
                  <TableHead>Ahora</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead className="text-right">Horas del periodo</TableHead>
                  <TableHead className="text-right">Media diaria</TableHead>
                  <TableHead>Incidencias</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Detalle</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(({ empleado, resumen, hoy }) => {
                  const expandido = abierto === empleado.id;
                  return (
                    <Fragment key={empleado.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setAbierto(expandido ? null : empleado.id)}
                        aria-expanded={expandido}
                      >
                        <TableCell>
                          <div className="font-medium">{empleado.nombre}</div>
                          <div className="text-xs text-muted-foreground">{empleado.departamento ?? "Sin departamento"}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {hoy.trabajandoDesde ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                              <span className="h-2 w-2 rounded-full bg-green-500" />
                              Trabajando desde las {hora(hoy.trabajandoDesde)}
                            </span>
                          ) : hoy.ultimoFichaje ? (
                            <span className="text-sm text-muted-foreground">Salió a las {hora(hoy.ultimoFichaje)}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin fichar hoy</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{resumen.diasTrabajados}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatHoras(resumen.minutos)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {resumen.diasTrabajados ? formatHoras(Math.round(resumen.minutos / resumen.diasTrabajados)) : "—"}
                        </TableCell>
                        <TableCell>
                          {resumen.incidencias > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              {resumen.incidencias} incompleto{resumen.incidencias > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ease-out ${expandido ? "rotate-180" : ""}`}
                          />
                        </TableCell>
                      </TableRow>
                      {expandido && (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={7} className="p-0">
                            {resumen.dias.length === 0 ? (
                              <p className="px-6 py-4 text-sm text-muted-foreground">Sin fichajes en este periodo.</p>
                            ) : (
                              <ul className="divide-y">
                                {resumen.dias.map((dia) => (
                                  <li key={dia.fecha} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-center sm:gap-6">
                                    <span className="w-40 shrink-0 text-sm font-medium capitalize">
                                      {format(new Date(`${dia.fecha}T00:00`), "EEE d MMM", { locale: es })}
                                    </span>
                                    <span className="flex flex-1 flex-wrap gap-2">
                                      {dia.tramos.map((t, i) => (
                                        <span
                                          key={i}
                                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs tabular-nums ${
                                            t.enCurso
                                              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                                              : t.minutos === null
                                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                                : "bg-card"
                                          }`}
                                          title={[
                                            t.minutos === null && !t.enCurso ? (t.entrada ? "Falta la salida" : "Falta la entrada") : "",
                                            ...t.correcciones.map((c) => `Corregido: ${c}`),
                                          ]
                                            .filter(Boolean)
                                            .join("\n") || undefined}
                                        >
                                          {t.correcciones.length > 0 && <PencilLine className="h-3 w-3 text-primary" aria-label="Corregido" />}
                                          {t.entrada ? hora(t.entrada) : "¿?"} – {t.salida ? hora(t.salida) : t.enCurso ? "ahora" : "¿?"}
                                        </span>
                                      ))}
                                    </span>
                                    <span className="text-sm tabular-nums text-muted-foreground sm:w-28 sm:text-right">
                                      {formatHoras(dia.minutos)}
                                    </span>
                                    {puedeCorregir(empleado.id) && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 self-start px-2 text-xs sm:self-auto"
                                        onClick={() => setCorrigiendo({ empleado, fecha: dia.fecha })}
                                      >
                                        <PencilLine className="h-3.5 w-3.5" />
                                        Corregir
                                      </Button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {puedeCorregir(empleado.id) && (
                              <div className="border-t px-6 py-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() =>
                                    setCorrigiendo({
                                      empleado,
                                      // Por defecto, el último día del periodo que no sea futuro
                                      fecha: format(fin > new Date() ? new Date() : fin, "yyyy-MM-dd"),
                                    })
                                  }
                                >
                                  <Plus className="h-4 w-4" />
                                  Añadir fichajes olvidados
                                </Button>
                              </div>
                            )}
                            {correcciones.filter((c) => c.empleado_id === empleado.id).length > 0 && (
                              <div className="border-t px-6 py-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Correcciones del periodo
                                </p>
                                <ul className="space-y-1.5">
                                  {correcciones
                                    .filter((c) => c.empleado_id === empleado.id)
                                    .map((c) => (
                                      <li key={c.id} className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{describirCorreccion(c)}</span>
                                        {" · "}«{c.justificacion}» · {autores.get(c.autor_id ?? "") ?? "RRHH"},{" "}
                                        {format(new Date(c.created_at), "d MMM yyyy HH:mm", { locale: es })}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      {rangoValido && (
        <p className="text-xs text-muted-foreground">
          Total del periodo para los empleados mostrados: <span className="font-medium tabular-nums">{formatHoras(minutosTotales)}</span>.
          Los tramos en ámbar son fichajes incompletos (falta la entrada o la salida); el lápiz indica un fichaje corregido.
        </p>
      )}

      <CorreccionFichajesDialog
        open={!!corrigiendo}
        onOpenChange={(open) => !open && setCorrigiendo(null)}
        empleado={corrigiendo?.empleado ?? null}
        fecha={corrigiendo?.fecha ?? ""}
        onSaved={cargar}
      />
    </div>
  );
}

function Indicador({
  icono: Icon,
  etiqueta,
  valor,
  tono,
}: {
  icono: typeof Clock;
  etiqueta: string;
  valor: number;
  tono: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${tono}`} />
        <div>
          <div className="text-2xl font-semibold tabular-nums leading-none">{valor}</div>
          <div className="mt-1 text-xs text-muted-foreground">{etiqueta}</div>
        </div>
      </CardContent>
    </Card>
  );
}
