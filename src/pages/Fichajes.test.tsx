import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Fichajes from "./Fichajes";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/hooks/useEmployeeProfile", () => ({ useEmployeeProfile: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const FICHAJES = [
  { id: "f2", empleado_id: "e1", tipo: "salida", fecha_hora: "2026-10-05T15:00:00Z", es_manual: true, anulado: false, fecha_hora_original: null, justificacion: "Olvidó fichar" },
  { id: "f1", empleado_id: "e1", tipo: "entrada", fecha_hora: "2026-10-05T07:00:00Z", es_manual: false, anulado: false, fecha_hora_original: null, justificacion: null },
];

function simularTabla() {
  vi.mocked(supabase.from).mockImplementation((() => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      order: () => consulta,
      limit: () => consulta,
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: FICHAJES, error: null }).then(ok),
    };
    return consulta;
  }) as never);
}

describe("Registro de fichajes", () => {
  it("no tiene problemas de accesibilidad", async () => {
    vi.mocked(useEmployeeProfile).mockReturnValue({ profile: { id: "e1" }, loading: false } as ReturnType<typeof useEmployeeProfile>);
    simularTabla();
    renderConQuery(<Fichajes />);

    expect(await screen.findByText("Añadido por RRHH")).toBeInTheDocument();
    await expectSinViolaciones();
  });
});
