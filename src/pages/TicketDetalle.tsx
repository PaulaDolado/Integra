import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  MessageSquare,
  Send,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketBadge } from "@/components/tickets/TicketBadge";
import {
  ESTADOS,
  ORDEN_ESTADOS,
  ORDEN_PRIORIDADES,
  ORDEN_TIPOS,
  PRIORIDADES,
  TIPOS,
  numeroTicket,
  type Seguimiento,
  type Ticket,
} from "@/components/tickets/ticket-config";

type Plantilla = { id: string; nombre: string; contenido: string };
type Modo = "respuesta" | "solucion";
const SIN_ASIGNAR = "none";

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();

const fechaCorta = (fecha: string) => format(new Date(fecha), "d MMM yyyy, HH:mm", { locale: es });

export default function TicketDetalle() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { tiene } = usePermisos();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [seguimientos, setSeguimientos] = useState<Seguimiento[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string }[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [miId, setMiId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<Modo>("respuesta");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [propiedades, setPropiedades] = useState({ tipo: "", prioridad: "", estado: "", asignado: SIN_ASIGNAR });
  const [guardandoPropiedades, setGuardandoPropiedades] = useState(false);

  const esSoporte = tiene("tickets.gestionar");

  const cargar = useCallback(async () => {
    if (!id) return;
    const [{ data: yo }, { data: t }, { data: segs }, { data: personas }] = await Promise.all([
      supabase.rpc("mi_empleado_id"),
      supabase.from("tickets").select("*").eq("id", id).maybeSingle(),
      supabase.from("ticket_seguimientos").select("*").eq("ticket_id", id).order("created_at"),
      supabase.rpc("personas_tickets"),
    ]);
    setMiId(yo ?? null);
    setTicket(t ?? null);
    setSeguimientos(segs ?? []);
    setNombres(new Map((personas ?? []).map((p) => [p.id, p.nombre])));
    if (t) {
      setPropiedades({ tipo: t.tipo, prioridad: t.prioridad, estado: t.estado, asignado: t.asignado_a_id ?? SIN_ASIGNAR });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    cargar();
    if (!id) return;
    const channel = supabase
      .channel(`ticket-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_seguimientos", filter: `ticket_id=eq.${id}` }, () => cargar())
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `id=eq.${id}` }, () => cargar())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, cargar]);

  useEffect(() => {
    supabase
      .from("plantillas_solucion")
      .select("id, nombre, contenido")
      .order("orden")
      .then(({ data }) => setPlantillas(data ?? []));
  }, []);

  useEffect(() => {
    if (!esSoporte) return;
    supabase.rpc("tecnicos_tickets").then(({ data }) => setTecnicos(data ?? []));
  }, [esSoporte]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" asChild className="gap-2 px-2">
          <Link to="/tickets">
            <ArrowLeft className="w-4 h-4" />
            Volver a los tickets
          </Link>
        </Button>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            El ticket no existe o no tienes acceso a él.
          </CardContent>
        </Card>
      </div>
    );
  }

  const nombre = (empleadoId: string | null) =>
    !empleadoId ? "Sistema" : empleadoId === miId ? "Tú" : nombres.get(empleadoId) ?? "Empleado";

  const soySolicitante = ticket.autor_id === miId;
  const soyTecnico = esSoporte || ticket.asignado_a_id === miId;
  const cerrado = ticket.estado === "cerrado";
  const puedeSolucionar = soyTecnico && !["resuelto", "cerrado"].includes(ticket.estado);
  const modoActivo: Modo = puedeSolucionar ? modo : "respuesta";
  const propiedadesCambiadas =
    propiedades.tipo !== ticket.tipo ||
    propiedades.prioridad !== ticket.prioridad ||
    propiedades.estado !== ticket.estado ||
    propiedades.asignado !== (ticket.asignado_a_id ?? SIN_ASIGNAR);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    const { error } =
      modoActivo === "solucion"
        ? await supabase.rpc("solucionar_ticket", { p_ticket: ticket.id, p_contenido: texto })
        : await supabase.rpc("responder_ticket", { p_ticket: ticket.id, p_contenido: texto });
    setEnviando(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: modoActivo === "solucion" ? "Solución añadida" : "Respuesta enviada",
      description: modoActivo === "solucion" ? "El ticket queda resuelto a la espera de que el solicitante lo apruebe" : undefined,
    });
    setTexto("");
    setModo("respuesta");
    cargar();
  };

  const valorar = async (aprobar: boolean) => {
    setEnviando(true);
    const { error } = await supabase.rpc("valorar_solucion", {
      p_ticket: ticket.id,
      p_aprobar: aprobar,
      p_comentario: aprobar ? undefined : motivoRechazo,
    });
    setEnviando(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: aprobar ? "Solución aprobada" : "Solución rechazada", description: aprobar ? "El ticket se ha cerrado" : "El ticket vuelve a estar en curso" });
    setRechazando(false);
    setMotivoRechazo("");
    cargar();
  };

  const guardarPropiedades = async () => {
    setGuardandoPropiedades(true);
    const { error } = await supabase.rpc("actualizar_ticket", {
      p_ticket: ticket.id,
      p_tipo: propiedades.tipo,
      p_prioridad: propiedades.prioridad,
      p_estado: propiedades.estado,
      p_asignado: propiedades.asignado === SIN_ASIGNAR ? null : propiedades.asignado,
    });
    setGuardandoPropiedades(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ticket actualizado" });
    cargar();
  };

  const aplicarPlantilla = (plantillaId: string) => {
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (plantilla) setTexto(plantilla.contenido);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" asChild className="-ml-2 gap-2 px-2 text-muted-foreground">
          <Link to={esSoporte ? "/gestion-tickets" : "/tickets"}>
            <ArrowLeft className="w-4 h-4" />
            {esSoporte ? "Todos los tickets" : "Mis tickets"}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{numeroTicket(ticket.id)}</span>
          <TicketBadge clase="tipo" valor={ticket.tipo} />
          <TicketBadge clase="estado" valor={ticket.estado} />
          <TicketBadge clase="prioridad" valor={ticket.prioridad} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{ticket.titulo}</h1>
      </div>

      {ticket.estado === "resuelto" && soySolicitante && (
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
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Historial */}
        <div className="space-y-4">
          <ol className="space-y-4">
            <li>
              <Mensaje
                autor={nombre(ticket.autor_id)}
                fecha={ticket.fecha_creacion}
                etiqueta="Descripción"
                contenido={ticket.descripcion}
              />
            </li>
            {seguimientos.map((s) =>
              s.tipo === "evento" ? (
                <li key={s.id} className="flex gap-3 pl-3 text-sm text-muted-foreground">
                  <History className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="whitespace-pre-line">{s.contenido}</p>
                    <p className="text-xs">
                      {nombre(s.autor_id)} · {formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </li>
              ) : (
                <li key={s.id}>
                  <Mensaje
                    autor={nombre(s.autor_id)}
                    fecha={s.created_at}
                    etiqueta={s.tipo === "solucion" ? "Solución" : undefined}
                    contenido={s.contenido}
                    solucion={s.tipo === "solucion"}
                  />
                </li>
              )
            )}
          </ol>

          {cerrado ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Este ticket está cerrado. Si el problema vuelve a aparecer, abre un ticket nuevo.
            </p>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4">
                {puedeSolucionar && (
                  <Tabs value={modoActivo} onValueChange={(v) => setModo(v as Modo)}>
                    <TabsList>
                      <TabsTrigger value="respuesta" className="gap-1.5">
                        <MessageSquare className="w-4 h-4" />
                        Responder
                      </TabsTrigger>
                      <TabsTrigger value="solucion" className="gap-1.5">
                        <Wrench className="w-4 h-4" />
                        Añadir una solución
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
                {modoActivo === "solucion" && plantillas.length > 0 && (
                  <Select onValueChange={aplicarPlantilla}>
                    <SelectTrigger className="sm:w-72" aria-label="Plantilla de solución">
                      <SelectValue placeholder="Usar una plantilla de respuesta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {plantillas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Textarea
                  aria-label={modoActivo === "solucion" ? "Solución" : "Respuesta"}
                  rows={modoActivo === "solucion" ? 8 : 4}
                  placeholder={modoActivo === "solucion" ? "Describe la solución aplicada..." : "Escribe tu respuesta..."}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {modoActivo === "solucion"
                      ? "El ticket pasará a Resuelto y el solicitante podrá aprobarlo o rechazarlo."
                      : soySolicitante && ["en_espera", "resuelto"].includes(ticket.estado)
                        ? "Al responder, el ticket volverá a estar en curso."
                        : "Todos los participantes del ticket verán tu respuesta."}
                  </p>
                  <Button className="gap-2 shrink-0" onClick={enviar} disabled={enviando || !texto.trim()}>
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : modoActivo === "solucion" ? <Wrench className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {modoActivo === "solucion" ? "Añadir solución" : "Responder"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Detalles */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {esSoporte && !cerrado ? (
              <>
                <Propiedad label="Tipo">
                  <Select value={propiedades.tipo} onValueChange={(v) => setPropiedades({ ...propiedades, tipo: v })}>
                    <SelectTrigger aria-label="Tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEN_TIPOS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPOS[t].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Propiedad>
                <Propiedad label="Estado">
                  <Select value={propiedades.estado} onValueChange={(v) => setPropiedades({ ...propiedades, estado: v })}>
                    <SelectTrigger aria-label="Estado">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEN_ESTADOS.map((e) => (
                        <SelectItem
                          key={e}
                          value={e}
                          // Solo se resuelve añadiendo una solución
                          disabled={e === "resuelto" && ticket.estado !== "resuelto"}
                        >
                          {ESTADOS[e].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Propiedad>
                <Propiedad label="Prioridad">
                  <Select value={propiedades.prioridad} onValueChange={(v) => setPropiedades({ ...propiedades, prioridad: v })}>
                    <SelectTrigger aria-label="Prioridad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDEN_PRIORIDADES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PRIORIDADES[p].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Propiedad>
                <Propiedad label="Asignado a">
                  <Select value={propiedades.asignado} onValueChange={(v) => setPropiedades({ ...propiedades, asignado: v })}>
                    <SelectTrigger aria-label="Asignado a">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                      {tecnicos.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.id === miId ? `${t.nombre} (tú)` : t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Propiedad>
                {propiedadesCambiadas && (
                  <Button className="w-full" onClick={guardarPropiedades} disabled={guardandoPropiedades}>
                    {guardandoPropiedades && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Guardar cambios
                  </Button>
                )}
              </>
            ) : (
              <>
                <Propiedad label="Tipo">
                  <TicketBadge clase="tipo" valor={ticket.tipo} />
                </Propiedad>
                <Propiedad label="Estado">
                  <TicketBadge clase="estado" valor={ticket.estado} />
                </Propiedad>
                <Propiedad label="Prioridad">
                  <TicketBadge clase="prioridad" valor={ticket.prioridad} />
                </Propiedad>
                <Propiedad label="Asignado a">
                  <span className="text-sm">{ticket.asignado_a_id ? nombre(ticket.asignado_a_id) : "Sin asignar"}</span>
                </Propiedad>
              </>
            )}
            <div className="space-y-2 border-t pt-4 text-sm">
              <Dato label="Solicitante" valor={nombre(ticket.autor_id)} />
              <Dato label="Abierto" valor={fechaCorta(ticket.fecha_creacion)} />
              {ticket.fecha_resolucion && <Dato label="Resuelto" valor={fechaCorta(ticket.fecha_resolucion)} />}
              {ticket.fecha_cierre && <Dato label="Cerrado" valor={fechaCorta(ticket.fecha_cierre)} />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Mensaje({
  autor,
  fecha,
  contenido,
  etiqueta,
  solucion = false,
}: {
  autor: string;
  fecha: string;
  contenido: string;
  etiqueta?: string;
  solucion?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={`text-xs font-medium ${solucion ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"}`}>
          {autor === "Tú" ? "TÚ" : iniciales(autor)}
        </AvatarFallback>
      </Avatar>
      <div
        className={`min-w-0 flex-1 rounded-xl border p-4 ${
          solucion ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30" : "bg-card"
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{autor}</span>
          {etiqueta && (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                solucion ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200" : "bg-muted text-muted-foreground"
              }`}
            >
              {etiqueta}
            </span>
          )}
          <span className="text-xs text-muted-foreground" title={fechaCorta(fecha)}>
            {formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es })}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed">{contenido}</p>
      </div>
    </div>
  );
}

function Propiedad({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
