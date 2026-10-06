import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { borrarImagenesNota } from "./imagenes";

// Primero las imágenes (después ya no se podría comprobar de quién es la nota)
export async function eliminarNota(notaId: string) {
  await borrarImagenesNota(notaId);
  comprobar(await supabase.rpc("eliminar_nota", { p_nota: notaId }));
}

// Un colaborador deja de tener acceso a la nota
export async function salirDeNota(notaId: string, empleadoId: string) {
  comprobar(await supabase.rpc("quitar_colaborador_nota", { p_nota: notaId, p_empleado: empleadoId }));
}
