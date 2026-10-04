import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { crearClienteDePrueba, renderHookConQuery } from "@/test/render";
import { useInvalidarEnCambios } from "./useInvalidarEnCambios";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel: vi.fn(), removeChannel: vi.fn() } }));

// Canal simulado que guarda los manejadores para poder disparar cambios
function simularCanal() {
  const manejadores: { filtro: Record<string, unknown>; cb: () => void }[] = [];
  const canal = {
    on: vi.fn((_tipo: string, filtro: Record<string, unknown>, cb: () => void) => {
      manejadores.push({ filtro, cb });
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };
  vi.mocked(supabase.channel).mockReturnValue(canal as never);
  return { canal, manejadores };
}

describe("useInvalidarEnCambios", () => {
  beforeEach(() => vi.mocked(supabase.channel).mockReset());

  it("se suscribe a cada tabla con su filtro e invalida las consultas al recibir un cambio", () => {
    const { manejadores } = simularCanal();
    const cliente = crearClienteDePrueba();
    const invalidar = vi.spyOn(cliente, "invalidateQueries");

    renderHookConQuery(
      () => useInvalidarEnCambios("mi-canal", [{ table: "tareas", filter: "asignado_a_id=eq.1" }, { table: "proyectos" }], [["tareas"], ["proyectos"]]),
      cliente
    );

    expect(supabase.channel).toHaveBeenCalledWith("mi-canal");
    expect(manejadores.map((m) => m.filtro)).toEqual([
      { event: "*", schema: "public", table: "tareas", filter: "asignado_a_id=eq.1" },
      { event: "*", schema: "public", table: "proyectos" },
    ]);

    manejadores[0].cb();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["tareas"] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["proyectos"] });
  });

  it("no se suscribe sin canal", () => {
    renderHookConQuery(() => useInvalidarEnCambios(null, [{ table: "tareas" }], [["tareas"]]));
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("no vuelve a suscribirse en cada render y se da de baja al desmontar", () => {
    const { canal } = simularCanal();
    const { rerender, unmount } = renderHookConQuery(() => useInvalidarEnCambios("mi-canal", [{ table: "tareas" }], [["tareas"]]));
    rerender();
    rerender();
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledWith(canal);
  });
});
