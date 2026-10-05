import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { notificarError } from "@/lib/monitorizacion";

// Solo el nombre de la consulta (el primer elemento de la clave): el resto
// puede llevar ids o textos de búsqueda
const nombreDeClave = (clave: readonly unknown[] | undefined) =>
  typeof clave?.[0] === "string" ? clave[0] : undefined;

export const crearQueryClient = () =>
  new QueryClient({
    // Los avisos al usuario siguen en cada pantalla (useAvisarError, onError de
    // cada mutación); aquí solo se manda el error a la monitorización, si está activa
    queryCache: new QueryCache({
      onError: (error, query) =>
        notificarError(error, { origen: "consulta", datos: { consulta: nombreDeClave(query.queryKey) } }),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _contexto, mutation) =>
        notificarError(error, { origen: "mutacion", datos: { mutacion: nombreDeClave(mutation.options.mutationKey) } }),
    }),
    defaultOptions: {
      queries: {
        // Los cambios de otros usuarios llegan por Realtime, que invalida las
        // consultas afectadas; no hace falta volver a pedir los datos tan a menudo
        staleTime: 30_000,
        retry: 1,
      },
    },
  });

// Cliente único de la app. Se exporta para invalidar o vaciar la caché fuera de
// los componentes (por ejemplo, al cerrar sesión).
export const queryClient = crearQueryClient();

// Lanza el error de Supabase para que TanStack Query lo trate como fallo
export function comprobar<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw error;
  return data;
}
