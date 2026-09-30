import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Lock, Pencil, Plus, Search, ShieldCheck, UserCog, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePermisos } from "@/hooks/usePermisos";
import { notifyEmployeeProfileUpdated } from "@/hooks/useEmployeeProfile";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Empleado = Database["public"]["Functions"]["gestion_empleados"]["Returns"][number];
type Opcion = { id: string; nombre: string };
type Estado = "activos" | "bajas" | "todos";

const SIN_ASIGNAR = "none";
const TODOS = "todos";

const emptyForm = {
  nombre: "",
  primer_apellido: "",
  segundo_apellido: "",
  correo: "",
  telefono: "",
  cargo_id: SIN_ASIGNAR,
  departamento_id: SIN_ASIGNAR,
  fecha_ingreso: format(new Date(), "yyyy-MM-dd"),
  activo: true,
};

const nombreCompleto = (e: Empleado) =>
  [e.nombre, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ");

const iniciales = (e: Empleado) => `${e.nombre.charAt(0)}${e.primer_apellido.charAt(0)}`.toUpperCase();

export default function GestionEmpleados() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Opcion[]>([]);
  const [departamentos, setDepartamentos] = useState<Opcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<Estado>("activos");
  const [departamentoFiltro, setDepartamentoFiltro] = useState(TODOS);
  const [busqueda, setBusqueda] = useState("");
  // undefined = cerrado, null = alta de un empleado nuevo
  const [editando, setEditando] = useState<Empleado | null | undefined>(undefined);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const puedeGestionar = tiene("empleados.gestionar");

  const fetchEmpleados = useCallback(async () => {
    const { data, error } = await supabase.rpc("gestion_empleados");
    if (error) {
      console.error("Error fetching empleados:", error);
      toast({ title: "Error", description: "No se pudo cargar la plantilla", variant: "destructive" });
    } else {
      setEmpleados(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!puedeGestionar) return;
    fetchEmpleados();
    Promise.all([
      supabase.from("cargos").select("id, nombre").order("nombre"),
      supabase.from("departamentos").select("id, nombre").order("nombre"),
    ]).then(([c, d]) => {
      setCargos(c.data ?? []);
      setDepartamentos(d.data ?? []);
    });
  }, [puedeGestionar, fetchEmpleados]);

  const abrir = (empleado: Empleado | null) => {
    setForm(
      empleado
        ? {
            nombre: empleado.nombre,
            primer_apellido: empleado.primer_apellido,
            segundo_apellido: empleado.segundo_apellido,
            correo: empleado.correo_electronico,
            telefono: empleado.numero_telefono ?? "",
            cargo_id: empleado.cargo_id ?? SIN_ASIGNAR,
            departamento_id: empleado.departamento_id ?? SIN_ASIGNAR,
            fecha_ingreso: empleado.fecha_ingreso,
            activo: empleado.activo,
          }
        : { ...emptyForm, fecha_ingreso: format(new Date(), "yyyy-MM-dd") }
    );
    setEditando(empleado);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.primer_apellido.trim() || !form.correo.trim()) {
      toast({ title: "Error", description: "El nombre, el primer apellido y el correo son obligatorios", variant: "destructive" });
      return;
    }

    setGuardando(true);
    const { error } = await supabase.rpc("guardar_empleado", {
      p_id: editando?.id ?? null,
      p_nombre: form.nombre,
      p_primer_apellido: form.primer_apellido,
      p_segundo_apellido: form.segundo_apellido,
      p_correo: form.correo,
      p_telefono: form.telefono || null,
      p_cargo_id: form.cargo_id === SIN_ASIGNAR ? null : form.cargo_id,
      p_departamento_id: form.departamento_id === SIN_ASIGNAR ? null : form.departamento_id,
      p_fecha_ingreso: form.fecha_ingreso || null,
      p_activo: form.activo,
    });
    setGuardando(false);

    if (error) {
      console.error("Error saving empleado:", error);
      toast({ title: "Error", description: error.message || "No se pudo guardar el empleado", variant: "destructive" });
      return;
    }

    toast({
      title: editando ? "Empleado actualizado" : "Empleado dado de alta",
      description: editando
        ? "Los cambios se han guardado"
        : "Cuando tenga cuenta con ese correo, la ficha se vinculará automáticamente",
    });
    if (editando?.es_yo) notifyEmployeeProfileUpdated();
    setEditando(undefined);
    fetchEmpleados();
  };

  if (cargandoPermisos) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!puedeGestionar) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No tienes acceso a la gestión de empleados</p>
            <p className="text-sm text-muted-foreground">Solo la puede usar Recursos Humanos.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const porEstado = (e: Empleado) => estado === "todos" || (estado === "activos" ? e.activo : !e.activo);
  const visibles = empleados.filter(
    (e) =>
      porEstado(e) &&
      (departamentoFiltro === TODOS || e.departamento_id === departamentoFiltro) &&
      (!texto ||
        nombreCompleto(e).toLowerCase().includes(texto) ||
        e.correo_electronico.toLowerCase().includes(texto) ||
        (e.cargo ?? "").toLowerCase().includes(texto))
  );
  const contar = (valor: Estado) =>
    empleados.filter((e) => valor === "todos" || (valor === "activos" ? e.activo : !e.activo)).length;

  // Un administrador solo lo puede editar otro administrador
  const soyAdmin = empleados.some((e) => e.es_yo && e.es_admin);
  const puedeEditar = (e: Empleado) => !e.es_admin || soyAdmin;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            Gestión de empleados
          </h1>
          <p className="text-muted-foreground mt-1">Altas, bajas, cargos y departamentos de la plantilla.</p>
        </div>
        <Button className="gap-2" onClick={() => abrir(null)}>
          <Plus className="w-4 h-4" />
          Nuevo empleado
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={estado} onValueChange={(value) => setEstado(value as Estado)}>
          <TabsList>
            <TabsTrigger value="activos">Activos ({contar("activos")})</TabsTrigger>
            <TabsTrigger value="bajas">Bajas ({contar("bajas")})</TabsTrigger>
            <TabsTrigger value="todos">Todos ({contar("todos")})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={departamentoFiltro} onValueChange={setDepartamentoFiltro}>
            <SelectTrigger className="sm:w-56" aria-label="Filtrar por departamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los departamentos</SelectItem>
              {departamentos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, correo o cargo..."
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>
      </div>

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
                  <TableHead>Departamento</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((e) => (
                  <TableRow key={e.id} className={e.activo ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {iniciales(e)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium">
                            {nombreCompleto(e)}
                            {e.es_yo && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">{e.correo_electronico}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{e.departamento ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{e.cargo ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm tabular-nums">
                      {format(new Date(e.fecha_ingreso), "d MMM yyyy", { locale: es })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {e.activo ? (
                          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">Activo</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <UserX className="h-3 w-3" />
                            Baja
                          </Badge>
                        )}
                        {e.es_admin && (
                          <Badge variant="secondary" className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                        {!e.tiene_cuenta && (
                          <Badge variant="outline" className="text-muted-foreground" title="Aún no tiene cuenta de acceso">
                            Sin cuenta
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {puedeEditar(e) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar a ${nombreCompleto(e)}`} onClick={() => abrir(e)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={editando !== undefined} onOpenChange={(open) => !open && setEditando(undefined)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Los cambios se aplican al momento en toda la aplicación."
                : "Se crea la ficha del empleado. Cuando tenga cuenta de acceso con este correo, se vinculará sola."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="emp-nombre">Nombre *</Label>
              <Input id="emp-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-apellido1">Primer apellido *</Label>
              <Input id="emp-apellido1" value={form.primer_apellido} onChange={(e) => setForm({ ...form, primer_apellido: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-apellido2">Segundo apellido</Label>
              <Input id="emp-apellido2" value={form.segundo_apellido} onChange={(e) => setForm({ ...form, segundo_apellido: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-telefono">Teléfono</Label>
              <Input id="emp-telefono" type="tel" maxLength={15} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emp-correo">Correo corporativo *</Label>
              <Input id="emp-correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-departamento">Departamento</Label>
              <Select value={form.departamento_id} onValueChange={(value) => setForm({ ...form, departamento_id: value })}>
                <SelectTrigger id="emp-departamento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {departamentos.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-cargo">Cargo</Label>
              <Select value={form.cargo_id} onValueChange={(value) => setForm({ ...form, cargo_id: value })}>
                <SelectTrigger id="emp-cargo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                  {cargos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-ingreso">Fecha de ingreso</Label>
              <Input id="emp-ingreso" type="date" value={form.fecha_ingreso} onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} />
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <Label htmlFor="emp-activo" className="cursor-pointer font-normal">
                  {form.activo ? "Empleado activo" : "Dado de baja"}
                </Label>
                <Switch
                  id="emp-activo"
                  checked={form.activo}
                  disabled={!!editando?.es_yo}
                  onCheckedChange={(value) => setForm({ ...form, activo: value })}
                />
              </div>
            </div>
            {!form.activo && editando?.activo && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Al darlo de baja pierde los permisos de su departamento, aunque conserva el acceso a sus propios datos.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(undefined)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editando ? "Guardar cambios" : "Dar de alta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
