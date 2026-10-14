import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Ban,
  CalendarDays,
  Clock,
  ExternalLink,
  GraduationCap,
  Inbox,
  Loader2,
  MapPin,
  MonitorPlay,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CursoDialog } from "@/components/cursos/CursoDialog";
import { EstadoInscripcionBadge, FaseCursoBadge } from "@/components/cursos/Etiquetas";
import {
  faseCurso,
  formatFecha,
  formatFechas,
  formatHoras,
  hoyIso,
  MODALIDADES,
  puedeCancelar,
  puedeSolicitar,
  type Curso,
  type FaseCurso,
  type Inscripcion,
  type Modalidad,
} from "@/components/cursos/cursos";

type Pestana = "proximos" | "mias" | "anteriores";

const CLAVE_CURSOS = ["cursos"];
const CLAVE_MIAS = ["inscripciones-curso", "mias"];

// Acción pendiente de confirmar en un diálogo
type Confirmacion =
  | { tipo: "cancelar-solicitud"; curso: Curso; inscripcion: Inscripcion }
  | { tipo: "cancelar-curso"; curso: Curso }
  | { tipo: "eliminar-curso"; curso: Curso };

export default function Cursos() {
  const { tiene } = usePermisos();
  const { empleadoId } = useMiEmpleadoId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pestana, setPestana] = useState<Pestana>("proximos");
  // undefined = cerrado, null = curso nuevo
  const [editando, setEditando] = useState<Curso | null | undefined>(undefined);
  const [solicitando, setSolicitando] = useState<Curso | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [enviando, setEnviando] = useState(false);

  const gestiona = tiene("cursos.gestionar");
  const hoy = hoyIso();

  const { data: cursos = [], isPending: cargando, error } = useQuery({
    queryKey: CLAVE_CURSOS,
    queryFn: async () => comprobar(await supabase.from("cursos").select("*").order("fecha_inicio")) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar los cursos");

  // Quien gestiona ve todas las inscripciones (RLS): aquí solo interesan las suyas
  const { data: mias = [] } = useQuery({
    queryKey: [...CLAVE_MIAS, empleadoId],
    queryFn: async () =>
      comprobar(await supabase.from("inscripciones_curso").select("*").eq("empleado_id", empleadoId!)) ?? [],
    enabled: !!empleadoId,
  });

  useInvalidarEnCambios(
    "cursos-changes",
    [{ table: "cursos" }, { table: "inscripciones_curso" }],
    [CLAVE_CURSOS, CLAVE_MIAS]
  );

  const recargar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_CURSOS }),
      queryClient.invalidateQueries({ queryKey: CLAVE_MIAS }),
    ]);

  const miInscripcion = (cursoId: string) => mias.find((i) => i.curso_id === cursoId);
  const fase = (curso: Curso) => faseCurso(curso, hoy);

  const proximos = cursos.filter((c) => fase(c) !== "terminado");
  // Las más recientes primero
  const anteriores = cursos.filter((c) => fase(c) === "terminado").reverse();
  const conInscripcion = cursos.filter((c) => miInscripcion(c.id)).reverse();

  const pedirPlaza = async () => {
    if (!solicitando) return;
    setEnviando(true);
    const { error } = await supabase.rpc("solicitar_curso", {
      p_curso: solicitando.id,
      p_motivo: motivo.trim() || undefined,
    });
    setEnviando(false);
    if (error) {
      console.error("Error requesting curso:", error);
      toast({ title: "Error", description: error.message || "No se pudo enviar la solicitud", variant: "destructive" });
      return;
    }
    toast({ title: "Solicitud enviada", description: "Te avisaremos cuando la revisen" });
    setSolicitando(null);
    void recargar();
  };

  const ejecutarConfirmacion = async () => {
    if (!confirmar) return;
    setEnviando(true);
    const { error } =
      confirmar.tipo === "cancelar-solicitud"
        ? await supabase.rpc("cancelar_inscripcion_curso", { p_inscripcion: confirmar.inscripcion.id })
        : confirmar.tipo === "cancelar-curso"
          ? await supabase.from("cursos").update({ cancelado: true }).eq("id", confirmar.curso.id)
          : await supabase.from("cursos").delete().eq("id", confirmar.curso.id);
    setEnviando(false);
    if (error) {
      console.error("Error in curso action:", error);
      toast({ title: "Error", description: error.message || "No se pudo completar la acción", variant: "destructive" });
      return;
    }
    toast({
      title:
        confirmar.tipo === "cancelar-solicitud"
          ? "Solicitud cancelada"
          : confirmar.tipo === "cancelar-curso"
            ? "Curso cancelado"
            : "Curso eliminado",
    });
    setConfirmar(null);
    void recargar();
  };

  const tarjeta = (curso: Curso) => {
    const f = fase(curso);
    const inscripcion = miInscripcion(curso.id);
    return (
      <TarjetaCurso
        key={curso.id}
        curso={curso}
        fase={f}
        inscripcion={inscripcion}
        gestiona={gestiona}
        onSolicitar={() => {
          setMotivo("");
          setSolicitando(curso);
        }}
        onCancelarSolicitud={() => inscripcion && setConfirmar({ tipo: "cancelar-solicitud", curso, inscripcion })}
        onEditar={() => setEditando(curso)}
        onCancelarCurso={() => setConfirmar({ tipo: "cancelar-curso", curso })}
        onEliminar={() => setConfirmar({ tipo: "eliminar-curso", curso })}
      />
    );
  };

  const lista = (items: Curso[], vacio: string) =>
    cargando ? (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    ) : items.length === 0 ? (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{vacio}</p>
        </CardContent>
      </Card>
    ) : (
      <div className="grid gap-4 lg:grid-cols-2">{items.map(tarjeta)}</div>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Inscripción a cursos
          </h1>
          <p className="text-muted-foreground mt-1">Formación de la empresa. Pide plaza y RRHH revisará tu solicitud.</p>
        </div>
        {gestiona && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/bandeja-cursos">
                <Inbox className="w-4 h-4" />
                Revisar inscripciones
              </Link>
            </Button>
            <Button className="gap-2" onClick={() => setEditando(null)}>
              <Plus className="w-4 h-4" />
              Nuevo curso
            </Button>
          </div>
        )}
      </div>

      <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="proximos">Próximos ({proximos.length})</TabsTrigger>
          <TabsTrigger value="mias">Mis inscripciones ({conInscripcion.length})</TabsTrigger>
          <TabsTrigger value="anteriores">Anteriores ({anteriores.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="proximos" className="mt-0">
          {lista(proximos, "No hay cursos programados por ahora")}
        </TabsContent>
        <TabsContent value="mias" className="mt-0">
          {lista(conInscripcion, "Todavía no has pedido plaza en ningún curso")}
        </TabsContent>
        <TabsContent value="anteriores" className="mt-0">
          {lista(anteriores, "No hay cursos terminados")}
        </TabsContent>
      </Tabs>

      {gestiona && (
        <CursoDialog
          open={editando !== undefined}
          curso={editando ?? null}
          empleadoId={empleadoId}
          onClose={() => setEditando(undefined)}
          onSaved={() => {
            setEditando(undefined);
            void recargar();
          }}
        />
      )}

      <Dialog open={!!solicitando} onOpenChange={(open) => !open && setSolicitando(null)}>
        <DialogContent className="sm:max-w-md">
          {solicitando && (
            <>
              <DialogHeader>
                <DialogTitle>Pedir plaza</DialogTitle>
                <DialogDescription>
                  {solicitando.titulo}, {formatFechas(solicitando.fecha_inicio, solicitando.fecha_fin)}. RRHH revisará tu
                  solicitud y te avisará.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="curso-motivo">Por qué te interesa (opcional)</Label>
                <Textarea id="curso-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSolicitando(null)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button onClick={pedirPlaza} disabled={enviando}>
                  {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar solicitud
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmar} onOpenChange={(open) => !open && setConfirmar(null)}>
        <AlertDialogContent>
          {confirmar && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirmar.tipo === "cancelar-solicitud"
                    ? "¿Cancelar tu solicitud?"
                    : confirmar.tipo === "cancelar-curso"
                      ? "¿Cancelar el curso?"
                      : "¿Eliminar el curso?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmar.tipo === "cancelar-solicitud"
                    ? `Dejarás de estar apuntado a «${confirmar.curso.titulo}». Podrás volver a pedir plaza mientras siga abierto.`
                    : confirmar.tipo === "cancelar-curso"
                      ? `«${confirmar.curso.titulo}» seguirá en el catálogo como cancelado, y se avisará a quien tenga la solicitud pendiente o aprobada.`
                      : `«${confirmar.curso.titulo}» y todas sus solicitudes se borrarán para siempre. Si ya hay gente apuntada, mejor cancélalo.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={enviando}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    // Se cierra al terminar, no al pulsar
                    e.preventDefault();
                    void ejecutarConfirmacion();
                  }}
                  disabled={enviando}
                >
                  {confirmar.tipo === "cancelar-solicitud"
                    ? "Cancelar solicitud"
                    : confirmar.tipo === "cancelar-curso"
                      ? "Cancelar curso"
                      : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TarjetaCursoProps {
  curso: Curso;
  fase: FaseCurso;
  inscripcion: Inscripcion | undefined;
  gestiona: boolean;
  onSolicitar: () => void;
  onCancelarSolicitud: () => void;
  onEditar: () => void;
  onCancelarCurso: () => void;
  onEliminar: () => void;
}

function TarjetaCurso({
  curso,
  fase,
  inscripcion,
  gestiona,
  onSolicitar,
  onCancelarSolicitud,
  onEditar,
  onCancelarCurso,
  onEliminar,
}: TarjetaCursoProps) {
  const estado = inscripcion?.estado;
  const online = curso.modalidad === "online";
  // El enlace de la sesión solo lo ven quienes tienen plaza y quienes gestionan
  const veEnlace = online && curso.enlace && (estado === "aprobada" || gestiona);
  const horas = formatHoras(curso.horas);
  const solicitar = puedeSolicitar(fase, estado);
  const cancelar = puedeCancelar(fase, estado);
  const avisoRechazo = estado === "rechazada" && fase === "abierto";
  // Sin acciones no se pinta el pie (quedaría solo la línea)
  const conPie = solicitar || cancelar || avisoRechazo || gestiona;

  return (
    <Card className={fase === "cancelado" || fase === "terminado" ? "opacity-80" : undefined}>
      <CardContent className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold leading-snug">{curso.titulo}</h2>
          <FaseCursoBadge fase={fase} />
        </div>

        <ul className="grid gap-1.5 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {formatFechas(curso.fecha_inicio, curso.fecha_fin)}
          </li>
          <li className="flex items-center gap-2">
            {online ? <MonitorPlay className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
            {MODALIDADES[curso.modalidad as Modalidad] ?? curso.modalidad}
            {!online && curso.lugar && ` · ${curso.lugar}`}
            {veEnlace && (
              <a
                href={curso.enlace!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                · Unirse a la sesión
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </li>
          {(horas || curso.certificado) && (
            <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {horas && (
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0" />
                  {horas}
                </span>
              )}
              {curso.certificado && (
                <span className="inline-flex items-center gap-2">
                  <Award className="h-4 w-4 shrink-0" />
                  Con certificado
                </span>
              )}
            </li>
          )}
          {fase === "abierto" && curso.plazo_inscripcion && (
            <li>Inscripción hasta el {formatFecha(curso.plazo_inscripcion)}</li>
          )}
        </ul>

        {curso.descripcion && <p className="text-sm whitespace-pre-line">{curso.descripcion}</p>}

        {inscripcion && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tu solicitud:</span>
              <EstadoInscripcionBadge estado={inscripcion.estado} />
            </div>
            {inscripcion.comentario_revision && (
              <p className="text-muted-foreground italic">«{inscripcion.comentario_revision}»</p>
            )}
          </div>
        )}

        {conPie && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {solicitar && <Button onClick={onSolicitar}>Pedir plaza</Button>}
              {cancelar && (
                <Button variant="outline" onClick={onCancelarSolicitud}>
                  Cancelar mi solicitud
                </Button>
              )}
              {avisoRechazo && (
                <span className="text-xs text-muted-foreground self-center">
                  Si crees que es un error, habla con RRHH.
                </span>
              )}
            </div>
            {gestiona && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Editar «${curso.titulo}»`} onClick={onEditar}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!curso.cancelado && fase !== "terminado" && (
                  <Button variant="ghost" size="icon" aria-label={`Cancelar «${curso.titulo}»`} onClick={onCancelarCurso}>
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Eliminar «${curso.titulo}»`}
                  onClick={onEliminar}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
