import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { comprobar } from "@/lib/query-client";

// Id de la ficha de empleado del usuario de la sesión, compartido por toda la app.
// `null` si el usuario no tiene ficha.
export function useMiEmpleadoId() {
  const { user } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["mi-empleado-id", user?.id],
    queryFn: async () => comprobar(await supabase.rpc("mi_empleado_id")) ?? null,
    enabled: !!user,
    staleTime: Infinity,
  });
  return { empleadoId: data ?? null, loading: !!user && isPending };
}
