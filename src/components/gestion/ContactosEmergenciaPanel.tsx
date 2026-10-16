import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartPulse, Loader2, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useAvisarError } from "@/hooks/useAvisarError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Contacto = Database["public"]["Tables"]["contactos_emergencia"]["Row"];

const VACIO = { nombre: "", relacion: "", telefono: "" };

// Contactos de emergencia de un empleado, dentro de su ficha en Gestión de
// Empleados. Cada cambio se guarda al momento; el empleado lo ve en Configuración.
export function ContactosEmergenciaPanel({ empleadoId }: { empleadoId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // null = ninguno, "nuevo" = añadiendo, id = editando ese contacto
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  // Misma clave que la sección de Configuración del propio empleado
  const clave = ["contactos-emergencia", empleadoId];
  const { data: contactos = [], isPending: cargando, error } = useQuery({
    queryKey: clave,
    queryFn: async (): Promise<Contacto[]> =>
      comprobar(
        await supabase.from("contactos_emergencia").select("*").eq("empleado_id", empleadoId).order("created_at")
      ) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar los contactos de emergencia");

  const empezar = (contacto: Contacto | null) => {
    setEditando(contacto?.id ?? "nuevo");
    setForm(contacto ? { nombre: contacto.nombre, relacion: contacto.relacion ?? "", telefono: contacto.telefono } : VACIO);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.telefono.trim()) {
      toast({ title: "Error", description: "El nombre y el teléfono son obligatorios", variant: "destructive" });
      return;
    }
    const valores = { nombre: form.nombre.trim(), relacion: form.relacion.trim() || null, telefono: form.telefono.trim() };

    setGuardando(true);
    const { error } =
      editando === "nuevo"
        ? await supabase.from("contactos_emergencia").insert({ ...valores, empleado_id: empleadoId })
        : await supabase.from("contactos_emergencia").update(valores).eq("id", editando!);
    if (!error) await queryClient.invalidateQueries({ queryKey: clave });
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
    if (!error) await queryClient.invalidateQueries({ queryKey: clave });
    setGuardando(false);

    if (error) {
      console.error("Error removing emergency contact:", error);
      toast({ title: "Error", description: "No se pudo eliminar el contacto", variant: "destructive" });
      return;
    }
    toast({ title: "Contacto eliminado", description: `${contacto.nombre} ya no figura como contacto` });
  };

  const formulario = (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ficha-contacto-nombre">Nombre *</Label>
          <Input id="ficha-contacto-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ficha-contacto-relacion">Relación</Label>
          <Input
            id="ficha-contacto-relacion"
            placeholder="Pareja, madre..."
            value={form.relacion}
            onChange={(e) => setForm({ ...form, relacion: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ficha-contacto-telefono">Teléfono *</Label>
          <Input
            id="ficha-contacto-telefono"
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
    <section aria-labelledby="ficha-contactos" className="space-y-3">
      <h3 id="ficha-contactos" className="flex items-center gap-2 text-sm font-semibold">
        <HeartPulse className="h-4 w-4 text-primary" aria-hidden />
        Contactos de emergencia
      </h3>

      {cargando ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          {contactos.length === 0 && editando !== "nuevo" && (
            <p className="text-sm text-muted-foreground">No tiene ningún contacto de emergencia.</p>
          )}
          {contactos.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {contactos.map((c) =>
                editando === c.id ? (
                  <li key={c.id} className="p-2">
                    {formulario}
                  </li>
                ) : (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.nombre}
                        {c.relacion && <span className="font-normal text-muted-foreground"> · {c.relacion}</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Phone className="h-3 w-3" aria-hidden />
                        {c.telefono}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
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
          )}
          {editando === "nuevo" ? (
            formulario
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => empezar(null)}
              disabled={guardando || editando !== null}
            >
              <Plus className="h-4 w-4" />
              Añadir contacto
            </Button>
          )}
        </>
      )}
    </section>
  );
}
