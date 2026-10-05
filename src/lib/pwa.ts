import { registerSW } from "virtual:pwa-register";
import { toast } from "sonner";

// Cada cuánto se comprueba si hay una versión nueva con la app abierta
// (instalada en el móvil puede pasar días sin recargarse)
const COMPROBAR_CADA_MS = 60 * 60 * 1000;

// Registra el service worker de la app instalable. Solo se llama en el build
// de producción (ver src/main.tsx): ni en desarrollo ni en los tests.
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const actualizar = registerSW({
    // Hay una versión nueva descargada: se avisa y se espera a que el usuario
    // decida, para no recargar la página a mitad de un fichaje o un formulario
    onNeedRefresh() {
      toast("Hay una versión nueva de Integra", {
        id: "version-nueva",
        description: "Actualiza cuando termines lo que estás haciendo.",
        duration: Infinity,
        action: { label: "Actualizar", onClick: () => void actualizar(true) },
      });
    },
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      setInterval(() => {
        // Sin conexión no tiene sentido; si falla se reintenta en la siguiente vuelta
        if (navigator.onLine) registro.update().catch(() => {});
      }, COMPROBAR_CADA_MS);
    },
  });
}
