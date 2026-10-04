import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// En local, las variables salen de .env.e2e.local (no se sube a git); en CI, de GitHub
const ARCHIVO_LOCAL = path.resolve(import.meta.dirname, "../.env.e2e.local");
if (fs.existsSync(ARCHIVO_LOCAL)) process.loadEnvFile(ARCHIVO_LOCAL);

export const CARPETA_AUTH = path.resolve(import.meta.dirname, ".auth");
export const ARCHIVO_CREDENCIALES = path.join(CARPETA_AUTH, "credenciales.json");
export const estadoSesion = (rol: Rol) => path.join(CARPETA_AUTH, `${rol}.json`);

export function variable(nombre: string) {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre}. Mira la sección «Tests end-to-end» del README.`);
  return valor;
}

// Los tests crean y borran datos: nunca deben apuntar al proyecto de producción
export function comprobarProyectoDePruebas() {
  const url = variable("E2E_SUPABASE_URL");
  const produccion = process.env.E2E_URL_PRODUCCION;
  if (produccion && new URL(produccion).host === new URL(url).host) {
    throw new Error("E2E_SUPABASE_URL apunta al proyecto de producción. Los tests end-to-end solo pueden usar el de pruebas.");
  }
  return url;
}

// Sin la clave service_role solo se pueden ejecutar los tests sin sesión
export const hayClaveAdmin = () => !!process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

// Cliente con la clave service_role: solo para preparar y limpiar datos, nunca llega al navegador
export const clienteAdmin = () =>
  createClient(comprobarProyectoDePruebas(), variable("E2E_SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export type Rol = "empleado" | "rrhh";

// Personas de prueba. Su contraseña se genera en cada ejecución y no se guarda en ningún sitio fijo.
export const USUARIOS: Record<Rol, { email: string; nombre: string; departamento: string }> = {
  empleado: { email: "e2e-empleado@integra.test", nombre: "Elena", departamento: "Operaciones" },
  rrhh: { email: "e2e-rrhh@integra.test", nombre: "Ramón", departamento: "Recursos Humanos" },
};

export const credenciales = (): Record<Rol, { email: string; password: string }> =>
  JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, "utf8"));
