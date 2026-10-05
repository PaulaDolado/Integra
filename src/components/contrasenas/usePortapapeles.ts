import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// Lo copiado se borra del portapapeles pasado este tiempo
const BORRADO_PORTAPAPELES_MS = 30 * 1000;

export type QueCopiar = "usuario" | "contrasena";

// Copia al portapapeles avisando con un toast; las contraseñas se borran solas al rato
export function usePortapapeles() {
  const { toast } = useToast();
  const temporizadorPortapapeles = useRef<number>();

  return async (texto: string, que: QueCopiar) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
      return;
    }
    if (que === "usuario") {
      toast({ title: "Usuario copiado" });
      return;
    }
    window.clearTimeout(temporizadorPortapapeles.current);
    temporizadorPortapapeles.current = window.setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => undefined);
    }, BORRADO_PORTAPAPELES_MS);
    toast({ title: "Contraseña copiada", description: "Se borrará del portapapeles en 30 segundos." });
  };
}
