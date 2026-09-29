import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsSection, InfoGrid, InfoRow, EditActions } from "./SettingsSection";
import type { ConfigTabProps } from "./types";

type DatosPago = Database["public"]["Tables"]["datos_pago"]["Row"];

const FORMAS_PAGO: Record<string, string> = {
  transferencia: "Transferencia",
};

const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

// Validación estándar ISO 13616: reordenar, pasar letras a números y comprobar mod 97
function isValidIban(value: string) {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("ES") && iban.length !== 24) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /\d/.test(char) ? char : String(char.charCodeAt(0) - 55);
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();

// Solo se muestran los 4 últimos dígitos
const maskIban = (iban: string) => {
  const clean = normalizeIban(iban);
  return formatIban(clean.slice(0, 2) + "•".repeat(clean.length - 6) + clean.slice(-4));
};

export function PagoTab({ empleado }: ConfigTabProps) {
  const [datos, setDatos] = useState<DatosPago | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iban, setIban] = useState("");

  const fetchDatos = async () => {
    const { data, error } = await supabase
      .from("datos_pago")
      .select("*")
      .eq("empleado_id", empleado.id)
      .maybeSingle();
    if (error) console.error("Error fetching payment data:", error);
    setDatos(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDatos();
  }, [empleado.id]);

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
    fetchDatos();
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
          <InfoRow label="IBAN" value={datos?.iban ? maskIban(datos.iban) : null} />
        </InfoGrid>
      )}
    </SettingsSection>
  );
}
