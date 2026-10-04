import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Loader2, Lock, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { usePermisos } from "@/hooks/usePermisos";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SolicitudTurnoCard, type SolicitudTurno } from "@/components/turnos/SolicitudTurnoCard";
import { ComentarioDialog } from "@/components/turnos/ComentarioDialog";

type Filtro = "pendiente" | "pendiente_companero" | "aprobada" | "rechazada" | "todas";

const FILTROS: { value: Filtro; label: string }[] = [
  { value: "pendiente", label: "Pendientes" },
  { value: "pendiente_companero", label: "Esperando al compañero" },
  { value: "aprobada", label: "Aprobadas" },
  { value: "rechazada", label: "Rechazadas" },
  { value: "todas", label: "Todas" },
];

// La misma consulta que usa CambioTurno: comparten caché
const CLAVE = ["solicitudes-turno"];

export default function BandejaTurnos() {
  const { tiene, loading: cargandoPermisos } = usePermisos();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empleadoId: miId, loading: cargandoMiId } = useMiEmpleadoId();
  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [busqueda, setBusqueda] = useState("");
  const [revisando, setRevisando] = useState<{ solicitud: SolicitudTurno; aprobar: boolean } | null>(null);

  const puedeAprobar = tiene("turnos.aprobar");

  const { data: solicitudes = [], isPending, error } = useQuery({
    queryKey: CLAVE,
    queryFn: async () => comprobar(await supabase.rpc("solicitudes_turno_detalle")) ?? [],
    enabled: puedeAprobar,
  });
  useAvisarError(error, "No se pudieron cargar las solicitudes");
  // Hasta saber quién soy no se sabe en qué solicitudes participo
  const loading = isPending || cargandoMiId;

  useInvalidarEnCambios(
    puedeAprobar ? "bandeja-turnos-changes" : null,
    [{ table: "solicitudes_turno" }],
    [CLAVE]
  );

  const revisar = async (comentario: string) => {
    if (!revisando) return;
    const { error } = await supabase.rpc("revisar_solicitud_turno", {
      p_solicitud: revisando.solicitud.id,
      p_aprobar: revisando.aprobar,
      p_comentario: comentario || undefined,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: revisando.aprobar ? "Cambio de turno aprobado" : "Cambio de turno rechazado" });
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
            <p className="font-medium">No tienes acceso a los cambios de turno</p>
            <p className="text-sm text-muted-foreground">Solo los pueden revisar Recursos Humanos y Dirección General.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const filtradas = solicitudes.filter(
    (s) =>
      !texto ||
      s.solicitante.toLowerCase().includes(texto) ||
      (s.companero ?? "").toLowerCase().includes(texto) ||
      (s.departamento ?? "").toLowerCase().includes(texto)
  );
  // "Rechazadas" incluye también las canceladas por el solicitante
  const coincide = (s: SolicitudTurno, f: Filtro) =>
    f === "todas" || (f === "rechazada" ? ["rechazada", "cancelada"].includes(s.estado) : s.estado === f);
  const visibles = filtradas.filter((s) => coincide(s, filtro));
  const participo = (s: SolicitudTurno) => s.solicitante_id === miId || s.companero_id === miId;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-primary" />
          Cambios de turno
        </h1>
        <p className="text-muted-foreground mt-1">Revisa y aprueba las solicitudes de cambio e intercambio de turno.</p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {FILTROS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label} ({filtradas.filter((s) => coincide(s, f.value)).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative lg:w-72">
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
          <CardContent className="py-12 text-center text-muted-foreground">
            {filtro === "pendiente" && !texto ? "No hay cambios de turno pendientes de aprobar" : "No hay solicitudes"}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibles.map((s) => (
            <SolicitudTurnoCard
              key={s.id}
              solicitud={s}
              mostrarDepartamento
              acciones={
                s.estado === "pendiente" ? (
                  participo(s) ? (
                    <p className="max-w-[12rem] text-xs text-muted-foreground md:text-right">
                      Participas en este cambio: lo revisará otra persona con permiso.
                    </p>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => setRevisando({ solicitud: s, aprobar: false })}
                      >
                        <X className="h-4 w-4" />
                        Rechazar
                      </Button>
                      <Button className="gap-1" onClick={() => setRevisando({ solicitud: s, aprobar: true })}>
                        <Check className="h-4 w-4" />
                        Aprobar
                      </Button>
                    </>
                  )
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      <ComentarioDialog
        open={!!revisando}
        titulo={revisando?.aprobar ? "Aprobar el cambio de turno" : "Rechazar el cambio de turno"}
        descripcion={`${revisando?.solicitud.solicitante ?? ""}: ${revisando?.solicitud.turno_actual ?? ""} → ${revisando?.solicitud.turno_solicitado ?? ""}`}
        confirmar={revisando?.aprobar ? "Aprobar" : "Rechazar"}
        destructivo={!revisando?.aprobar}
        comentarioObligatorio={!revisando?.aprobar}
        onCancel={() => setRevisando(null)}
        onConfirm={revisar}
      />
    </div>
  );
}
