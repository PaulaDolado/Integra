import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { supabase } from "@/integrations/supabase/client";
import { usePermisos } from "@/hooks/usePermisos";
import { simularRpc } from "@/test/supabase-mock";
import { renderConQuery } from "@/test/render";
import GestionDatosPago from "./GestionDatosPago";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// IBAN ficticio de ejemplo (no es de nadie)
const IBAN = "ES9121000418450200051332";
const ENMASCARADO = "ES" + "•".repeat(IBAN.length - 6) + "1332";

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

describe("Datos de pago", () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockImplementation(
      simularRpc({
        datos_pago_plantilla: [
          { empleado_id: "e1", empleado: "Laura Gómez", departamento: "RRHH", forma_pago: "transferencia", iban_enmascarado: ENMASCARADO, actualizado: "2026-09-01T10:00:00Z" },
          { empleado_id: "e2", empleado: "Pablo Sanz", departamento: "Finanzas", forma_pago: null, iban_enmascarado: null, actualizado: null },
        ],
        accesos_datos_pago_recientes: [],
        ver_iban: IBAN,
      }) as never
    );
  });

  it("sin el permiso no consulta nada y muestra el aviso", () => {
    conPermisos();
    renderConQuery(<GestionDatosPago />);
    expect(screen.getByText("No tienes acceso a los datos de pago")).toBeInTheDocument();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("muestra el IBAN enmascarado y marca a quien no tiene", async () => {
    conPermisos("datos_pago.ver");
    renderConQuery(<GestionDatosPago />);
    expect(await screen.findByText("ES•• •••• •••• •••• •••• 1332")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("2100");
    expect(screen.getByText("Sin IBAN")).toBeInTheDocument();
    // El IBAN completo nunca se pide solo al cargar: cada consulta queda auditada
    expect(supabase.rpc).not.toHaveBeenCalledWith("ver_iban", expect.anything());
  });

  it("pide el IBAN completo al pulsar Mostrar y lo vuelve a ocultar", async () => {
    conPermisos("datos_pago.ver");
    renderConQuery(<GestionDatosPago />);
    await userEvent.click(await screen.findByRole("button", { name: "Mostrar IBAN completo" }));

    expect(supabase.rpc).toHaveBeenCalledWith("ver_iban", { p_empleado: "e1" });
    expect(await screen.findByText("ES91 2100 0418 4502 0005 1332")).toBeInTheDocument();
    // Se recarga el historial para que aparezca la consulta
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.filter(([n]) => n === "accesos_datos_pago_recientes")).toHaveLength(2));

    await userEvent.click(screen.getByRole("button", { name: "Ocultar IBAN" }));
    expect(screen.queryByText("ES91 2100 0418 4502 0005 1332")).not.toBeInTheDocument();
  });
});
