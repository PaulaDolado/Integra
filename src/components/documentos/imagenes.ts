import { supabase } from "@/integrations/supabase/client";
import { BUCKET_NOTAS, MAX_BYTES_IMAGEN, TIPOS_IMAGEN } from "./notas";

// Motivo por el que no se admite la imagen, o null si vale
export function problemaImagen(archivo: File) {
  if (!TIPOS_IMAGEN.includes(archivo.type)) return `${archivo.name}: solo se admiten imágenes PNG, JPG, WEBP o GIF`;
  if (archivo.size > MAX_BYTES_IMAGEN) return `${archivo.name}: supera los 5 MB`;
  return null;
}

const EXTENSIONES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Sube la imagen a la carpeta de la nota y devuelve su ruta en el bucket
export async function subirImagenNota(notaId: string, archivo: File) {
  const ruta = `${notaId}/${crypto.randomUUID()}.${EXTENSIONES[archivo.type] ?? "png"}`;
  const { error } = await supabase.storage.from(BUCKET_NOTAS).upload(ruta, archivo, { contentType: archivo.type });
  if (error) throw error;
  return ruta;
}

// URL firmada de 1 hora para ver una imagen
export async function urlImagenNota(ruta: string) {
  const { data, error } = await supabase.storage.from(BUCKET_NOTAS).createSignedUrl(ruta, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Borra todas las imágenes de la nota (antes de eliminarla)
export async function borrarImagenesNota(notaId: string) {
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET_NOTAS).list(notaId, { limit: 100 });
    if (error) throw error;
    if (!data || data.length === 0) return;
    const { error: errorBorrar } = await supabase.storage.from(BUCKET_NOTAS).remove(data.map((a) => `${notaId}/${a.name}`));
    if (errorBorrar) throw errorBorrar;
    if (data.length < 100) return;
  }
}
