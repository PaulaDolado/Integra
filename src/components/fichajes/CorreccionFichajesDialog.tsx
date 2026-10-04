import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Ban, Loader2, LogIn, LogOut, Plus, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { esCorregido, type Fichaje } from "./calculo";

interface CorreccionFichajesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleado: { id: string; nombre: string } | null;
  // Día a corregir (yyyy-MM-dd)
  fecha: string;
  onSaved: () => void;
}

interface Existente {
  fichaje: Fichaje;
  hora: string; // HH:mm editable
  anular: boolean;
}

interface Nuevo {
  clave: string;
  tipo: "entrada" | "salida";
  hora: string;
}

const MIN_JUSTIFICACION = 10;

const aIso = (fecha: string, hora: string) => new Date(`${fecha}T${hora}`).toISOString();

export function CorreccionFichajesDialog({ open, onOpenChange, empleado, fecha: fechaInicial, onSaved }: CorreccionFichajesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(fechaInicial);
  const [existentes, setExistentes] = useState<Existente[]>([]);
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const [justificacion, setJustificacion] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFecha(fechaInicial);
    setNuevos([]);
    setJustificacion("");
  }, [open, fechaInicial]);

  // Fichajes vigentes (no anulados) del empleado ese día
  const { data: delDia, isLoading: cargando } = useQuery({
    queryKey: ["fichajes-correccion", empleado?.id, fecha],
    queryFn: async () => {
      const dia = new Date(`${fecha}T00:00`);
      return (
        comprobar(
          await supabase
            .from("fichajes")
            .select("id, empleado_id, tipo, fecha_hora, es_manual, anulado, fecha_hora_original, justificacion")
            .eq("empleado_id", empleado!.id)
            .eq("anulado", false)
            .gte("fecha_hora", startOfDay(dia).toISOString())
            .lte("fecha_hora", endOfDay(dia).toISOString())
            .order("fecha_hora")
        ) ?? []
      );
    },
    enabled: open && !!empleado && !!fecha,
    // Al abrir el diálogo se piden siempre los fichajes actuales
    staleTime: 0,
  });

  // Precarga las filas editables con los fichajes cargados
  useEffect(() => {
    if (!delDia) return;
    setExistentes(delDia.map((f) => ({ fichaje: f, hora: format(new Date(f.fecha_hora), "HH:mm"), anular: false })));
  }, [delDia]);

  const horaOriginal = (f: Fichaje) => format(new Date(f.fecha_hora), "HH:mm");
  const modificados = existentes.filter((e) => !e.anular && e.hora !== horaOriginal(e.fichaje));
  const anulados = existentes.filter((e) => e.anular);
  const nuevosValidos = nuevos.filter((n) => n.hora);
  const hayCambios = modificados.length + anulados.length + nuevosValidos.length > 0;
  const justificacionValida = justificacion.trim().length >= MIN_JUSTIFICACION;

  // Sugiere el tipo contrario al último fichaje del día (entrada → salida)
  const añadirFila = () => {
    const vigentes = [...existentes.filter((e) => !e.anular).map((e) => e.fichaje.tipo), ...nuevos.map((n) => n.tipo)];
    const tipo = vigentes.at(-1) === "entrada" ? "salida" : "entrada";
    setNuevos([...nuevos, { clave: crypto.randomUUID(), tipo, hora: "" }]);
  };

  const guardar = async () => {
    if (!empleado || !hayCambios || !justificacionValida) return;
    setGuardando(true);
    const motivo = justificacion.trim();
    const errores: string[] = [];

    for (const e of anulados) {
      const { error } = await supabase.rpc("anular_fichaje", { p_fichaje: e.fichaje.id, p_justificacion: motivo });
      if (error) errores.push(error.message);
    }
    for (const e of modificados) {
      const { error } = await supabase.rpc("modificar_fichaje", {
        p_fichaje: e.fichaje.id,
        p_fecha_hora: aIso(fecha, e.hora),
        p_justificacion: motivo,
      });
      if (error) errores.push(error.message);
    }
    for (const n of nuevosValidos) {
      const { error } = await supabase.rpc("anadir_fichaje_manual", {
        p_empleado: empleado.id,
        p_tipo: n.tipo,
        p_fecha_hora: aIso(fecha, n.hora),
        p_justificacion: motivo,
      });
      if (error) errores.push(error.message);
    }
    setGuardando(false);
    queryClient.invalidateQueries({ queryKey: ["fichajes-correccion", empleado.id] });

    if (errores.length > 0) {
      toast({ title: "Algunas correcciones no se han guardado", description: [...new Set(errores)].join(". "), variant: "destructive" });
      onSaved();
      return;
    }
    toast({ title: "Fichajes corregidos", description: "Los cambios quedan registrados con su justificación" });
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corregir fichajes</DialogTitle>
          <DialogDescription>
            {empleado?.nombre}. Cada cambio queda registrado con quién lo hizo, cuándo y por qué.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="correccion-fecha">Día</Label>
            <Input
              id="correccion-fecha"
              type="date"
              className="w-auto"
              max={format(new Date(), "yyyy-MM-dd")}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
            {fecha && (
              <p className="text-xs capitalize text-muted-foreground">
                {format(new Date(`${fecha}T00:00`), "EEEE, d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Fichajes del día</p>
            {cargando ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : existentes.length === 0 && nuevos.length === 0 ? (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                No hay fichajes este día. Añade los que faltan.
              </p>
            ) : (
              <ul className="space-y-2">
                {existentes.map((e, i) => {
                  const Icon = e.fichaje.tipo === "entrada" ? LogIn : LogOut;
                  const cambiado = !e.anular && e.hora !== horaOriginal(e.fichaje);
                  return (
                    <li
                      key={e.fichaje.id}
                      className={`flex items-center gap-3 rounded-lg border p-2 ${e.anular ? "bg-muted/50 opacity-60" : ""}`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-16 text-sm capitalize">{e.fichaje.tipo}</span>
                      <Input
                        type="time"
                        aria-label={`Hora de ${e.fichaje.tipo}`}
                        className={`h-9 w-28 ${cambiado ? "border-amber-400" : ""}`}
                        value={e.hora}
                        disabled={e.anular}
                        onChange={(ev) =>
                          setExistentes(existentes.map((x, j) => (j === i ? { ...x, hora: ev.target.value } : x)))
                        }
                      />
                      <span className="flex-1 truncate text-xs text-muted-foreground">
                        {e.anular ? "Se anulará" : cambiado ? `Antes ${horaOriginal(e.fichaje)}` : esCorregido(e.fichaje) ? "Ya corregido" : ""}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={e.anular ? "Deshacer anulación" : "Anular fichaje"}
                        title={e.anular ? "Deshacer anulación" : "Anular fichaje"}
                        onClick={() => setExistentes(existentes.map((x, j) => (j === i ? { ...x, anular: !x.anular, hora: horaOriginal(x.fichaje) } : x)))}
                      >
                        {e.anular ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </Button>
                    </li>
                  );
                })}
                {nuevos.map((n) => (
                  <li key={n.clave} className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2">
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                    <select
                      aria-label="Tipo de fichaje"
                      className="h-9 w-24 rounded-lg border border-input bg-card px-2 text-sm"
                      value={n.tipo}
                      onChange={(ev) => setNuevos(nuevos.map((x) => (x.clave === n.clave ? { ...x, tipo: ev.target.value as Nuevo["tipo"] } : x)))}
                    >
                      <option value="entrada">Entrada</option>
                      <option value="salida">Salida</option>
                    </select>
                    <Input
                      type="time"
                      aria-label="Hora del nuevo fichaje"
                      className="h-9 w-28"
                      value={n.hora}
                      onChange={(ev) => setNuevos(nuevos.map((x) => (x.clave === n.clave ? { ...x, hora: ev.target.value } : x)))}
                    />
                    <span className="flex-1 text-xs text-muted-foreground">Nuevo</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Quitar fichaje nuevo"
                      onClick={() => setNuevos(nuevos.filter((x) => x.clave !== n.clave))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={añadirFila} disabled={cargando}>
              <Plus className="h-4 w-4" />
              Añadir fichaje
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="correccion-justificacion">Justificación *</Label>
            <Textarea
              id="correccion-justificacion"
              rows={3}
              placeholder="Ej.: El empleado olvidó fichar la salida; confirmado con su responsable."
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Obligatoria. El empleado verá el motivo junto a sus fichajes corregidos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !hayCambios || !justificacionValida}>
            {guardando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar correcciones
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
