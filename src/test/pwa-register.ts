// Sustituto de «virtual:pwa-register» en los tests: el módulo real lo genera
// vite-plugin-pwa al compilar y los tests no cargan ese plugin. Nunca registra nada.
import type { RegisterSWOptions } from "vite-plugin-pwa/types";

export function registerSW(_opciones?: RegisterSWOptions) {
  return async (_recargar?: boolean) => {};
}
