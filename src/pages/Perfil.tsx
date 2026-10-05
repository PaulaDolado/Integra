import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { User, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { comprobar } from "@/lib/query-client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { SettingsSection, InfoGrid, InfoRow } from "@/components/configuracion/SettingsSection";
import type { Empleado } from "@/components/configuracion/types";

const IDIOMAS: Record<string, string> = {
  es: "Español",
  ca: "Català",
  en: "English",
};

export default function Perfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Cargo y departamento vienen resueltos por el hook compartido con la cabecera
  const { profile, loading: profileLoading, getFullName } = useEmployeeProfile();
  // Misma clave que en Configuración, que la invalida al guardar
  const { data: empleado = null, isLoading: loading } = useQuery({
    queryKey: ["empleado", user?.id],
    queryFn: async (): Promise<Empleado | null> =>
      comprobar(await supabase.from("empleados").select("*").eq("user_id", user!.id).maybeSingle()),
    enabled: !!user,
  });

  const editar = () => navigate("/configuracion?tab=perfil");

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const initials = empleado
    ? `${empleado.nombre.charAt(0)}${empleado.primer_apellido.charAt(0)}`
    : "U";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto w-full">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            Mi Perfil
          </h1>
          <p className="text-muted-foreground">
            Tu información personal y de contacto.
          </p>
        </div>
        {empleado && (
          <Button className="gap-2" onClick={editar}>
            <Edit className="w-4 h-4" />
            Editar Perfil
          </Button>
        )}
      </div>

      {!empleado ? (
        <p className="text-muted-foreground">
          Tu usuario no tiene un perfil de empleado asociado. Contacta con Recursos Humanos.
        </p>
      ) : (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <Avatar className="w-20 h-20">
                  <AvatarImage src="/placeholder-avatar.jpg" alt={getFullName()} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{getFullName()}</h2>
                  <p className="text-muted-foreground">{profile?.cargo_nombre || "Empleado"}</p>
                  <Badge variant="secondary" className="mt-2">
                    {profile?.departamento_nombre || "Sin departamento"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <SettingsSection title="Información personal" onEdit={editar}>
            <InfoGrid>
              <InfoRow label="Nombre" value={empleado.nombre} />
              <InfoRow label="Apellido" value={empleado.primer_apellido} />
              <InfoRow label="Segundo apellido" value={empleado.segundo_apellido} />
              <InfoRow label="Número de teléfono" value={empleado.numero_telefono} />
              <InfoRow label="Correo electrónico" value={empleado.correo_electronico} />
            </InfoGrid>
          </SettingsSection>

          <SettingsSection title="Datos de contacto" onEdit={editar}>
            <InfoGrid>
              <InfoRow label="Dirección" value={empleado.direccion} />
              <InfoRow label="Complemento de dirección" value={empleado.complemento_direccion} />
              <InfoRow label="Código postal" value={empleado.codigo_postal} />
              <InfoRow label="Ciudad" value={empleado.ciudad} />
              <InfoRow label="País" value={empleado.pais} />
            </InfoGrid>
          </SettingsSection>

          <SettingsSection title="Información laboral">
            <InfoGrid>
              <InfoRow label="Cargo" value={profile?.cargo_nombre ?? "No asignado"} />
              <InfoRow label="Departamento" value={profile?.departamento_nombre ?? "No asignado"} />
              <InfoRow
                label="Fecha de ingreso"
                value={new Date(empleado.fecha_ingreso).toLocaleDateString("es-ES")}
              />
              <InfoRow label="ID empleado" value={empleado.id.slice(0, 8)} />
            </InfoGrid>
          </SettingsSection>

          <SettingsSection title="Preferencias de idioma" onEdit={editar}>
            <InfoGrid>
              <InfoRow label="Idioma" value={IDIOMAS[empleado.idioma] ?? empleado.idioma} />
            </InfoGrid>
          </SettingsSection>
        </>
      )}
    </div>
  );
}
