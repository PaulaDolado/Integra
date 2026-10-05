import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import type { Aviso } from "@/hooks/useAvisos";
import { renderConQuery } from "@/test/render";
import { CampanaAvisos } from "./CampanaAvisos";

const toast = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast, useToast: () => ({ toast }) }));

const YO = "e-yo";
const haceMinutos = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const aviso = (datos: Partial<Aviso>): Aviso => ({
  id: "a1",
  empleado_id: YO,
  tipo: "ticket",
  titulo: "Nueva respuesta en tu ticket",
  cuerpo: "La impresora no imprime: Marta Ruiz ha respondido «¿Has probado a reiniciarla?»",
  enlace: "/tickets/t1",
  leido_en: null,
  created_at: haceMinutos(5),
  ...datos,
});

// Avisos en memoria: las consultas los leen y la RPC los marca como leídos
let filas: Aviso[];
// Manejadores de Realtime registrados con channel().on()
let realtime: { filtro: Record<string, unknown>; cb: () => void }[];

function tabla() {
  let soloCuenta = false;
  const cadena = {
    select: (_columnas: string, opciones?: { head?: boolean }) => ((soloCuenta = !!opciones?.head), cadena),
    eq: () => cadena,
    is: () => cadena,
    order: () => cadena,
    limit: () => cadena,
    then: <T,>(ok: (r: unknown) => T) =>
      Promise.resolve(
        soloCuenta
          ? { data: null, count: filas.filter((a) => !a.leido_en).length, error: null }
          : { data: [...filas], error: null }
      ).then(ok),
  };
  return cadena;
}

function prepararSupabase() {
  vi.mocked(supabase.from).mockImplementation(tabla as never);
  vi.mocked(supabase.rpc).mockImplementation((async (_nombre: string, args?: { p_ids?: string[] }) => {
    let marcados = 0;
    filas = filas.map((a) => {
      if (a.leido_en || (args?.p_ids && !args.p_ids.includes(a.id))) return a;
      marcados++;
      return { ...a, leido_en: new Date().toISOString() };
    });
    return { data: marcados, error: null };
  }) as never);
  const canal = {
    on: vi.fn((_tipo: string, filtro: Record<string, unknown>, cb: () => void) => {
      realtime.push({ filtro, cb });
      return canal;
    }),
    subscribe: vi.fn(() => canal),
  };
  vi.mocked(supabase.channel).mockReturnValue(canal as never);
}

const Ruta = () => <p data-testid="ruta">{useLocation().pathname}</p>;

const renderCampana = () =>
  renderConQuery(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <CampanaAvisos />
      <Routes>
        <Route path="*" element={<Ruta />} />
      </Routes>
    </MemoryRouter>
  );

const abrirCampana = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole("button", { name: /^Avisos/ }));

describe("CampanaAvisos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filas = [];
    realtime = [];
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: YO, loading: false });
    prepararSupabase();
  });

  it("muestra cuántos avisos hay sin leer", async () => {
    filas = [aviso({ id: "a1" }), aviso({ id: "a2" }), aviso({ id: "a3", leido_en: haceMinutos(1) })];
    renderCampana();

    const campana = await screen.findByRole("button", { name: "Avisos, 2 sin leer" });
    expect(campana).toHaveTextContent("2");
  });

  it("muestra 9+ cuando hay más de nueve sin leer", async () => {
    filas = Array.from({ length: 12 }, (_, i) => aviso({ id: `a${i}` }));
    renderCampana();

    expect(await screen.findByRole("button", { name: "Avisos, 12 sin leer" })).toHaveTextContent("9+");
  });

  it("lista los avisos con su texto y el tiempo transcurrido", async () => {
    const user = userEvent.setup();
    filas = [
      aviso({ id: "a1" }),
      aviso({ id: "a2", tipo: "ausencia", titulo: "Ausencia aprobada", cuerpo: "Tu ausencia el 12/10/2026 ha sido aprobada.", leido_en: haceMinutos(1), created_at: haceMinutos(120) }),
    ];
    renderCampana();
    await abrirCampana(user);

    expect(await screen.findByText("Nueva respuesta en tu ticket")).toBeInTheDocument();
    expect(screen.getByText(/Marta Ruiz ha respondido/)).toBeInTheDocument();
    expect(screen.getByText("Ausencia aprobada")).toBeInTheDocument();
    expect(screen.getByText("hace 5 minutos")).toBeInTheDocument();
    expect(screen.getByText("hace alrededor de 2 horas")).toBeInTheDocument();
    // Solo el primero se anuncia como no leído
    expect(screen.getAllByText("(sin leer)")).toHaveLength(1);
  });

  it("al pulsar un aviso lo marca como leído y lleva a su enlace", async () => {
    const user = userEvent.setup();
    filas = [
      aviso({ id: "a1", enlace: "/tickets/t1" }),
      aviso({ id: "a2", tipo: "turno", titulo: "Cambio de turno aprobado", enlace: "/cambio-turno" }),
    ];
    renderCampana();
    await abrirCampana(user);

    await user.click(await screen.findByRole("button", { name: /^Nueva respuesta en tu ticket/ }));

    expect(supabase.rpc).toHaveBeenCalledWith("marcar_avisos_leidos", { p_ids: ["a1"] });
    expect(screen.getByTestId("ruta")).toHaveTextContent("/tickets/t1");
    expect(await screen.findByRole("button", { name: "Avisos, 1 sin leer" })).toBeInTheDocument();
  });

  it("marca todos como leídos", async () => {
    const user = userEvent.setup();
    filas = [aviso({ id: "a1" }), aviso({ id: "a2" })];
    renderCampana();
    await abrirCampana(user);

    await user.click(await screen.findByRole("button", { name: "Marcar todos como leídos" }));

    expect(supabase.rpc).toHaveBeenCalledWith("marcar_avisos_leidos", {});
    expect(await screen.findByRole("button", { name: "Avisos" })).not.toHaveTextContent(/\d/);
    expect(screen.queryByText("(sin leer)")).not.toBeInTheDocument();
  });

  it("dice que no hay avisos cuando no tiene ninguno", async () => {
    const user = userEvent.setup();
    renderCampana();
    await abrirCampana(user);

    expect(await screen.findByText("No tienes avisos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar todos como leídos" })).not.toBeInTheDocument();
  });

  it("escucha por Realtime solo los avisos del empleado", async () => {
    renderCampana();

    await waitFor(() => expect(supabase.channel).toHaveBeenCalledWith(`avisos-${YO}`));
    expect(realtime.map((r) => r.filtro)).toEqual([
      { event: "*", schema: "public", table: "avisos", filter: `empleado_id=eq.${YO}` },
    ]);
  });

  it("muestra un toast cuando llega un aviso nuevo con la app abierta", async () => {
    filas = [aviso({ id: "a1", leido_en: haceMinutos(1) })];
    renderCampana();
    await screen.findByRole("button", { name: "Avisos" });
    await waitFor(() => expect(realtime).toHaveLength(1));
    expect(toast).not.toHaveBeenCalled();

    filas = [aviso({ id: "a2", tipo: "comunicado", titulo: "Nuevo comunicado de Recursos Humanos", cuerpo: "Horario de verano", enlace: "/noticias" }), ...filas];
    act(() => realtime[0].cb());

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: "Nuevo comunicado de Recursos Humanos", description: "Horario de verano" })
    );
    expect(await screen.findByRole("button", { name: "Avisos, 1 sin leer" })).toBeInTheDocument();
  });
});
