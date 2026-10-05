import { useToast } from "@/hooks/use-toast";

// Aviso de una acción fallida sobre un ticket: errores de Supabase ({ message })
// y excepciones (red caída, etc.)
export function useAvisarFallo() {
  const { toast } = useToast();
  return (error: unknown) => {
    console.error("Error in ticket action:", error);
    const mensaje = (error as { message?: string } | null)?.message;
    toast({ title: "Error", description: mensaje || "Inténtalo de nuevo", variant: "destructive" });
  };
}
