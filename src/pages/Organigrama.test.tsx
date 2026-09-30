import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { simularRpc } from "@/test/supabase-mock";
import Organigrama from "./Organigrama";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const PERSONAS = [
  { id: "1", nombre: "Laura Gómez", cargo: "Directora de RRHH", departamento_id: "rrhh", departamento: "Recursos Humanos", es_responsable: true },
  { id: "2", nombre: "Marta Ruiz", cargo: "Técnica de selección", departamento_id: "rrhh", departamento: "Recursos Humanos", es_responsable: false },
  { id: "3", nombre: "Pablo Sanz", cargo: null, departamento_id: "fin", departamento: "Finanzas", es_responsable: false },
];

describe("Organigrama", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockImplementation(simularRpc({ organigrama: PERSONAS }) as never);
  });

  it("carga los datos solo de la función organigrama, nunca de la tabla empleados", async () => {
    render(<Organigrama />);
    await screen.findByText("Laura Gómez");
    expect(supabase.rpc).toHaveBeenCalledWith("organigrama");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("agrupa por departamento con nombre y puesto", async () => {
    render(<Organigrama />);
    const rrhh = (await screen.findByText("Recursos Humanos")).closest("div:has(ul)") as HTMLElement;
    expect(within(rrhh).getByText("Laura Gómez")).toBeInTheDocument();
    expect(within(rrhh).getByText("Marta Ruiz")).toBeInTheDocument();
    expect(within(rrhh).queryByText("Pablo Sanz")).not.toBeInTheDocument();
    expect(screen.getByText("Responsable · Directora de RRHH")).toBeInTheDocument();
    expect(screen.getByText("Sin puesto asignado")).toBeInTheDocument();
    expect(screen.getByText("2 personas")).toBeInTheDocument();
    expect(screen.getByText("1 persona")).toBeInTheDocument();
  });

  it("no muestra enlaces de correo ni de teléfono", async () => {
    const { container } = render(<Organigrama />);
    await screen.findByText("Laura Gómez");
    expect(container.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filtra por nombre, puesto o departamento", async () => {
    render(<Organigrama />);
    await screen.findByText("Laura Gómez");
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), "finanzas");
    expect(screen.getByText("Pablo Sanz")).toBeInTheDocument();
    expect(screen.queryByText("Laura Gómez")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(/buscar/i));
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), "zzz");
    expect(screen.getByText("No hay personas que coincidan")).toBeInTheDocument();
  });
});
