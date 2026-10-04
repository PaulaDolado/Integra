import fs from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARPETA_AUTH, USUARIOS, clienteAdmin, hayClaveAdmin } from "./entorno";

// Borra lo que han creado las personas de prueba, para que cada ejecución empiece de cero
export async function limpiarDatos(admin: SupabaseClient) {
  const emails = Object.values(USUARIOS).map((u) => u.email);
  const { data: empleados, error } = await admin.from("empleados").select("id").in("correo_electronico", emails);
  if (error) throw error;
  const ids = (empleados ?? []).map((e) => e.id);
  if (ids.length === 0) return;

  const borrados = await Promise.all([
    admin.from("fichajes").delete().in("empleado_id", ids),
    admin.from("solicitudes_vacacion").delete().in("empleado_id", ids),
    admin.from("tickets").delete().in("autor_id", ids),
    admin.from("notificaciones").delete().in("destinatario_email", emails),
  ]);
  const fallo = borrados.find((r) => r.error);
  if (fallo?.error) throw fallo.error;
}

// Después de los tests: limpia los datos y las sesiones guardadas
export default async function limpiar() {
  if (hayClaveAdmin()) await limpiarDatos(clienteAdmin());
  fs.rmSync(CARPETA_AUTH, { recursive: true, force: true });
}
