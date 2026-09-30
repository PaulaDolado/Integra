import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PerfilTab } from "@/components/configuracion/PerfilTab";
import { InicioSesionTab } from "@/components/configuracion/InicioSesionTab";
import { ConfidencialidadTab } from "@/components/configuracion/ConfidencialidadTab";
import { PagoTab } from "@/components/configuracion/PagoTab";
import type { Empleado } from "@/components/configuracion/types";
import { notifyEmployeeProfileUpdated } from "@/hooks/useEmployeeProfile";

const TABS = [
  { value: "perfil", label: "Perfil" },
  { value: "inicio-sesion", label: "Inicio de sesión" },
  { value: "confidencialidad", label: "Confidencialidad" },
  { value: "pago", label: "Información de pago" },
];

export default function Configuracion() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(true);

  const tab = TABS.some((t) => t.value === searchParams.get("tab")) ? searchParams.get("tab")! : "perfil";

  const fetchEmpleado = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("empleados").select("*").eq("user_id", user.id).maybeSingle();
    if (error) console.error("Error fetching empleado:", error);
    setEmpleado(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmpleado();
  }, [user]);

  const handleUpdated = async () => {
    await fetchEmpleado();
    notifyEmployeeProfileUpdated();
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configuración personal
        </h1>
        <p className="text-muted-foreground mt-1">Gestiona tus datos, tu acceso y tu privacidad.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
          <TabsList className="h-auto flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="inicio-sesion" className="mt-6">
            <InicioSesionTab />
          </TabsContent>

          {empleado ? (
            <>
              <TabsContent value="perfil" className="mt-6">
                <PerfilTab empleado={empleado} onUpdated={handleUpdated} />
              </TabsContent>
              <TabsContent value="confidencialidad" className="mt-6">
                <ConfidencialidadTab empleado={empleado} onUpdated={handleUpdated} />
              </TabsContent>
              <TabsContent value="pago" className="mt-6">
                <PagoTab empleado={empleado} onUpdated={handleUpdated} />
              </TabsContent>
            </>
          ) : (
            tab !== "inicio-sesion" && (
              <p className="mt-6 text-muted-foreground">
                Tu usuario no tiene un perfil de empleado asociado. Contacta con Recursos Humanos.
              </p>
            )
          )}
        </Tabs>
      )}
    </div>
  );
}
