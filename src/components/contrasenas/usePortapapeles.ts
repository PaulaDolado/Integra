import { useToast } from "@/hooks/use-toast";

// Lo copiado se borra del portapapeles pasado este tiempo
export const BORRADO_PORTAPAPELES_MS = 30 * 1000;

export type QueCopiar = "usuario" | "contrasena";

// Borrado pendiente de la última contraseña copiada. Vive fuera del componente
// para que se haga aunque se salga de la página de Contraseñas.
let pendiente: { temporizador: number; contrasena: string } | null = null;

function cancelarBorrado() {
  if (!pendiente) return;
  window.clearTimeout(pendiente.temporizador);
  pendiente = null;
  document.removeEventListener("copy", cancelarBorrado);
  document.removeEventListener("cut", cancelarBorrado);
}

// ¿Podemos leer el portapapeles sin que el navegador pregunte? Solo si ya hay permiso:
// no se pide, porque saldría una ventana a los 30 segundos sin venir a cuento
async function puedeLeerPortapapeles() {
  try {
    const estado = await navigator.permissions.query({ name: "clipboard-read" as PermissionName });
    return estado.state === "granted";
  } catch {
    return false;
  }
}

async function borrarSiSigueLaContrasena(contrasena: string) {
  if (await puedeLeerPortapapeles()) {
    try {
      // Si ya hay otra cosa (copiada en otra aplicación), no se toca
      if ((await navigator.clipboard.readText()) !== contrasena) return;
    } catch {
      // Sin poder comprobarlo, se borra: es más seguro que dejar la contraseña
    }
  }
  await navigator.clipboard.writeText("").catch(() => undefined);
}

function programarBorrado(contrasena: string) {
  cancelarBorrado();
  pendiente = {
    contrasena,
    temporizador: window.setTimeout(() => {
      const { contrasena: copiada } = pendiente!;
      cancelarBorrado();
      void borrarSiSigueLaContrasena(copiada);
    }, BORRADO_PORTAPAPELES_MS),
  };
  // Si se copia otra cosa dentro de Integra, el portapapeles ya no tiene la contraseña
  document.addEventListener("copy", cancelarBorrado);
  document.addEventListener("cut", cancelarBorrado);
}

// Copia al portapapeles avisando con un toast. Las contraseñas se borran solas
// a los 30 segundos, salvo que mientras tanto se haya copiado otra cosa.
export function usePortapapeles() {
  const { toast } = useToast();

  return async (texto: string, que: QueCopiar) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
      return;
    }
    if (que === "usuario") {
      // Lo copiado ahora es el usuario: ya no hay contraseña que borrar
      cancelarBorrado();
      toast({ title: "Usuario copiado" });
      return;
    }
    programarBorrado(texto);
    toast({ title: "Contraseña copiada", description: "Se borrará del portapapeles en 30 segundos." });
  };
}
