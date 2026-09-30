import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Los tests nunca hablan con Supabase: cada uno simula el cliente
    env: {
      VITE_SUPABASE_URL: "http://supabase.test",
      VITE_SUPABASE_PUBLISHABLE_KEY: "clave-de-prueba",
    },
    restoreMocks: true,
  },
});
