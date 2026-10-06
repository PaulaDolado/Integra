import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import type { NotaResumen } from "@/components/documentos/notas";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Documentos from "./Documentos";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock("@/hooks/useMiEmpleadoId", () => ({ useMiEmpleadoId: vi.fn() }));
vi.mock("@/hooks/useInvalidarEnCambios", () => ({ useInvalidarEnCambios: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const NUEVA = "22222222-2222-4222-8222-222222222222";

const nota = (datos: Partial<NotaResumen>): NotaResumen => ({
  id: "n1",
  titulo: "Acta de la reunión",
  formato: "rayas",
  extracto: "Asistentes: Ana y Luis",
  mi_rol: "propietario",
  propietario_id: "yo",
  propietario_nombre: "Ana López",
  colaboradores: 2,
  actualizado_por_nombre: "Ana López",
  created_at: "2026-10-01T09:00:00Z",
  updated_at: "2026-10-01T09:00:00Z",
  ...datos,
});

const NOTAS = [
  nota({}),
  nota({ id: "n2", titulo: "Ideas para la web", formato: "punteado", mi_rol: "editor", propietario_nombre: "Luis Pérez", colaboradores: 1 }),
  nota({ id: "n3", titulo: "Normativa", mi_rol: "lector", propietario_nombre: "Marta Ruiz" }),
];

function Destino() {
  const { id } = useParams();
  return <p>Editor de la nota {id}</p>;
}

const pintar = () =>
  renderConQuery(
    <MemoryRouter initialEntries={["/documentos"]}>
      <Routes>
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/documentos/:id" element={<Destino />} />
      </Routes>
    </MemoryRouter>
  );

describe("Gestión documental", () => {
  beforeEach(() => {
    vi.mocked(useMiEmpleadoId).mockReturnValue({ empleadoId: "yo", loading: false });
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({ mis_notas: NOTAS, crear_nota: NUEVA }) as never);
  });

  it("muestra cada nota como una hoja que abre el editor", async () => {
    pintar();
    const lista = await screen.findByRole("list", { name: "Notas" });
    const enlace = within(lista).getByRole("link", { name: /Acta de la reunión/ });
    expect(enlace).toHaveAttribute("href", "/documentos/n1");
    expect(within(lista).getByRole("link", { name: /Ideas para la web/ })).toHaveTextContent("Luis Pérez");
  });

  it("una página en blanco crea la nota y abre su editor", async () => {
    pintar();
    await userEvent.click(await screen.findByRole("button", { name: "Página en blanco" }));

    expect(await screen.findByText(`Editor de la nota ${NUEVA}`)).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith("crear_nota", {});
  });

  it("filtra las notas compartidas conmigo y busca por texto", async () => {
    pintar();
    await screen.findByRole("link", { name: /Acta de la reunión/ });

    await userEvent.click(screen.getByRole("radio", { name: "Compartidas conmigo" }));
    expect(screen.queryByRole("link", { name: /Acta de la reunión/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Normativa/ })).toBeInTheDocument();
    // Las compartidas no se crean desde aquí
    expect(screen.queryByRole("button", { name: "Página en blanco" })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Buscar notas" }), "marta");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("solo ofrece eliminar las propias; en las demás, dejar de colaborar", async () => {
    pintar();
    await userEvent.click(await screen.findByRole("button", { name: "Más opciones de Acta de la reunión" }));
    expect(await screen.findByRole("menuitem", { name: "Eliminar" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("button", { name: "Más opciones de Normativa" }));
    expect(await screen.findByRole("menuitem", { name: "Dejar de colaborar" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Eliminar" })).not.toBeInTheDocument();
  });

  it("no tiene problemas de accesibilidad", async () => {
    pintar();
    await screen.findByRole("link", { name: /Acta de la reunión/ });
    await expectSinViolaciones();
  });
});
