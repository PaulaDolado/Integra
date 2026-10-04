import { describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { crearClienteDePrueba, renderHookConQuery } from "@/test/render";
import { usePermisos } from "./usePermisos";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

const usuario = (id: string | null) =>
  vi.mocked(useAuth).mockReturnValue({ user: id ? { id } : null } as ReturnType<typeof useAuth>);

describe("usePermisos", () => {
  it("sin sesión no tiene ningún permiso y no consulta", async () => {
    usuario(null);
    const { result } = renderHookConQuery(() => usePermisos());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tiene("datos_pago.ver")).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("carga los permisos una sola vez aunque lo usen varios componentes", async () => {
    usuario("u1");
    vi.mocked(supabase.rpc).mockResolvedValue({ data: ["datos_pago.ver"], error: null } as never);

    const cliente = crearClienteDePrueba();
    const a = renderHookConQuery(() => usePermisos(), cliente);
    const b = renderHookConQuery(() => usePermisos(), cliente);
    await waitFor(() => expect(a.result.current.loading).toBe(false));
    await waitFor(() => expect(b.result.current.loading).toBe(false));

    expect(a.result.current.tiene("datos_pago.ver")).toBe(true);
    expect(b.result.current.tiene("contactos_emergencia.ver")).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("mis_permisos");
  });

  it("vuelve a consultar si cambia el usuario", async () => {
    usuario("u2");
    vi.mocked(supabase.rpc).mockResolvedValue({ data: ["tickets.gestionar"], error: null } as never);
    const { result } = renderHookConQuery(() => usePermisos());
    await waitFor(() => expect(result.current.tiene("tickets.gestionar")).toBe(true));
    expect(result.current.tiene("datos_pago.ver")).toBe(false);
  });

  it("si la consulta falla no concede nada y lo reintenta la próxima vez", async () => {
    usuario("u3");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "fallo" } } as never);
    const cliente = crearClienteDePrueba();
    const primero = renderHookConQuery(() => usePermisos(), cliente);
    await waitFor(() => expect(primero.result.current.loading).toBe(false));
    expect(primero.result.current.permisos.size).toBe(0);
    primero.unmount();

    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: ["turnos.aprobar"], error: null } as never);
    const segundo = renderHookConQuery(() => usePermisos(), cliente);
    await waitFor(() => expect(segundo.result.current.tiene("turnos.aprobar")).toBe(true));
  });
});
