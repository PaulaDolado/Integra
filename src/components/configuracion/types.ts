import type { Database } from "@/integrations/supabase/types";

export type Empleado = Database["public"]["Tables"]["empleados"]["Row"];

export interface ConfigTabProps {
  empleado: Empleado;
  onUpdated: () => Promise<void>;
}
