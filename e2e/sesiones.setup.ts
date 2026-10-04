import { test as setup } from "@playwright/test";
import { estadoSesion } from "./entorno";
import { iniciarSesion } from "./sesion";

// Guarda la sesión de cada persona para que los demás tests empiecen ya dentro
for (const rol of ["empleado", "rrhh"] as const) {
  setup(`sesión de ${rol}`, async ({ page }) => {
    await iniciarSesion(page, rol);
    await page.context().storageState({ path: estadoSesion(rol) });
  });
}
