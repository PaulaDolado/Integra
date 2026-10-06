import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface Contacto {
  id: string;
  nombre: string;
  relacion: string | null;
  telefono: string;
}

interface ContactosEmergenciaDialogProps {
  // null = cerrado
  empleado: { id: string; nombre: string; contactos: Contacto[] } | null;
  onClose: () => void;
}

const VACIO = { nombre: "", relacion: "", telefono: "" };

// RRHH añade, corrige o borra los contactos de emergencia de un empleado
export function ContactosEmergenciaDialog({ empleado, onClose }: ContactosEmergenciaDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // null = ninguno, "nuevo" = añadiendo, id = editando ese contacto
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  // Al cambiar de empleado se parte de cero
  const [previo, setPrevio] = useState(empleado?.id);
  if (empleado?.id !== previo) {
    setPrevio(empleado?.id);
    setEditando(null);
    setForm(VACIO);
  }

  const recargar = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contactos-emergencia-plantilla"] }),
      // La sección de Configuración del propio empleado
      queryClient.invalidateQueries({ queryKey: ["contactos-emergencia", empleado?.id] }),
    ]);

  const empezar = (contacto: Contacto | null) => {
    setEditando(contacto?.id ?? "nuevo");
    setForm(contacto ? { nombre: contacto.nombre, relacion: contacto.relacion ?? "", telefono: contacto.telefono } : VACIO);
  };

  const guardar = async () => {
    if (!empleado) return;
    if (!form.nombre.trim() || !form.telefono.trim()) {
      toast({ title: "Error", description: "El nombre y el teléfono son obligatorios", variant: "destructive" });
      return;
    }
    const valores = { nombre: form.nombre.trim(), relacion: form.relacion.trim() || null, telefono: form.telefono.trim() };

    setGuardando(true);
    const { error } =
      editando === "nuevo"
        ? await supabase.from("contactos_emergencia").insert({ ...valores, empleado_id: empleado.id })
        : await supabase.from("contactos_emergencia").update(valores).eq("id", editando!);
    if (!error) await recargar();
    setGuardando(false);

    if (error) {
      console.error("Error saving emergency contact:", error);
      toast({ title: "Error", description: "No se pudo guardar el contacto", variant: "destructive" });
      return;
    }
    toast({ title: editando === "nuevo" ? "Contacto añadido" : "Contacto actualizado" });
    setEditando(null);
  };

  const borrar = async (contacto: Contacto) => {
    setGuardando(true);
    const { error } = await supabase.from("contactos_emergencia").delete().eq("id", contacto.id);
    if (!error) await recargar();
    setGuardando(false);

    if (error) {
      console.error("Error removing emergency contact:", error);
      toast({ title: "Error", description: "No se pudo eliminar el contacto", variant: "destructive" });
      return;
    }
    toast({ title: "Contacto eliminado", description: `${contacto.nombre} ya no figura como contacto` });
  };

  const formulario = (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="rrhh-contacto-nombre">Nombre *</Label>
          <Input id="rrhh-contacto-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rrhh-contacto-relacion">Relación</Label>
          <Input
            id="rrhh-contacto-relacion"
            placeholder="Pareja, madre..."
            value={form.relacion}
            onChange={(e) => setForm({ ...form, relacion: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rrhh-contacto-telefono">Teléfono *</Label>
          <Input
            id="rrhh-contacto-telefono"
            type="tel"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditando(null)} disabled={guardando}>
          Cancelar
        </Button>
        <Button size="sm" onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          {editando === "nuevo" ? "Añadir" : "Guardar"}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={!!empleado} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contactos de emergencia</DialogTitle>
          <DialogDescription>{empleado?.nombre}. El empleado verá los cambios en su Configuración.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {empleado?.contactos.length === 0 && editando !== "nuevo" && (
            <p className="text-sm text-muted-foreground">No tiene ningún contacto de emergencia.</p>
          )}
          <ul className="divide-y divide-border">
            {empleado?.contactos.map((c) =>
              editando === c.id ? (
                <li key={c.id} className="py-3">
                  {formulario}
                </li>
              ) : (
                <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {c.nombre}
                      {c.relacion && <span className="font-normal text-muted-foreground"> · {c.relacion}</span>}
                    </p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground tabular-nums">
                      <Phone className="h-3 w-3" />
                      {c.telefono}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Editar a ${c.nombre}`}
                      onClick={() => empezar(c)}
                      disabled={guardando || editando !== null}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Eliminar a ${c.nombre}`}
                      onClick={() => borrar(c)}
                      disabled={guardando || editando !== null}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>

          {editando === "nuevo" ? (
            formulario
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => empezar(null)} disabled={guardando || editando !== null}>
              <Plus className="h-4 w-4" />
              Añadir contacto
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
