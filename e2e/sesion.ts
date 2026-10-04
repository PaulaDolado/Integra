import { expect, type Page } from "@playwright/test";
import { credenciales, type Rol } from "./entorno";

// Entra por la pantalla de login, como lo haría la persona
export async function iniciarSesion(page: Page, rol: Rol) {
  const { email, password } = credenciales()[rol];
  await page.goto("/login");
  await page.getByPlaceholder("Ingrese su correo electrónico").first().fill(email);
  await page.getByPlaceholder("Ingrese su contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
