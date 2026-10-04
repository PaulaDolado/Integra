import { defineConfig, devices } from "@playwright/test";
import { estadoSesion } from "./e2e/entorno";

const PUERTO = 4173;
const CI = !!process.env.CI;

// Tests end-to-end contra el build de producción (con su CSP) y el proyecto
// de Supabase de PRUEBAS. Cómo configurarlo: README, «Tests end-to-end».
export default defineConfig({
  testDir: "./e2e",
  // Todos los tests comparten el mismo proyecto de pruebas: uno detrás de otro
  workers: 1,
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/preparar.ts",
  globalTeardown: "./e2e/limpiar.ts",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "sesiones", testMatch: /sesiones\.setup\.ts/ },
    {
      name: "sin-sesion",
      testMatch: /sin-sesion\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "empleado",
      testMatch: /empleado\.spec\.ts/,
      dependencies: ["sesiones"],
      use: { ...devices["Desktop Chrome"], storageState: estadoSesion("empleado") },
    },
    {
      // Flujos con dos personas a la vez: cada test abre sus propias sesiones
      name: "entre-personas",
      testMatch: /entre-personas\.spec\.ts/,
      dependencies: ["sesiones"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
      BASE_PATH: "/",
    },
  },
});
