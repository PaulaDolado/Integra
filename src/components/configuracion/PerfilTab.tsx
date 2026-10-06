import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSection, InfoGrid, InfoRow, EditActions } from "./SettingsSection";
import type { ConfigTabProps } from "./types";

type ContactoEmergencia = Database["public"]["Tables"]["contactos_emergencia"]["Row"];

const IDIOMAS = [
  { value: "es", label: "Español" },
  { value: "ca", label: "Català" },
  { value: "en", label: "English" },
];

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function InformacionPersonal({ empleado, onUpdated }: ConfigTabProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", primer_apellido: "", segundo_apellido: "", numero_telefono: "" });

  const startEdit = () => {
    setForm({
      nombre: empleado.nombre,
      primer_apellido: empleado.primer_apellido,
      segundo_apellido: empleado.segundo_apellido,
      numero_telefono: empleado.numero_telefono ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.nombre.trim() || !form.primer_apellido.trim()) {
      toast.error("El nombre y el apellido son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("empleados")
      .update({
        nombre: form.nombre.trim(),
        primer_apellido: form.primer_apellido.trim(),
        segundo_apellido: form.segundo_apellido.trim(),
        numero_telefono: form.numero_telefono.trim() || null,
      })
      .eq("id", empleado.id);
    setSaving(false);

    if (error) {
      console.error("Error updating personal info:", error);
      toast.error("No se pudo guardar la información personal");
      return;
    }
    toast.success("Información personal actualizada");
    setEditing(false);
    await onUpdated();
  };

  return (
    <SettingsSection title="Información personal" onEdit={startEdit} editing={editing}>
      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
            <Field id="primer_apellido" label="Apellido *" value={form.primer_apellido} onChange={(v) => setForm({ ...form, primer_apellido: v })} />
            <Field id="segundo_apellido" label="Segundo apellido" value={form.segundo_apellido} onChange={(v) => setForm({ ...form, segundo_apellido: v })} />
            <Field id="numero_telefono" label="Número de teléfono" type="tel" placeholder="+34 600 000 000" value={form.numero_telefono} onChange={(v) => setForm({ ...form, numero_telefono: v })} />
          </div>
          <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={save} />
        </div>
      ) : (
        <InfoGrid>
          <InfoRow label="Nombre" value={empleado.nombre} />
          <InfoRow label="Apellido" value={empleado.primer_apellido} />
          <InfoRow label="Segundo apellido" value={empleado.segundo_apellido} />
          <InfoRow label="Número de teléfono" value={empleado.numero_telefono} />
        </InfoGrid>
      )}
    </SettingsSection>
  );
}

function DatosContacto({ empleado, onUpdated }: ConfigTabProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ direccion: "", complemento_direccion: "", codigo_postal: "", ciudad: "", pais: "" });

  const startEdit = () => {
    setForm({
      direccion: empleado.direccion ?? "",
      complemento_direccion: empleado.complemento_direccion ?? "",
      codigo_postal: empleado.codigo_postal ?? "",
      ciudad: empleado.ciudad ?? "",
      pais: empleado.pais ?? "España",
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("empleados")
      .update({
        direccion: form.direccion.trim() || null,
        complemento_direccion: form.complemento_direccion.trim() || null,
        codigo_postal: form.codigo_postal.trim() || null,
        ciudad: form.ciudad.trim() || null,
        pais: form.pais.trim() || null,
      })
      .eq("id", empleado.id);
    setSaving(false);

    if (error) {
      console.error("Error updating contact data:", error);
      toast.error("No se pudieron guardar los datos de contacto");
      return;
    }
    toast.success("Datos de contacto actualizados");
    setEditing(false);
    await onUpdated();
  };

  return (
    <SettingsSection title="Datos de contacto" onEdit={startEdit} editing={editing}>
      {editing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="direccion" label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} />
            <Field id="complemento_direccion" label="Complemento de dirección" placeholder="Piso, puerta, escalera..." value={form.complemento_direccion} onChange={(v) => setForm({ ...form, complemento_direccion: v })} />
            <Field id="codigo_postal" label="Código postal" value={form.codigo_postal} onChange={(v) => setForm({ ...form, codigo_postal: v })} />
            <Field id="ciudad" label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
            <Field id="pais" label="País" value={form.pais} onChange={(v) => setForm({ ...form, pais: v })} />
          </div>
          <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={save} />
        </div>
      ) : (
        <InfoGrid>
          <InfoRow label="Dirección" value={empleado.direccion} />
          <InfoRow label="Complemento de dirección" value={empleado.complemento_direccion} />
          <InfoRow label="Código postal" value={empleado.codigo_postal} />
          <InfoRow label="Ciudad" value={empleado.ciudad} />
          <InfoRow label="País" value={empleado.pais} />
        </InfoGrid>
      )}
    </SettingsSection>
  );
}

function ContactosEmergencia({ empleado }: ConfigTabProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: "", relacion: "", telefono: "" });
  // Contacto que se está corrigiendo (null = ninguno) y sus datos en el formulario
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState({ nombre: "", relacion: "", telefono: "" });

  const clave = ["contactos-emergencia", empleado.id];
  const { data: contactos = [], isPending: loading } = useQuery({
    queryKey: clave,
    queryFn: async (): Promise<ContactoEmergencia[]> =>
      comprobar(
        await supabase.from("contactos_emergencia").select("*").eq("empleado_id", empleado.id).order("created_at")
      ) ?? [],
  });

  const cancel = () => {
    setForm({ nombre: "", relacion: "", telefono: "" });
    setEditandoId(null);
    setEditing(false);
  };

  const startEditContacto = (contacto: ContactoEmergencia) => {
    setEditandoId(contacto.id);
    setEdicion({ nombre: contacto.nombre, relacion: contacto.relacion ?? "", telefono: contacto.telefono });
  };

  const update = async () => {
    if (!edicion.nombre.trim() || !edicion.telefono.trim()) {
      toast.error("El nombre y el teléfono son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("contactos_emergencia")
      .update({
        nombre: edicion.nombre.trim(),
        relacion: edicion.relacion.trim() || null,
        telefono: edicion.telefono.trim(),
      })
      .eq("id", editandoId!);
    setSaving(false);

    if (error) {
      console.error("Error updating emergency contact:", error);
      toast.error("No se pudo guardar el contacto");
      return;
    }
    toast.success("Contacto de emergencia actualizado");
    setEditandoId(null);
    queryClient.invalidateQueries({ queryKey: clave });
  };

  const add = async () => {
    if (!form.nombre.trim() || !form.telefono.trim()) {
      toast.error("El nombre y el teléfono son obligatorios");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("contactos_emergencia").insert({
      empleado_id: empleado.id,
      nombre: form.nombre.trim(),
      relacion: form.relacion.trim() || null,
      telefono: form.telefono.trim(),
    });
    setSaving(false);

    if (error) {
      console.error("Error adding emergency contact:", error);
      toast.error("No se pudo añadir el contacto");
      return;
    }
    toast.success("Contacto de emergencia añadido");
    cancel();
    queryClient.invalidateQueries({ queryKey: clave });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("contactos_emergencia").delete().eq("id", id);
    if (error) {
      console.error("Error removing emergency contact:", error);
      toast.error("No se pudo eliminar el contacto");
      return;
    }
    // Se quita al momento de la lista, sin esperar a volver a pedirla
    queryClient.setQueryData<ContactoEmergencia[]>(clave, (prev) => prev?.filter((c) => c.id !== id));
  };

  return (
    <SettingsSection title="Contactos de emergencia" onEdit={() => setEditing(true)} editing={editing}>
      <div className="space-y-4">
        {loading ? null : contactos.length === 0 && !editing ? (
          <p className="text-sm text-muted-foreground">No se ha indicado ningún contacto de emergencia.</p>
        ) : (
          <ul className="divide-y divide-border">
            {contactos.map((contacto) =>
              editandoId === contacto.id ? (
                <li key={contacto.id} className="space-y-4 py-3 first:pt-0">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field id="editar_contacto_nombre" label="Nombre *" value={edicion.nombre} onChange={(v) => setEdicion({ ...edicion, nombre: v })} />
                    <Field id="editar_contacto_relacion" label="Relación" placeholder="Pareja, madre..." value={edicion.relacion} onChange={(v) => setEdicion({ ...edicion, relacion: v })} />
                    <Field id="editar_contacto_telefono" label="Teléfono *" type="tel" value={edicion.telefono} onChange={(v) => setEdicion({ ...edicion, telefono: v })} />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setEditandoId(null)} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={update} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={contacto.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                  <div>
                    <p className="font-medium">
                      {contacto.nombre}
                      {contacto.relacion && (
                        <span className="text-muted-foreground font-normal"> · {contacto.relacion}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {contacto.telefono}
                    </p>
                  </div>
                  {editing && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditContacto(contacto)}
                        disabled={saving || editandoId !== null}
                        aria-label={`Editar a ${contacto.nombre}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(contacto.id)}
                        disabled={saving || editandoId !== null}
                        aria-label={`Eliminar a ${contacto.nombre}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </li>
              )
            )}
          </ul>
        )}

        {editing && editandoId === null && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Añadir contacto
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="contacto_nombre" label="Nombre *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
              <Field id="contacto_relacion" label="Relación" placeholder="Pareja, madre..." value={form.relacion} onChange={(v) => setForm({ ...form, relacion: v })} />
              <Field id="contacto_telefono" label="Teléfono *" type="tel" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={cancel} disabled={saving}>
                Cerrar
              </Button>
              <Button type="button" onClick={add} disabled={saving}>
                {saving ? "Guardando..." : "Añadir"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function PreferenciasIdioma({ empleado, onUpdated }: ConfigTabProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [idioma, setIdioma] = useState(empleado.idioma);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("empleados").update({ idioma }).eq("id", empleado.id);
    setSaving(false);

    if (error) {
      console.error("Error updating language:", error);
      toast.error("No se pudo guardar el idioma");
      return;
    }
    toast.success("Preferencia de idioma actualizada");
    setEditing(false);
    await onUpdated();
  };

  const label = IDIOMAS.find((i) => i.value === empleado.idioma)?.label ?? empleado.idioma;

  return (
    <SettingsSection
      title="Preferencias de idioma"
      onEdit={() => {
        setIdioma(empleado.idioma);
        setEditing(true);
      }}
      editing={editing}
    >
      {editing ? (
        <div className="space-y-4">
          <div className="space-y-2 sm:max-w-xs">
            <Label htmlFor="idioma">Idioma</Label>
            <Select value={idioma} onValueChange={setIdioma}>
              <SelectTrigger id="idioma">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDIOMAS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={save} />
        </div>
      ) : (
        <InfoGrid>
          <InfoRow label="Idioma" value={label} />
        </InfoGrid>
      )}
    </SettingsSection>
  );
}

export function PerfilTab(props: ConfigTabProps) {
  return (
    <div className="space-y-6">
      <InformacionPersonal {...props} />
      <DatosContacto {...props} />
      <ContactosEmergencia {...props} />
      <PreferenciasIdioma {...props} />
    </div>
  );
}
