import { expect, test } from "@playwright/test";

test("sin sesión, una página privada manda al login", async ({ page }) => {
  await page.goto("/tareas");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Iniciar Sesión" })).toBeVisible();
});

test("una ruta que no existe muestra la página 404", async ({ page }) => {
  await page.goto("/no-existe");
  await expect(page.getByText("Esta página no existe")).toBeVisible();
  await page.getByRole("link", { name: "Volver al inicio" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("el build aplica la política de seguridad de contenido", async ({ page }) => {
  await page.goto("/login");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain(new URL(process.env.E2E_SUPABASE_URL!).origin);
});

test("con una contraseña incorrecta no entra @credenciales", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Ingrese su correo electrónico").first().fill("e2e-empleado@integra.test");
  await page.getByPlaceholder("Ingrese su contraseña").fill("contraseña-que-no-es");
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await expect(page.getByText("Credenciales incorrectas")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
