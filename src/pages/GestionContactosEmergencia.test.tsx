import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import GestionContactosEmergencia from "./GestionContactosEmergencia";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

// Escrituras en contactos_emergencia: insert(...) y update(...).eq() / delete().eq()
const eq = vi.fn(async () => ({ error: null }));
const tabla = {
  insert: vi.fn(async () => ({ error: null })),
  update: vi.fn(() => ({ eq })),
  delete: vi.fn(() => ({ eq })),
};

const fila = { departamento: "Operaciones", telefono_empleado: null };

describe("Contactos de emergencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockReturnValue(tabla as never);
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({
        contactos_emergencia_plantilla: [
          { ...fila, empleado_id: "e1", empleado: "Laura Gómez", contacto_id: "c1", contacto: "Ana Gómez", relacion: "Madre", telefono: "600111222" },
          { ...fila, empleado_id: "e2", empleado: "Pablo Sanz", contacto_id: null, contacto: null, relacion: null, telefono: null },
        ],
      }) as never
    );
  });

  it("quien solo puede consultar no ve el botón de editar", async () => {
    conPermisos("contactos_emergencia.ver");
    renderConQuery(<GestionContactosEmergencia />);
    await screen.findByText("Ana Gómez");
    expect(screen.queryByRole("button", { name: /Editar los contactos/ })).not.toBeInTheDocument();
  });

  it("RRHH corrige el teléfono de un contacto", async () => {
    conPermisos("contactos_emergencia.ver", "contactos_emergencia.editar");
    renderConQuery(<GestionContactosEmergencia />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar los contactos de Laura Gómez" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Editar a Ana Gómez" }));
    const telefono = within(dialogo).getByLabelText("Teléfono *");
    await userEvent.clear(telefono);
    await userEvent.type(telefono, "699000111");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(tabla.update).toHaveBeenCalledWith({ nombre: "Ana Gómez", relacion: "Madre", telefono: "699000111" }));
    expect(eq).toHaveBeenCalledWith("id", "c1");
  });

  it("RRHH añade un contacto a quien no tiene ninguno", async () => {
    conPermisos("contactos_emergencia.editar");
    renderConQuery(<GestionContactosEmergencia />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar los contactos de Pablo Sanz" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Añadir contacto" }));
    await userEvent.type(within(dialogo).getByLabelText("Nombre *"), "Marta Sanz");
    await userEvent.type(within(dialogo).getByLabelText("Teléfono *"), "611222333");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Añadir" }));

    await waitFor(() =>
      expect(tabla.insert).toHaveBeenCalledWith({ nombre: "Marta Sanz", relacion: null, telefono: "611222333", empleado_id: "e2" })
    );
  });
});
