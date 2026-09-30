import { useCallback, useEffect, useState } from "react";
import { endOfDay, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type TipoFichaje = "entrada" | "salida";

// Estado de fichaje del empleado de la sesión: si está dentro (última entrada de
// hoy sin salida) y una función para registrar la entrada o la salida.
// La hora la pone el servidor; aquí solo se decide el tipo.
export function useFichajeActual() {
  const { user } = useAuth();
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  const [dentroDesde, setDentroDesde] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);

  const cargar = useCallback(async (id: string) => {
    const hoy = new Date();
    const { data } = await supabase
      .from("fichajes")
      .select("tipo, fecha_hora")
      .eq("empleado_id", id)
      .eq("anulado", false)
      .gte("fecha_hora", startOfDay(hoy).toISOString())
      .lte("fecha_hora", endOfDay(hoy).toISOString())
      .order("fecha_hora", { ascending: false })
      .limit(1)
      .maybeSingle();
    setDentroDesde(data?.tipo === "entrada" ? new Date(data.fecha_hora) : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.rpc("mi_empleado_id").then(({ data: id }) => {
      if (!id) {
        setLoading(false);
        return;
      }
      setEmpleadoId(id);
      cargar(id);
      // Mantiene sincronizados la barra superior y la página de fichajes
      channel = supabase
        .channel(`mi-fichaje-${id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "fichajes", filter: `empleado_id=eq.${id}` }, () => cargar(id))
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user, cargar]);

  const fichar = useCallback(async (): Promise<{ tipo: TipoFichaje; error: string | null }> => {
    const tipo: TipoFichaje = dentroDesde ? "salida" : "entrada";
    if (!empleadoId) return { tipo, error: "Tu usuario no tiene un perfil de empleado asociado" };

    setRegistrando(true);
    const { error } = await supabase.from("fichajes").insert({ empleado_id: empleadoId, tipo });
    setRegistrando(false);
    if (error) {
      console.error("Error registering fichaje:", error);
      return { tipo, error: "No se pudo registrar el fichaje" };
    }
    await cargar(empleadoId);
    return { tipo, error: null };
  }, [dentroDesde, empleadoId, cargar]);

  return { dentro: dentroDesde !== null, dentroDesde, loading, registrando, fichar };
}
