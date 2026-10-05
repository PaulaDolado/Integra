import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { Check, Loader2, Plus, Repeat, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SolicitudTurnoCard, type SolicitudTurno } from "@/components/turnos/SolicitudTurnoCard";
import { ComentarioDialog } from "@/components/turnos/ComentarioDialog";

type Turno = { id: string; nombre: string; hora_inicio: string; hora_fin: string };
type Vista = "mias" | "companeros";
const SIN_COMPANERO = "none";

// La misma consulta que usa BandejaTurnos: comparten caché
const CLAVE = ["solicitudes-turno"];

type Colega = Database["public"]["Functions"]["directorio_empleados"]["Returns"][number];
const aCompaneros = (directorio: Colega[]) =>
  directorio.map((e) => ({ id: e.id, nombre: [e.nombre, e.primer_apellido].join(" ") }));

const etiquetaTurno = (t: Turno) => `${t.nombre} (${t.hora_inicio.slice(0, 5)}–${t.hora_fin.slice(0, 5)})`;

const formVacio = () => ({
  fecha: format(addDays(new Date(), 1), "yyyy-MM-dd"),
  turno_actual: "",
  turno_solicitado: "",
  companero: SIN_COMPANERO,
  motivo: "",
});

export default function CambioTurno() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empleadoId: miId, loading: cargandoMiId } = useMiEmpleadoId();
  const [vista, setVista] = useState<Vista>("mias");
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [enviando, setEnviando] = useState(false);
  const [respondiendo, setRespondiendo] = useState<{ solicitud: SolicitudTurno; aceptar: boolean } | null>(null);

  const { data: todas = [], isPending, error } = useQuery({
    queryKey: CLAVE,
    queryFn: async () => comprobar(await supabase.rpc("solicitudes_turno_detalle")) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar las solicitudes");
  const loading = isPending || cargandoMiId;
  // Aquí solo las propias y las dirigidas a mí (los revisores lo gestionan desde su bandeja)
  const solicitudes = todas.filter((s) => s.solicitante_id === miId || s.companero_id === miId);

  const { data: turnos = [] } = useQuery({
    queryKey: ["turnos"],
    queryFn: async (): Promise<Turno[]> =>
      comprobar(await supabase.from("turnos").select("id, nombre, hora_inicio, hora_fin").order("orden")) ?? [],
  });

  const { data: companeros = [] } = useQuery({
    queryKey: ["directorio-empleados"],
    queryFn: async () => comprobar(await supabase.rpc("directorio_empleados")) ?? [],
    select: aCompaneros,
  });

  useInvalidarEnCambios("cambio-turno-changes", [{ table: "solicitudes_turno" }], [CLAVE]);

  const mias = solicitudes.filter((s) => s.solicitante_id === miId);
  const deCompaneros = solicitudes.filter((s) => s.companero_id === miId);
  const pendientesDeMi = deCompaneros.filter((s) => s.estado === "pendiente_companero").length;
  const visibles = vista === "mias" ? mias : deCompaneros;

  const crear = async () => {
    if (!form.turno_actual || !form.turno_solicitado) {
      toast({ title: "Error", description: "Elige el turno actual y el que solicitas", variant: "destructive" });
      return;
    }
    setEnviando(true);
    const { error } = await supabase.rpc("crear_solicitud_turno", {
      p_fecha: form.fecha,
      p_turno_actual: form.turno_actual,
      p_turno_solicitado: form.turno_solicitado,
      p_companero: form.companero === SIN_COMPANERO ? null : form.companero,
      p_motivo: form.motivo,
    });
    setEnviando(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Solicitud enviada",
      description:
        form.companero === SIN_COMPANERO
          ? "RRHH o Dirección la revisarán"
          : "Tu compañero debe aceptar el intercambio antes de que lo revisen RRHH o Dirección",
    });
    setCreando(false);
    queryClient.invalidateQueries({ queryKey: CLAVE });
  };

  const cancelar = async (s: SolicitudTurno) => {
    const { error } = await supabase.rpc("cancelar_solicitud_turno", { p_solicitud: s.id });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Solicitud cancelada" });
    queryClient.invalidateQueries({ queryKey: CLAVE });
  };

  const responder = async (comentario: string) => {
    if (!respondiendo) return;
    const { error } = await supabase.rpc("responder_intercambio_turno", {
      p_solicitud: respondiendo.solicitud.id,
      p_aceptar: respondiendo.aceptar,
      p_comentario: comentario || undefined,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: respondiendo.aceptar ? "Intercambio aceptado" : "Intercambio rechazado" });
    setRespondiendo(null);
    queryClient.invalidateQueries({ queryKey: CLAVE });
  };

  const turnoSolicitadoOpciones = turnos.filter((t) => t.id !== form.turno_actual);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Repeat className="w-6 h-6 text-primary" />
            Cambio de turno
          </h1>
          <p className="text-muted-foreground mt-1">Solicita cambiar tu turno o intercambiarlo con un compañero.</p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setForm(formVacio());
            setCreando(true);
          }}
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </Button>
      </div>

      {/* Las pestañas filtran la lista de abajo, que es su panel */}
      <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="mias">Mis solicitudes ({mias.length})</TabsTrigger>
          <TabsTrigger value="companeros" className="gap-1.5">
            Solicitudes de compañeros
            {pendientesDeMi > 0 && <Badge className="h-5 px-1.5">{pendientesDeMi}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={vista} className="mt-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : visibles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {vista === "mias" ? "No has solicitado ningún cambio de turno" : "Ningún compañero te ha pedido un intercambio"}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {visibles.map((s) => (
                <SolicitudTurnoCard
                  key={s.id}
                  solicitud={s}
                  nombreSolicitante={s.solicitante_id === miId ? "Tu solicitud" : `Solicitado por ${s.solicitante}`}
                  nombreCompanero={s.companero_id === miId ? "ti" : undefined}
                  acciones={
                    s.solicitante_id === miId && ["pendiente_companero", "pendiente"].includes(s.estado) ? (
                      <Button variant="outline" size="sm" onClick={() => cancelar(s)}>
                        Cancelar solicitud
                      </Button>
                    ) : s.companero_id === miId && s.estado === "pendiente_companero" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => setRespondiendo({ solicitud: s, aceptar: false })}
                        >
                          <X className="h-4 w-4" />
                          Rechazar
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => setRespondiendo({ solicitud: s, aceptar: true })}>
                          <Check className="h-4 w-4" />
                          Aceptar intercambio
                        </Button>
                      </>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={creando} onOpenChange={setCreando}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de cambio de turno</DialogTitle>
            <DialogDescription>La revisarán RRHH o Dirección. Si eliges un compañero, él debe aceptar primero.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="turno-fecha">Día del cambio</Label>
              <Input
                id="turno-fecha"
                type="date"
                className="w-auto"
                min={format(new Date(), "yyyy-MM-dd")}
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="turno-actual">Tu turno ese día</Label>
                <Select
                  value={form.turno_actual}
                  onValueChange={(v) => setForm({ ...form, turno_actual: v, turno_solicitado: v === form.turno_solicitado ? "" : form.turno_solicitado })}
                >
                  <SelectTrigger id="turno-actual">
                    <SelectValue placeholder="Elige un turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {turnos.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {etiquetaTurno(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="turno-solicitado">Turno que solicitas</Label>
                <Select value={form.turno_solicitado} onValueChange={(v) => setForm({ ...form, turno_solicitado: v })}>
                  <SelectTrigger id="turno-solicitado">
                    <SelectValue placeholder="Elige un turno" />
                  </SelectTrigger>
                  <SelectContent>
                    {turnoSolicitadoOpciones.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {etiquetaTurno(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="turno-companero">Intercambiar con un compañero (opcional)</Label>
              <Select value={form.companero} onValueChange={(v) => setForm({ ...form, companero: v })}>
                <SelectTrigger id="turno-companero">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_COMPANERO}>Sin intercambio</SelectItem>
                  {companeros
                    .filter((c) => c.id !== miId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {form.companero !== SIN_COMPANERO && (
                <p className="text-xs text-muted-foreground">Tu compañero pasará a tu turno actual y tú al suyo.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="turno-motivo">Motivo *</Label>
              <Textarea
                id="turno-motivo"
                rows={3}
                placeholder="Ej.: Tengo una cita médica por la mañana"
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreando(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={crear} disabled={enviando || form.motivo.trim().length < 5}>
              {enviando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ComentarioDialog
        open={!!respondiendo}
        titulo={respondiendo?.aceptar ? "Aceptar el intercambio" : "Rechazar el intercambio"}
        descripcion={
          respondiendo?.aceptar
            ? "Después lo revisarán RRHH o Dirección."
            : "La solicitud quedará rechazada y tu compañero lo verá."
        }
        confirmar={respondiendo?.aceptar ? "Aceptar" : "Rechazar"}
        destructivo={!respondiendo?.aceptar}
        onCancel={() => setRespondiendo(null)}
        onConfirm={responder}
      />
    </div>
  );
}
