import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsSection } from "./SettingsSection";
import type { ConfigTabProps } from "./types";

type Consentimiento = "mostrar_telefono_directorio" | "mostrar_email_directorio";

const CONSENTIMIENTOS: { campo: Consentimiento; label: string }[] = [
  { campo: "mostrar_telefono_directorio", label: "Acepto que mi número de teléfono se muestre en el directorio de empleados" },
  { campo: "mostrar_email_directorio", label: "Acepto que mi dirección e-mail se muestre en el directorio de empleados" },
];

export function ConfidencialidadTab({ empleado, onUpdated }: ConfigTabProps) {
  const [saving, setSaving] = useState<Consentimiento | null>(null);

  const toggle = async (campo: Consentimiento, value: boolean) => {
    setSaving(campo);
    const cambio: Partial<Record<Consentimiento, boolean>> = { [campo]: value };
    const { error } = await supabase.from("empleados").update(cambio).eq("id", empleado.id);
    setSaving(null);

    if (error) {
      console.error("Error updating consent:", error);
      toast.error("No se pudo guardar la preferencia");
      return;
    }
    toast.success("Preferencia guardada");
    await onUpdated();
  };

  return (
    <SettingsSection
      title="Gestión de datos personales"
      description="Decide qué datos pueden ver tus compañeros en el directorio de empleados."
    >
      <div className="divide-y divide-border">
        {CONSENTIMIENTOS.map(({ campo, label }) => (
          <div key={campo} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <Label htmlFor={campo} className="font-normal leading-snug cursor-pointer">
              {label}
            </Label>
            <Switch
              id={campo}
              checked={empleado[campo]}
              disabled={saving === campo}
              onCheckedChange={(value) => toggle(campo, value)}
            />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
