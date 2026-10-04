import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Lock, Plus, Search, Ticket as TicketIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NuevoTicketDialog } from "@/components/tickets/NuevoTicketDialog";
import { TicketBadge } from "@/components/tickets/TicketBadge";
import {
  CLAVE_PERSONAS_TICKETS,
  CLAVE_TICKETS,
  ESTADOS,
  ORDEN_ESTADOS,
  ORDEN_PRIORIDADES,
  ORDEN_TIPOS,
  PESO_PRIORIDAD,
  PRIORIDADES,
  TIPOS,
  numeroTicket,
  type EstadoTicket,
  type Ticket,
} from "@/components/tickets/ticket-config";

type FiltroEstado = "abiertos" | EstadoTicket | "todos";
const TODOS = "todos";

interface TicketsProps {
  // "todos": vista de soporte con todos los tickets (requiere tickets.gestionar)
  vista?: "mios" | "todos";
}

export default function Tickets({ vista = "mios" }: TicketsProps) {
  const navigate = useNavigate();
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { empleadoId: miId, loading: cargandoEmpleado } = useMiEmpleadoId();
  const [estado, setEstado] = useState<FiltroEstado>("abiertos");
  const [tipo, setTipo] = useState(TODOS);
  const [prioridad, setPrioridad] = useState(TODOS);
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);

  const esSoporte = vista === "todos";
  const puedeVer = !esSoporte || tiene("tickets.gestionar");
  const activa = !cargandoPermisos && puedeVer;

  // Las dos vistas comparten la consulta: la base de datos ya limita lo que cada uno puede ver
  const { data: todos, isLoading: cargandoTickets, error } = useQuery({
    queryKey: [...CLAVE_TICKETS, "lista"],
    queryFn: async () => comprobar(await supabase.from("tickets").select("*").order("updated_at", { ascending: false })),
    enabled: activa,
  });
  useAvisarError(error, "No se pudieron cargar los tickets");

  const { data: personas, isLoading: cargandoPersonas } = useQuery({
    queryKey: CLAVE_PERSONAS_TICKETS,
    queryFn: async () => comprobar(await supabase.rpc("personas_tickets")),
    enabled: activa,
  });

  useInvalidarEnCambios(activa ? `tickets-${vista}-changes` : null, [{ table: "tickets" }], [CLAVE_TICKETS]);

  const loading = cargandoTickets || cargandoPersonas || cargandoEmpleado;

  // Aquí se separa "mis tickets" de "todos"
  const tickets = useMemo(
    () => (todos ?? []).filter((t) => esSoporte || t.autor_id === miId || t.asignado_a_id === miId),
    [todos, esSoporte, miId]
  );
  const nombres = useMemo(() => new Map((personas ?? []).map((p) => [p.id, p.nombre])), [personas]);

  const texto = busqueda.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      tickets
        .filter((t) => tipo === TODOS || t.tipo === tipo)
        .filter((t) => prioridad === TODOS || t.prioridad === prioridad)
        .filter(
          (t) =>
            !texto ||
            t.titulo.toLowerCase().includes(texto) ||
            numeroTicket(t.id).toLowerCase().includes(texto) ||
            (nombres.get(t.autor_id) ?? "").toLowerCase().includes(texto)
        ),
    [tickets, tipo, prioridad, texto, nombres]
  );

  const coincideEstado = (t: Ticket, f: FiltroEstado) =>
    f === "todos" || (f === "abiertos" ? t.estado !== "cerrado" && t.estado !== "resuelto" : t.estado === f);

  // Primero lo más urgente; dentro de cada prioridad, lo último actualizado
  const visibles = filtrados
    .filter((t) => coincideEstado(t, estado))
    .sort((a, b) => (PESO_PRIORIDAD[a.prioridad] ?? 9) - (PESO_PRIORIDAD[b.prioridad] ?? 9));

  const contar = (f: FiltroEstado) => filtrados.filter((t) => coincideEstado(t, f)).length;

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
            <p className="font-medium">No tienes acceso a todos los tickets</p>
            <p className="text-sm text-muted-foreground">Solo lo puede ver el equipo de soporte (Tecnología).</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtrosEstado: { value: FiltroEstado; label: string }[] = [
    { value: "abiertos", label: "Abiertos" },
    ...ORDEN_ESTADOS.map((e) => ({ value: e as FiltroEstado, label: ESTADOS[e].label.replace(" (asignada)", "") })),
    { value: "todos", label: "Todos" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <TicketIcon className="w-6 h-6 text-primary" />
            {esSoporte ? "Todos los tickets" : "Mis tickets"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {esSoporte
              ? "Incidencias y peticiones de toda la plantilla."
              : "Incidencias y peticiones que has abierto o que tienes asignadas."}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreando(true)}>
          <Plus className="w-4 h-4" />
          Nuevo ticket
        </Button>
      </div>

      <div className="space-y-3">
        <Tabs value={estado} onValueChange={(v) => setEstado(v as FiltroEstado)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {filtrosEstado.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label} <span className="ml-1 tabular-nums text-muted-foreground">{contar(f.value)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={esSoporte ? "Buscar por título, número o solicitante..." : "Buscar por título o número..."}
              className="pl-9"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos los tipos</SelectItem>
              {ORDEN_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TIPOS[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prioridad} onValueChange={setPrioridad}>
            <SelectTrigger className="sm:w-48" aria-label="Filtrar por prioridad">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todas las prioridades</SelectItem>
              {ORDEN_PRIORIDADES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORIDADES[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="py-12 text-center">
            <TicketIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No hay tickets que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-24">Nº</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead className="text-right">Actualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/tickets/${t.id}`)}
                    tabIndex={0}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{numeroTicket(t.id)}</TableCell>
                    <TableCell className="max-w-88">
                      <div className="flex items-center gap-2">
                        <TicketBadge clase="tipo" valor={t.tipo} className="shrink-0" />
                        <span className="truncate font-medium">{t.titulo}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TicketBadge clase="estado" valor={t.estado} />
                    </TableCell>
                    <TableCell>
                      <TicketBadge clase="prioridad" valor={t.prioridad} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {t.autor_id === miId ? "Tú" : nombres.get(t.autor_id) ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {t.asignado_a_id ? (
                        t.asignado_a_id === miId ? "Tú" : nombres.get(t.asignado_a_id) ?? "—"
                      ) : (
                        <span className="text-muted-foreground">Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-right text-sm text-muted-foreground"
                      title={format(new Date(t.updated_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    >
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true, locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <NuevoTicketDialog open={creando} onOpenChange={setCreando} onCreated={(id) => navigate(`/tickets/${id}`)} />
    </div>
  );
}
