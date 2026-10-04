import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface SettingsSectionProps {
  title: string;
  description?: string;
  // Muestra el botón "Modificar" en la cabecera
  onEdit?: () => void;
  editing?: boolean;
  children: React.ReactNode;
}

export function SettingsSection({ title, description, onEdit, editing, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-4">
        <div className="space-y-1">
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {onEdit && !editing && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Modificar
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function InfoGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid gap-4 sm:grid-cols-2">{children}</dl>;
}

export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium wrap-break-word">{value?.trim() ? value : "-"}</dd>
    </div>
  );
}

interface EditActionsProps {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function EditActions({ saving, onCancel, onSave }: EditActionsProps) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button type="button" onClick={onSave} disabled={saving}>
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}
