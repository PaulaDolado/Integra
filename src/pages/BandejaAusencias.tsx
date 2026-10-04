import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Check, Inbox, Loader2, Lock, Paperclip, Search, X } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calcularDias, getRazonLabel, getTipoLabel } from "@/components/ausencias/tipos";
import { EstadoAusenciaBadge } from "@/components/ausencias/EstadoAusenciaBadge";

type Solicitud = Database["public"]["Functions"]["bandeja_ausencias"]["Returns"][number];
type Filtro = "pendiente" | "aprobada" | "rechazada" | "todas";
type Decision = "aprobada" | "rechazada";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "todas", label: "Todas" },
];

const CLAVE = ["bandeja-ausencias"];

const formatFecha = (fecha: string) => format(new Date(fecha), "d MMM yyyy", { locale: es });

export default function BandejaAusencias() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [revisando, setRevisando] = useState<{ solicitud: Solicitud; decision: Decision } | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const puedeAprobar = tiene("ausencias.aprobar");

  const { data: solicitudes = [], isPending: loading, error } = useQuery({
    queryKey: CLAVE,
    queryFn: async () => comprobar(await supabase.rpc("bandeja_ausencias")) ?? [],
    enabled: puedeAprobar,
  });
  useAvisarError(error, "No se pudieron cargar las solicitudes");

  useInvalidarEnCambios(puedeAprobar ? "bandeja-ausencias-changes" : null, [{ table: "solicitudes_vacacion" }], [CLAVE]);

  const abrirJustificante = async (path: string) => {
    const { data, error } = await supabase.storage.from("justificantes").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo abrir el justificante", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const iniciarRevision = (solicitud: Solicitud, decision: Decision) => {
    setComentario("");
    setRevisando({ solicitud, decision });
  };

  const confirmarRevision = async () => {
    if (!revisando) return;
    setEnviando(true);
    const { error } = await supabase.rpc("revisar_ausencia", {
      solicitud_id: revisando.solicitud.id,
      decision: revisando.decision,
      comentario: comentario.trim() || undefined,
    });
    setEnviando(false);

    if (error) {
      console.error("Error reviewing ausencia:", error);
      toast({ title: "Error", description: error.message || "No se pudo revisar la solicitud", variant: "destructive" });
      return;
    }

    toast({
      title: revisando.decision === "aprobada" ? "Solicitud aprobada" : "Solicitud rechazada",
      description: `Se ha notificado el cambio a ${revisando.solicitud.empleado_nombre}`,
    });
    setRevisando(null);
    queryClient.invalidateQueries({ queryKey: CLAVE });
  };

  if (cargandoPermisos) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!puedeAprobar) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-16 text-center">
            <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No tienes acceso a la bandeja de ausencias</p>
            <p className="text-sm text-muted-foreground">Solo la pueden ver Recursos Humanos y Dirección General.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const visibles = solicitudes.filter(
    (s) =>
      (filtro === "todas" || s.estado === filtro) &&
      (!texto || s.empleado_nombre.toLowerCase().includes(texto) || (s.departamento ?? "").toLowerCase().includes(texto))
  );
  const contar = (f: Filtro) => (f === "todas" ? solicitudes.length : solicitudes.filter((s) => s.estado === f).length);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Inbox className="w-6 h-6 text-primary" />
          Bandeja de ausencias
        </h1>
        <p className="text-muted-foreground mt-1">Revisa y aprueba las solicitudes de ausencia de la plantilla.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filtro} onValueChange={(value) => setFiltro(value as Filtro)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {FILTROS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label} ({contar(f.value)})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empleado o departamento..."
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : visibles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
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
                      <EstadoAusenciaBadge estado={s.estado} />
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{getTipoLabel(s.tipo_ausencia)}</span>
                      {s.razon_especifica && (
                        <span className="text-muted-foreground"> · {getRazonLabel(s.tipo_ausencia, s.razon_especifica)}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatFecha(s.fecha_inicio)} – {formatFecha(s.fecha_fin)} · {calcularDias(s.fecha_inicio, s.fecha_fin)} día(s)
                    </div>
                    {s.motivo && <p className="text-sm text-muted-foreground">Motivo: {s.motivo}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Solicitado el {format(new Date(s.created_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</span>
                      {s.justificante_path && (
                        <button
                          type="button"
                          onClick={() => abrirJustificante(s.justificante_path!)}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Paperclip className="w-3 h-3" />
                          Ver justificante
                        </button>
                      )}
                    </div>
                    {s.estado !== "pendiente" && s.fecha_revision && (
                      <p className="text-xs text-muted-foreground">
                        {s.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                        {s.revisado_por_nombre && ` por ${s.revisado_por_nombre}`} el{" "}
                        {format(new Date(s.fecha_revision), "dd/MM/yyyy", { locale: es })}
                        {s.comentario_revision && <span className="block italic">«{s.comentario_revision}»</span>}
                      </p>
                    )}
                  </div>

                  {s.estado === "pendiente" &&
                    (s.es_mia ? (
                      <p className="text-xs text-muted-foreground md:max-w-[12rem] md:text-right">
                        Es tu solicitud: la revisará otra persona con permiso.
                      </p>
                    ) : (
                      <div className="flex gap-2 md:shrink-0">
                        <Button
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => iniciarRevision(s, "rechazada")}
                        >
                          <X className="w-4 h-4" />
                          Rechazar
                        </Button>
                        <Button className="gap-1" onClick={() => iniciarRevision(s, "aprobada")}>
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

      <Dialog open={!!revisando} onOpenChange={(open) => !open && setRevisando(null)}>
        <DialogContent className="sm:max-w-md">
          {revisando && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {revisando.decision === "aprobada" ? "Aprobar solicitud" : "Rechazar solicitud"}
                </DialogTitle>
                <DialogDescription>
                  {getTipoLabel(revisando.solicitud.tipo_ausencia)} de {revisando.solicitud.empleado_nombre},{" "}
                  del {formatFecha(revisando.solicitud.fecha_inicio)} al {formatFecha(revisando.solicitud.fecha_fin)}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="comentario-revision">
                  {revisando.decision === "rechazada" ? "Motivo del rechazo" : "Comentario"} (opcional)
                </Label>
                <Textarea
                  id="comentario-revision"
                  rows={3}
                  placeholder="El empleado verá este comentario en su historial"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRevisando(null)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button
                  variant={revisando.decision === "rechazada" ? "destructive" : "default"}
                  onClick={confirmarRevision}
                  disabled={enviando}
                >
                  {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {revisando.decision === "aprobada" ? "Aprobar" : "Rechazar"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
