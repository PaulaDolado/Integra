import { expect, test } from "@playwright/test";

// Estos tests no inician sesión ni escriben nada: también sirven como prueba de
// humo contra producción (playwright.humo.config.ts). Las rutas van sin «/» inicial
// para que funcionen bajo /<repositorio>/ en GitHub Pages.

const supabaseUrl = () => process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;

test("sin sesión, una página privada manda al login", async ({ page }) => {
  await page.goto("tareas");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Iniciar Sesión" })).toBeVisible();
});

test("una ruta que no existe muestra la página 404", async ({ page }) => {
  await page.goto("no-existe");
  await expect(page.getByText("Esta página no existe")).toBeVisible();
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("el build aplica la política de seguridad de contenido", async ({ page }) => {
  await page.goto("login");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain(new URL(supabaseUrl()).origin);
});

test("la CSP no bloquea nada de lo que carga la app", async ({ page }) => {
  const bloqueos: string[] = [];
  page.on("console", (mensaje) => {
    if (/Content Security Policy/i.test(mensaje.text())) bloqueos.push(mensaje.text());
  });
  await page.goto("login");
  await expect(page.getByRole("button", { name: "Iniciar Sesión" })).toBeVisible();
  await page.goto("no-existe");
  await expect(page.getByText("Esta página no existe")).toBeVisible();
  expect(bloqueos).toEqual([]);
});

test("con una contraseña incorrecta no entra @credenciales", async ({ page }) => {
  await page.goto("login");
  await page.getByPlaceholder("Ingrese su correo electrónico").first().fill("e2e-empleado@integra.test");
  await page.getByPlaceholder("Ingrese su contraseña").fill("contraseña-que-no-es");
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await expect(page.getByText("Credenciales incorrectas")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
