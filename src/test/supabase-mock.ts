import { vi } from "vitest";

// Respuestas simuladas de las funciones RPC, por nombre de función
export type RespuestasRpc = Record<string, unknown | ((args?: Record<string, unknown>) => unknown)>;

export function simularRpc(respuestas: RespuestasRpc) {
  return vi.fn(async (nombre: string, args?: Record<string, unknown>) => {
    if (!(nombre in respuestas)) return { data: null, error: { message: `RPC no simulada: ${nombre}` } };
    const r = respuestas[nombre];
    return { data: typeof r === "function" ? r(args) : r, error: null };
  });
}
