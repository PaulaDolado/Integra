import crypto from "node:crypto";
import fs from "node:fs";
import { ARCHIVO_CREDENCIALES, CARPETA_AUTH, USUARIOS, clienteAdmin, comprobarProyectoDePruebas, hayClaveAdmin, type Rol } from "./entorno";
import { limpiarDatos } from "./limpiar";

// Antes de los tests: crea (o reutiliza) las personas de prueba en el proyecto de
// pruebas, les pone una contraseña nueva y aleatoria y deja sus datos limpios
export default async function preparar() {
  comprobarProyectoDePruebas();
  if (!hayClaveAdmin()) {
    console.warn("Sin E2E_SUPABASE_SERVICE_ROLE_KEY: solo se pueden ejecutar los tests sin sesión (--project=sin-sesion).");
    return;
  }
  const admin = clienteAdmin();
  const { data: lista, error: errorLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (errorLista) throw errorLista;

  const credenciales = {} as Record<Rol, { email: string; password: string }>;
  for (const [rol, usuario] of Object.entries(USUARIOS) as [Rol, (typeof USUARIOS)[Rol]][]) {
    const password = crypto.randomBytes(24).toString("base64url");
    const existente = lista.users.find((u) => u.email === usuario.email);
    const { data, error } = existente
      ? await admin.auth.admin.updateUserById(existente.id, { password, email_confirm: true })
      : await admin.auth.admin.createUser({ email: usuario.email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error(`No se pudo preparar ${usuario.email}`);

    const { data: departamento, error: errorDepartamento } = await admin
      .from("departamentos")
      .select("id")
      .eq("nombre", usuario.departamento)
      .single();
    if (errorDepartamento) throw new Error(`No existe el departamento «${usuario.departamento}»: ¿están aplicadas las migraciones?`);

    const { error: errorEmpleado } = await admin.from("empleados").upsert(
      {
        user_id: data.user.id,
        nombre: usuario.nombre,
        primer_apellido: "Pruebas",
        segundo_apellido: "E2E",
        correo_electronico: usuario.email,
        departamento_id: departamento.id,
        activo: true,
        es_admin: false,
      },
      { onConflict: "user_id" }
    );
    if (errorEmpleado) throw errorEmpleado;

    credenciales[rol] = { email: usuario.email, password };
  }

  await limpiarDatos(admin);

  fs.mkdirSync(CARPETA_AUTH, { recursive: true });
  fs.writeFileSync(ARCHIVO_CREDENCIALES, JSON.stringify(credenciales));
}
