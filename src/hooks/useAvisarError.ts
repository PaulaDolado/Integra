import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

// Muestra un aviso cuando falla una consulta (una vez por error, no en cada render)
export function useAvisarError(error: unknown, descripcion: string) {
  useEffect(() => {
    if (!error) return;
    console.error(descripcion, error);
    toast({ title: "Error", description: descripcion, variant: "destructive" });
  }, [error, descripcion]);
}
