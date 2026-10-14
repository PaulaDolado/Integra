import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { renderConQuery } from "@/test/render";
import { expectSinViolaciones } from "@/test/accesibilidad";
import Fichajes from "./Fichajes";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/hooks/useEmployeeProfile", () => ({
  useEmployeeProfile: () => ({ profile: { id: "e1" }, loading: false }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Ayer a una hora concreta, en hora local
const ayer = (hora: string) => {
  const [h, m, s] = hora.split(":").map(Number);
  const fecha = subDays(new Date(), 1);
  fecha.setHours(h, m, s, 0);
  return fecha.toISOString();
};

let n = 0;
const fichaje = (tipo: "entrada" | "salida", fechaHora: string, extra: Record<string, unknown> = {}) => ({
  id: `f${++n}`,
  empleado_id: "e1",
  tipo,
  fecha_hora: fechaHora,
  es_manual: false,
  anulado: false,
  fecha_hora_original: null,
  justificacion: null,
  ...extra,
});

let fichajes: ReturnType<typeof fichaje>[] = [];
const filtros = vi.fn();

function simularTabla() {
  vi.mocked(supabase.from).mockImplementation((() => {
    const consulta = {
      select: () => consulta,
      eq: () => consulta,
      gte: (columna: string, valor: string) => {
        filtros(columna, valor);
        return consulta;
      },
      order: () => consulta,
      // Como la consulta real: del más reciente al más antiguo
      then: (ok: (r: unknown) => unknown) =>
        Promise.resolve({ data: [...fichajes].sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora)), error: null }).then(ok),
    };
    return consulta;
  }) as never);
}

const diaDeAyer = () => format(subDays(new Date(), 1), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });

describe("Registro de fichajes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fichajes = [];
    simularTabla();
  });

  it("muestra cada tramo del día, el descanso y el total con minutos y segundos", async () => {
    fichajes = [
      fichaje("entrada", ayer("08:59:30")),
      fichaje("salida", ayer("11:59:30")),
      fichaje("entrada", ayer("12:58:15")),
      fichaje("salida", ayer("17:58:20")),
    ];
    renderConQuery(<Fichajes />);

    const dia = await screen.findByRole("region", { name: diaDeAyer() });
    const tramos = within(dia).getAllByRole("listitem");
    expect(tramos[0]).toHaveTextContent("08:59:30");
    expect(tramos[0]).toHaveTextContent("3 h 00 min 00 s");
    expect(tramos[1]).toHaveTextContent("Descanso de 0 h 58 min 45 s");
    expect(tramos[1]).toHaveTextContent("5 h 00 min 05 s");
    expect(dia).toHaveTextContent("Total: 8 h 00 min 05 s");
  });

  it("marca el tramo incompleto y no lo suma", async () => {
    fichajes = [fichaje("entrada", ayer("09:00:00")), fichaje("salida", ayer("13:00:00")), fichaje("entrada", ayer("14:00:00"))];
    renderConQuery(<Fichajes />);

    const dia = await screen.findByRole("region", { name: diaDeAyer() });
    expect(dia).toHaveTextContent("Falta la salida");
    expect(dia).toHaveTextContent("Total: 4 h 00 min 00 s");
  });

  it("los fichajes anulados se ven en su día pero no cuentan", async () => {
    fichajes = [
      fichaje("entrada", ayer("09:00:00")),
      fichaje("salida", ayer("10:00:00"), { anulado: true, justificacion: "Fichó por error" }),
      fichaje("salida", ayer("14:00:00")),
    ];
    renderConQuery(<Fichajes />);

    const dia = await screen.findByRole("region", { name: diaDeAyer() });
    expect(dia).toHaveTextContent("Total: 5 h 00 min 00 s");
    expect(dia).toHaveTextContent("Salida de las 10:00:00 anulada por RRHH · «Fichó por error»");
  });

  it("indica qué tramos ha corregido RRHH y por qué", async () => {
    fichajes = [
      fichaje("entrada", ayer("09:00:00")),
      fichaje("salida", ayer("17:00:00"), { es_manual: true, justificacion: "Olvidó fichar" }),
    ];
    renderConQuery(<Fichajes />);

    const dia = await screen.findByRole("region", { name: diaDeAyer() });
    expect(dia).toHaveTextContent("Corregido por RRHH · «Olvidó fichar»");
  });

  it("pide los días completos del historial, no un número de registros", async () => {
    renderConQuery(<Fichajes />);
    await screen.findByText("No hay fichajes registrados");
    expect(filtros).toHaveBeenCalledWith("fecha_hora", expect.any(String));
  });

  it("no tiene problemas de accesibilidad", async () => {
    fichajes = [fichaje("entrada", ayer("09:00:00")), fichaje("salida", ayer("14:00:00"))];
    renderConQuery(<Fichajes />);
    await screen.findByRole("region", { name: diaDeAyer() });
    await expectSinViolaciones();
  });
});
