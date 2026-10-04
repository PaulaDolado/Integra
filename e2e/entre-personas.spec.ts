import { expect, test, type Browser } from "@playwright/test";
import { estadoSesion, type Rol } from "./entorno";

const abrirComo = async (browser: Browser, rol: Rol) => {
  const contexto = await browser.newContext({ storageState: estadoSesion(rol) });
  return contexto.newPage();
};

test("RRHH aprueba una ausencia y el empleado lo ve al momento, sin recargar", async ({ browser }) => {
  const empleado = await abrirComo(browser, "empleado");
  const rrhh = await abrirComo(browser, "rrhh");

  // RRHH tiene la bandeja abierta antes de que llegue la solicitud
  await rrhh.goto("/bandeja-ausencias");
  await expect(rrhh.getByRole("heading", { name: /ausencias/i })).toBeVisible();
  await expect(rrhh.getByText("Elena Pruebas")).toHaveCount(0);

  // El empleado pide un día de teletrabajo
  await empleado.goto("/vacaciones");
  await empleado.getByRole("button", { name: "Nueva Solicitud" }).click();
  await empleado.getByRole("combobox", { name: "Tipo de ausencia" }).click();
  await empleado.getByRole("option", { name: "Teletrabajo" }).click();
  await empleado.getByLabel("Fecha de Inicio").fill("2030-03-04");
  await empleado.getByLabel("Fecha de Fin").fill("2030-03-04");
  await empleado.getByRole("button", { name: "Enviar Solicitud" }).click();
  await expect(empleado.getByText("Solicitud enviada")).toBeVisible();
  await expect(empleado.getByText("Pendiente").first()).toBeVisible();

  // Llega a la bandeja de RRHH por Realtime
  const solicitud = rrhh.getByText("Elena Pruebas");
  await expect(solicitud).toBeVisible({ timeout: 15_000 });
  await rrhh.getByRole("button", { name: "Aprobar" }).first().click();
  await rrhh.getByRole("dialog").getByRole("button", { name: "Aprobar" }).click();
  await expect(rrhh.getByText("Solicitud aprobada")).toBeVisible();

  // Y el empleado ve el cambio sin recargar la página
  await expect(empleado.getByText("Aprobada").first()).toBeVisible({ timeout: 15_000 });
});

test("el empleado no puede ver la bandeja aunque RRHH sí", async ({ browser }) => {
  const empleado = await abrirComo(browser, "empleado");
  const rrhh = await abrirComo(browser, "rrhh");

  await empleado.goto("/dashboard");
  await rrhh.goto("/dashboard");
  await expect(rrhh.getByRole("link", { name: "Bandeja de Ausencias" })).toBeVisible();
  await expect(empleado.getByRole("link", { name: "Bandeja de Ausencias" })).toHaveCount(0);
});
