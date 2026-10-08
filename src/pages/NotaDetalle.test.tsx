import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import NotaDetalle from "./NotaDetalle";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), removeChannel: vi.fn(), storage: { from: vi.fn() } },
}));
vi.mock("@/hooks/useEmployeeProfile", () => ({ useEmployeeProfile: vi.fn() }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const NOTA = "33333333-3333-4333-8333-333333333333";
const META = { id: NOTA, titulo: "Acta de la reunión", formato: "rayas", propietario_id: "e-ana" };

function simularServidor(rol: string) {
  vi.mocked(supabase.rpc).mockImplementation(
    simularRpc({
      rol_en_nota: rol,
      abrir_nota: [{ ...META, estado: "", estado_hasta: 0, mi_rol: rol }],
      actualizar_nota: null,
      guardar_cambios_nota: 1,
      registrar_apertura_nota: null,
    }) as never
  );
  vi.mocked(supabase.from).mockImplementation(((tabla: string) => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      gt: () => consulta,
      or: () => consulta,
      order: () => consulta,
      limit: () => consulta,
      maybeSingle: async () => ({ data: tabla === "notas" ? { ...META, estado_hasta: 0 } : null, error: null }),
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok),
    };
    return consulta;
  }) as never);
  vi.mocked(supabase.channel).mockImplementation((() => {
    const canal = {
      on: () => canal,
      subscribe: (cb: (s: string) => void) => {
        queueMicrotask(() => cb("SUBSCRIBED"));
        return canal;
      },
      send: async () => "ok",
    };
    return canal;
  }) as never);
  vi.mocked(supabase.removeChannel).mockResolvedValue("ok" as never);
}

const pintar = () =>
  renderConQuery(
    <MemoryRouter initialEntries={[`/documentos/${NOTA}`]}>
      <Routes>
        <Route path="/documentos/:id" element={<NotaDetalle />} />
      </Routes>
    </MemoryRouter>
  );

describe("Editor de notas", () => {
  beforeEach(() => {
    vi.mocked(useEmployeeProfile).mockReturnValue({
      profile: { id: "e-ana", nombre: "Ana", primer_apellido: "López" },
      loading: false,
      getDisplayName: () => "Ana López",
    } as unknown as ReturnType<typeof useEmployeeProfile>);
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: "e-ana", loading: false });
  });

  it("abre el editor aunque no llegue el perfil del empleado", async () => {
    simularServidor("propietario");
    vi.mocked(useEmployeeProfile).mockReturnValue({
      profile: null,
      loading: false,
      getDisplayName: () => "demo",
    } as unknown as ReturnType<typeof useEmployeeProfile>);
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: null, loading: false });
    pintar();

    const contenido = await screen.findByRole("textbox", { name: "Contenido de la nota" });
    expect(contenido).toHaveAttribute("contenteditable", "true");
  });

  it("registra la apertura para «Abierto recientemente» del dashboard", async () => {
    simularServidor("lector");
    pintar();
    await screen.findByRole("textbox", { name: "Contenido de la nota" });
    expect(supabase.rpc).toHaveBeenCalledWith("registrar_apertura_nota", { p_nota: NOTA });
  });

  it("quien puede editar ve la barra de formato y elige el fondo de la hoja", async () => {
    simularServidor("propietario");
    pintar();

    expect(await screen.findByRole("toolbar", { name: "Formato del texto" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Título de la nota" })).toHaveValue("Acta de la reunión");
    expect(screen.getByRole("button", { name: "Ecuación" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcador" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Punteado" }));
    expect(supabase.rpc).toHaveBeenCalledWith("actualizar_nota", { p_nota: NOTA, p_formato: "punteado" });
  });

  it("quien solo puede leer no ve la barra ni puede escribir", async () => {
    simularServidor("lector");
    pintar();

    const contenido = await screen.findByRole("textbox", { name: "Contenido de la nota" });
    expect(contenido).toHaveAttribute("contenteditable", "false");
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Formato de la hoja" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Acta de la reunión" })).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
  });

  it("si la nota ya no está compartida contigo, lo explica", async () => {
    simularServidor("lector");
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({ rol_en_nota: null }) as never);
    pintar();

    expect(await screen.findByRole("heading", { name: "No puedes abrir esta nota" })).toBeInTheDocument();
    // No aparece en «Abierto recientemente»
    expect(supabase.rpc).not.toHaveBeenCalledWith("registrar_apertura_nota", expect.anything());
  });

  it("no tiene problemas de accesibilidad", async () => {
    simularServidor("editor");
    pintar();
    await screen.findByRole("toolbar", { name: "Formato del texto" });
    await expectSinViolaciones();
  });
});
