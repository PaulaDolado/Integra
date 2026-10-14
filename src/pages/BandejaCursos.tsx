import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, GraduationCap, Inbox, Loader2, Lock, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EstadoInscripcionBadge } from "@/components/cursos/Etiquetas";
import { formatFechas } from "@/components/cursos/cursos";

type Solicitud = Database["public"]["Functions"]["bandeja_cursos"]["Returns"][number];
type Filtro = "pendiente" | "aprobada" | "rechazada" | "cancelada" | "todas";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "cancelada", label: "Canceladas" },
  { value: "todas", label: "Todas" },
];

const TODOS = "todos";
const CLAVE = ["inscripciones-curso", "bandeja"];

export default function BandejaCursos() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [cursoFiltro, setCursoFiltro] = useState(TODOS);
  const [busqueda, setBusqueda] = useState("");
  const [revisando, setRevisando] = useState<{ solicitud: Solicitud; aprobar: boolean } | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const gestiona = tiene("cursos.gestionar");

  const { data: solicitudes = [], isPending: loading, error } = useQuery({
    queryKey: CLAVE,
    queryFn: async () => comprobar(await supabase.rpc("bandeja_cursos")) ?? [],
    enabled: gestiona,
  });
  useAvisarError(error, "No se pudieron cargar las inscripciones");

  useInvalidarEnCambios(
    gestiona ? "bandeja-cursos-changes" : null,
    [{ table: "inscripciones_curso" }, { table: "cursos" }],
    [CLAVE]
  );

  const iniciarRevision = (solicitud: Solicitud, aprobar: boolean) => {
    setComentario("");
    setRevisando({ solicitud, aprobar });
  };

  const confirmarRevision = async () => {
    if (!revisando) return;
    setEnviando(true);
    const { error } = await supabase.rpc("revisar_inscripcion_curso", {
      p_inscripcion: revisando.solicitud.id,
      p_aprobar: revisando.aprobar,
      p_comentario: comentario.trim() || undefined,
    });
    setEnviando(false);

    if (error) {
      console.error("Error reviewing inscripcion:", error);
      toast({ title: "Error", description: error.message || "No se pudo revisar la solicitud", variant: "destructive" });
      return;
    }
    toast({
      title: revisando.aprobar ? "Solicitud aprobada" : "Solicitud rechazada",
      description: `Se ha avisado a ${revisando.solicitud.empleado_nombre}`,
    });
    setRevisando(null);
    void queryClient.invalidateQueries({ queryKey: ["inscripciones-curso"] });
  };

  if (cargandoPermisos) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gestiona) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No tienes acceso a las inscripciones a cursos</p>
            <p className="text-sm text-muted-foreground">Solo las pueden revisar Recursos Humanos y Dirección General.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Cursos con alguna solicitud, para el filtro
  const cursos = [...new Map(solicitudes.map((s) => [s.curso_id, s.curso_titulo])).entries()];
  const texto = busqueda.trim().toLowerCase();
  const delCurso = solicitudes.filter((s) => cursoFiltro === TODOS || s.curso_id === cursoFiltro);
  const visibles = delCurso.filter(
    (s) =>
      (filtro === "todas" || s.estado === filtro) &&
      (!texto || s.empleado_nombre.toLowerCase().includes(texto) || (s.departamento ?? "").toLowerCase().includes(texto))
  );
  const contar = (f: Filtro) => (f === "todas" ? delCurso.length : delCurso.filter((s) => s.estado === f).length);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Inbox className="w-6 h-6 text-primary" />
          Inscripciones a cursos
        </h1>
        <p className="text-muted-foreground mt-1">Revisa y aprueba las solicitudes de plaza de la plantilla.</p>
      </div>

      {/* Las pestañas filtran la lista de abajo, que es su panel */}
      <Tabs value={filtro} onValueChange={(value) => setFiltro(value as Filtro)} className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <TabsList className="h-auto flex-wrap justify-start">
            {FILTROS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label} ({contar(f.value)})
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger className="sm:w-64" aria-label="Filtrar por curso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los cursos</SelectItem>
                {cursos.map(([id, titulo]) => (
                  <SelectItem key={id} value={id}>
                    {titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleado o departamento..."
                aria-label="Buscar empleado o departamento"
                className="pl-9"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
        </div>

        <TabsContent value={filtro} className="mt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : visibles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {filtro === "pendiente" && !texto ? "No hay solicitudes pendientes de revisar" : "No hay solicitudes"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibles.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{s.empleado_nombre}</span>
                          {s.departamento && <span className="text-sm text-muted-foreground">· {s.departamento}</span>}
                          <EstadoInscripcionBadge estado={s.estado} />
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{s.curso_titulo}</span>
                          <span className="text-muted-foreground"> · {formatFechas(s.curso_fecha_inicio, s.curso_fecha_fin)}</span>
                          {s.curso_cancelado && <span className="text-destructive"> · Curso cancelado</span>}
                        </div>
                        {s.motivo && <p className="text-sm text-muted-foreground">Motivo: {s.motivo}</p>}
                        <p className="text-xs text-muted-foreground">
                          Solicitado el {format(new Date(s.created_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                        </p>
                        {(s.estado === "aprobada" || s.estado === "rechazada") && s.fecha_revision && (
                          <p className="text-xs text-muted-foreground">
                            {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                            {s.revisado_por_nombre && ` por ${s.revisado_por_nombre}`} el{" "}
                            {format(new Date(s.fecha_revision), "dd/MM/yyyy", { locale: es })}
                            {s.comentario_revision && <span className="block italic">«{s.comentario_revision}»</span>}
                          </p>
                        )}
                      </div>

                      {s.estado === "pendiente" &&
                        !s.curso_cancelado &&
                        (s.es_mia ? (
                          <p className="text-xs text-muted-foreground md:max-w-48 md:text-right">
                            Es tu solicitud: la revisará otra persona con permiso.
                          </p>
                        ) : (
                          <div className="flex gap-2 md:shrink-0">
                            <Button
                              variant="outline"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => iniciarRevision(s, false)}
                            >
                              <X className="w-4 h-4" />
                              Rechazar
                            </Button>
                            <Button className="gap-1" onClick={() => iniciarRevision(s, true)}>
                              <Check className="w-4 h-4" />
                              Aprobar
                            </Button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!revisando} onOpenChange={(open) => !open && setRevisando(null)}>
        <DialogContent className="sm:max-w-md">
          {revisando && (
            <>
              <DialogHeader>
                <DialogTitle>{revisando.aprobar ? "Aprobar solicitud" : "Rechazar solicitud"}</DialogTitle>
                <DialogDescription>
                  {revisando.solicitud.empleado_nombre}, para «{revisando.solicitud.curso_titulo}».
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="comentario-revision">
                  {revisando.aprobar ? "Comentario" : "Motivo del rechazo"} (opcional)
                </Label>
                <Textarea
                  id="comentario-revision"
                  rows={3}
                  placeholder="El empleado verá este comentario en su solicitud"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRevisando(null)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button variant={revisando.aprobar ? "default" : "destructive"} onClick={confirmarRevision} disabled={enviando}>
                  {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {revisando.aprobar ? "Aprobar" : "Rechazar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
