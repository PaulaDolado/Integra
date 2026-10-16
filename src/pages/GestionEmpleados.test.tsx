import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import GestionEmpleados from "./GestionEmpleados";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

const EMPLEADO = {
  id: "e1",
  nombre: "Laura",
  primer_apellido: "Gómez",
  segundo_apellido: "",
  correo_electronico: "laura@empresa.es",
  numero_telefono: null,
  cargo_id: null,
  cargo: null,
  departamento_id: null,
  departamento: null,
  fecha_ingreso: "2024-01-15",
  activo: true,
  es_admin: false,
  tiene_cuenta: true,
  es_yo: false,
};

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

describe("Gestión de empleados: ficha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({ gestion_empleados: [EMPLEADO], datos_pago_plantilla: [] }) as never
    );
    // cargos, departamentos y contactos de emergencia: listas vacías
    vi.mocked(supabase.from).mockImplementation((() => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: async () => ({ data: [], error: null }),
      };
      return consulta;
    }) as never);
  });

  it("al editar, RRHH ve a la derecha los contactos de emergencia y los datos de pago", async () => {
    conPermisos("empleados.gestionar", "contactos_emergencia.editar", "datos_pago.editar");
    renderConQuery(<GestionEmpleados />);
    await userEvent.click(await screen.findByRole("button", { name: /Editar a Laura Gómez/ }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText("Nombre *")).toHaveValue("Laura");
    expect(await within(dialogo).findByRole("region", { name: "Contactos de emergencia" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("region", { name: "Datos de pago" })).toBeInTheDocument();
  });

  it("al dar de alta no aparecen: la ficha aún no existe", async () => {
    conPermisos("empleados.gestionar", "contactos_emergencia.editar", "datos_pago.editar");
    renderConQuery(<GestionEmpleados />);
    await userEvent.click(await screen.findByRole("button", { name: "Nuevo empleado" }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).queryByRole("region", { name: "Contactos de emergencia" })).not.toBeInTheDocument();
    expect(within(dialogo).queryByRole("region", { name: "Datos de pago" })).not.toBeInTheDocument();
  });

  it("sin los permisos de editar, la ficha no muestra esos apartados", async () => {
    conPermisos("empleados.gestionar");
    renderConQuery(<GestionEmpleados />);
    await userEvent.click(await screen.findByRole("button", { name: /Editar a Laura Gómez/ }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).queryByRole("region", { name: "Contactos de emergencia" })).not.toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalledWith("datos_pago_plantilla");
  });
});
