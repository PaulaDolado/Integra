import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Adjunto = Database["public"]["Tables"]["ticket_adjuntos"]["Row"];

export const BUCKET_TICKETS = "tickets";
export const MAX_IMAGENES = 5;
export const MAX_BYTES = 5 * 1024 * 1024;
export const TIPOS_IMAGEN = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Filtra las imágenes válidas y explica por qué se descartan las demás
export function validarImagenes(nuevas: File[], actuales: File[]) {
  const errores: string[] = [];
  const validas: File[] = [];

  for (const archivo of nuevas) {
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      errores.push(`${archivo.name}: solo se admiten imágenes PNG, JPG, WEBP o GIF`);
    } else if (archivo.size > MAX_BYTES) {
      errores.push(`${archivo.name}: supera los 5 MB`);
    } else if (actuales.length + validas.length >= MAX_IMAGENES) {
      errores.push(`Máximo ${MAX_IMAGENES} imágenes por mensaje`);
      break;
    } else {
      validas.push(archivo);
    }
  }

  return { validas, errores };
}

// Imágenes pegadas con Ctrl+V (capturas de pantalla)
export function imagenesDelPortapapeles(event: React.ClipboardEvent): File[] {
  return Array.from(event.clipboardData.files).filter((f) => f.type.startsWith("image/"));
}

// Sube las imágenes al bucket y las registra en el ticket (o en un mensaje)
export async function subirAdjuntos(ticketId: string, seguimientoId: string | null, archivos: File[]) {
  if (archivos.length === 0) return { fallidas: 0 };

  const { data: autorId } = await supabase.rpc("mi_empleado_id");
  let fallidas = 0;

  for (const archivo of archivos) {
    const extension = archivo.name.includes(".") ? archivo.name.split(".").pop() : archivo.type.split("/")[1];
    const nombre = archivo.name && archivo.name !== "image.png" ? archivo.name : `captura.${extension}`;
    const path = `${ticketId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET_TICKETS).upload(path, archivo, {
      contentType: archivo.type,
    });
    if (uploadError) {
      console.error("Error uploading ticket image:", uploadError);
      fallidas++;
      continue;
    }

    const { error } = await supabase.from("ticket_adjuntos").insert({
      ticket_id: ticketId,
      seguimiento_id: seguimientoId,
      autor_id: autorId,
      path,
      nombre: nombre.slice(0, 255),
      tamano: archivo.size,
    });
    if (error) {
      console.error("Error saving ticket attachment:", error);
      await supabase.storage.from(BUCKET_TICKETS).remove([path]);
      fallidas++;
    }
  }

  return { fallidas };
}

// URLs firmadas (1 hora) de todos los adjuntos de un ticket
export async function urlsAdjuntos(adjuntos: Adjunto[]) {
  if (adjuntos.length === 0) return new Map<string, string>();
  const { data, error } = await supabase.storage
    .from(BUCKET_TICKETS)
    .createSignedUrls(adjuntos.map((a) => a.path), 3600);
  // Sin URL, la galería muestra que la imagen no se ha podido cargar
  if (error) console.error("Error signing ticket images:", error);
  // Solo los que se han podido firmar y tienen ruta
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}
