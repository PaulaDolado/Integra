import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection, InfoGrid, InfoRow, EditActions } from "./SettingsSection";
import type { ConfigTabProps } from "./types";
import { formatIban, isValidIban, maskIban, normalizeIban } from "@/lib/iban";

const FORMAS_PAGO: Record<string, string> = {
  transferencia: "Transferencia",
};

export function PagoTab({ empleado }: ConfigTabProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iban, setIban] = useState("");

  // El IBAN se enmascara dentro de la consulta: el completo nunca llega a la caché
  const { data: datos = null, isPending: loading } = useQuery({
    queryKey: ["datos-pago", empleado.id],
    queryFn: async () => {
      const fila = comprobar(
        await supabase.from("datos_pago").select("forma_pago, iban").eq("empleado_id", empleado.id).maybeSingle()
      );
      return fila && { forma_pago: fila.forma_pago, iban_enmascarado: fila.iban ? maskIban(fila.iban) : null };
    },
  });

  const save = async () => {
    if (!isValidIban(iban)) {
      toast.error("El IBAN no es válido");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("datos_pago").upsert({
      empleado_id: empleado.id,
      forma_pago: "transferencia",
      iban: normalizeIban(iban),
    });
    setSaving(false);

    if (error) {
      console.error("Error saving payment data:", error);
      toast.error("No se pudo guardar la información de pago");
      return;
    }
    toast.success("Información de pago actualizada");
    setEditing(false);
    queryClient.invalidateQueries({ queryKey: ["datos-pago", empleado.id] });
  };

  return (
    <SettingsSection
      title="Información de pago"
      description="Gestiona la información de pago utilizada por tu empresa para el pago de tu nómina."
      onEdit={() => {
        // Nunca se precarga el IBAN guardado: hay que escribirlo completo
        setIban("");
        setEditing(true);
      }}
      editing={editing}
    >
      {loading ? null : editing ? (
        <div className="space-y-4">
          <InfoGrid>
            <InfoRow label="Forma de pago" value="Transferencia" />
          </InfoGrid>
          <div className="space-y-2 sm:max-w-md">
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              autoComplete="off"
              placeholder="ES00 0000 0000 0000 0000 0000"
              value={iban}
              onChange={(e) => setIban(formatIban(e.target.value))}
            />
          </div>
          <EditActions saving={saving} onCancel={() => setEditing(false)} onSave={save} />
        </div>
      ) : (
        <InfoGrid>
          <InfoRow label="Forma de pago" value={FORMAS_PAGO[datos?.forma_pago ?? "transferencia"]} />
          <InfoRow label="IBAN" value={datos?.iban_enmascarado ?? null} />
        </InfoGrid>
      )}
    </SettingsSection>
  );
}
