import { isAuthWeakPasswordError } from "@supabase/supabase-js";

// Longitud mínima de la contraseña de acceso, al cambiarla o restablecerla
export const MIN_LONGITUD_CONTRASENA = 8;

// Mensaje para el usuario cuando Supabase rechaza una contraseña nueva.
// null si el error no tiene que ver con la contraseña elegida.
export function mensajeContrasenaRechazada(error: { code?: string } | null | undefined): string | null {
  if (!error) return null;
  if (error.code === "same_password") return "La nueva contraseña debe ser distinta a la actual";
  if (error.code !== "weak_password" && !isAuthWeakPasswordError(error)) return null;

  const motivos: string[] = isAuthWeakPasswordError(error) ? error.reasons : [];
  // Con la protección de contraseñas filtradas de Supabase (HaveIBeenPwned)
  if (motivos.includes("pwned")) {
    return "Esta contraseña aparece en filtraciones de datos conocidas. Elige otra que no uses en ningún otro sitio.";
  }
  if (motivos.includes("length")) return "La contraseña es demasiado corta";
  if (motivos.includes("characters")) {
    return "La contraseña debe combinar más tipos de caracteres: mayúsculas, minúsculas, números y símbolos";
  }
  return "La contraseña es demasiado débil. Elige otra más segura.";
}
