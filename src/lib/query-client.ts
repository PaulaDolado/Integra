import { QueryClient } from "@tanstack/react-query";

export const crearQueryClient = () =>
  new QueryClient({
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
