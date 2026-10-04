import { defineConfig, devices } from "@playwright/test";

// Prueba de humo contra la web publicada y el Supabase de PRODUCCIÓN.
// Solo usa los tests que no inician sesión ni escriben nada: sin cuentas de
// prueba, sin clave service_role y sin datos. Se ejecuta después de cada despliegue.
const url = process.env.HUMO_URL;
if (!url) throw new Error("Falta HUMO_URL: la dirección de la web publicada, p. ej. https://<usuario>.github.io/<repositorio>/");

export default defineConfig({
  testDir: "./e2e",
  testMatch: /sin-sesion\.spec\.ts/,
  // El de la contraseña incorrecta intentaría iniciar sesión en producción
  grepInvert: /@credenciales/,
  workers: 1,
  // GitHub Pages puede tardar unos segundos en servir la versión nueva
  retries: 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    // Con «/» final, las rutas relativas de los tests cuelgan de /<repositorio>/
    baseURL: url.endsWith("/") ? url : `${url}/`,
    locale: "es-ES",
    trace: "retain-on-failure",
  },
});
