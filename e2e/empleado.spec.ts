import { expect, test } from "@playwright/test";
import { iniciarSesion } from "./sesion";

// Sesión de un empleado de Operaciones, sin ningún permiso de gestión

test("ficha la entrada y la salida, y la barra superior se entera", async ({ page }) => {
  await page.goto("/fichajes");
  const entrada = page.getByRole("button", { name: "Fichar Entrada" });
  const salida = page.getByRole("button", { name: "Fichar Salida" });

  await expect(entrada).toBeEnabled();
  await entrada.click();
  await expect(page.getByText("Entrada registrada correctamente")).toBeVisible();
  await expect(salida).toBeEnabled();
  // La barra superior y la página comparten los datos del fichaje
  await expect(page.getByRole("button", { name: "Fichar salida" })).toBeVisible();

  await salida.click();
  await expect(page.getByText("Salida registrada correctamente")).toBeVisible();
  await expect(entrada).toBeEnabled();
  await expect(page.getByRole("button", { name: "Fichar entrada" })).toBeVisible();
});

test("crea un ticket y aparece en su lista", async ({ page }) => {
  const titulo = `No funciona la impresora ${Date.now()}`;
  await page.goto("/tickets");
  await page.getByRole("button", { name: "Nuevo ticket" }).click();
  await page.getByLabel("Título *").fill(titulo);
  await page.getByLabel("Descripción *").fill("La impresora de la planta 2 no imprime desde esta mañana.");
  await page.getByRole("button", { name: "Crear ticket" }).click();

  await expect(page.getByText("Ticket creado")).toBeVisible();
  await page.goto("/tickets");
  await expect(page.getByText(titulo)).toBeVisible();
});

test("el menú no muestra las pantallas de gestión", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Registro de Fichajes" }).first()).toBeVisible();
  await expect(page.getByText("Gestión", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Gestión de Empleados" })).toHaveCount(0);
});

test("aunque escriba la dirección, la bandeja de ausencias no le enseña nada", async ({ page }) => {
  await page.goto("/bandeja-ausencias");
  await expect(page.getByText("No tienes acceso a la bandeja de ausencias")).toBeVisible();
});

test("el organigrama no muestra correos ni teléfonos", async ({ page }) => {
  await page.goto("/organigrama");
  await expect(page.getByText("Elena Pruebas")).toBeVisible();
  await expect(page.getByText("@integra.test")).toHaveCount(0);
  await expect(page.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0);
});

test.describe("cerrar sesión", () => {
  // Cerrar sesión invalida las sesiones del usuario: entra por su cuenta y va el último
  test.use({ storageState: { cookies: [], origins: [] } });

  test("vuelve al login y no puede volver atrás", async ({ page }) => {
    await iniciarSesion(page, "empleado");
    await page.getByRole("button", { name: "Menú de usuario" }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/fichajes");
    await expect(page).toHaveURL(/\/login$/);
  });
});
