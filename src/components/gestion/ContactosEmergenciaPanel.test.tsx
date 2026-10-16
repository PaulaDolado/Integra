import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { renderConQuery } from "@/test/render";
import { ContactosEmergenciaPanel } from "./ContactosEmergenciaPanel";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));

let contactos: Record<string, unknown>[] = [];
// Escrituras: insert(...), update(...).eq(), delete().eq()
const eq = vi.fn(async () => ({ error: null }));
const insert = vi.fn(async () => ({ error: null }));
const update = vi.fn(() => ({ eq }));
const borrar = vi.fn(() => ({ eq }));

function simularTabla() {
  vi.mocked(supabase.from).mockImplementation((() => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      order: async () => ({ data: contactos, error: null }),
      insert,
      update,
      delete: borrar,
    };
    return consulta;
  }) as never);
}

describe("Contactos de emergencia en la ficha del empleado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contactos = [{ id: "c1", empleado_id: "e1", nombre: "Ana Gómez", relacion: "Madre", telefono: "600111222", created_at: "2026-09-01T10:00:00Z" }];
    simularTabla();
  });

  it("corrige el teléfono de un contacto", async () => {
    renderConQuery(<ContactosEmergenciaPanel empleadoId="e1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Editar a Ana Gómez" }));
    const telefono = screen.getByLabelText("Teléfono *");
    await userEvent.clear(telefono);
    await userEvent.type(telefono, "699000111");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ nombre: "Ana Gómez", relacion: "Madre", telefono: "699000111" }));
    expect(eq).toHaveBeenCalledWith("id", "c1");
  });

  it("añade un contacto a quien no tiene ninguno", async () => {
    contactos = [];
    renderConQuery(<ContactosEmergenciaPanel empleadoId="e2" />);
    expect(await screen.findByText("No tiene ningún contacto de emergencia.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Añadir contacto" }));
    await userEvent.type(screen.getByLabelText("Nombre *"), "Marta Sanz");
    await userEvent.type(screen.getByLabelText("Teléfono *"), "611222333");
    await userEvent.click(screen.getByRole("button", { name: "Añadir" }));

    await waitFor(() =>
      expect(insert).toHaveBeenCalledWith({ nombre: "Marta Sanz", relacion: null, telefono: "611222333", empleado_id: "e2" })
    );
  });

  it("borra un contacto", async () => {
    renderConQuery(<ContactosEmergenciaPanel empleadoId="e1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar a Ana Gómez" }));
    await waitFor(() => expect(eq).toHaveBeenCalledWith("id", "c1"));
    expect(borrar).toHaveBeenCalled();
  });
});
