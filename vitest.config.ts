import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Lo genera vite-plugin-pwa, que aquí no se carga: los tests nunca registran el service worker
      "virtual:pwa-register": path.resolve(import.meta.dirname, "./src/test/pwa-register.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "supabase/functions/**/*.test.ts"],
    // Los tests nunca hablan con Supabase: cada uno simula el cliente
    env: {
      VITE_SUPABASE_URL: "http://supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "clave-de-prueba",
    },
    restoreMocks: true,
    // Las páginas grandes (Calendario, Fichajes) renderizan mucho en cada clic:
    // con toda la batería en paralelo, 5 s se quedan cortos
    testTimeout: 15_000,
  },
});
