import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { usePermisos } from "@/hooks/usePermisos";
import { AppSidebar } from "./AppSidebar";

vi.mock("@/hooks/usePermisos", () => ({ usePermisos: vi.fn() }));

const conPermisos = (...permisos: string[]) =>
  vi.mocked(usePermisos).mockReturnValue({
    permisos: new Set(permisos),
    loading: false,
    tiene: (p: string) => permisos.includes(p),
  } as ReturnType<typeof usePermisos>);

const pintar = (ruta = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>
  );

describe("AppSidebar", () => {
  it("sin permisos no muestra la sección de gestión", () => {
    conPermisos();
    pintar();
    expect(screen.getByRole("link", { name: "Organigrama" })).toBeInTheDocument();
    expect(screen.queryByText("Gestión")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Datos de Pago" })).not.toBeInTheDocument();
  });

  it("muestra solo las pantallas de gestión que concede el departamento", () => {
    conPermisos("contactos_emergencia.ver");
    pintar();
    expect(screen.getByRole("link", { name: "Contactos de Emergencia" })).toHaveAttribute("href", "/gestion-contactos");
    expect(screen.queryByRole("link", { name: "Datos de Pago" })).not.toBeInTheDocument();
  });

  it("Finanzas ve los datos de pago", () => {
    conPermisos("datos_pago.ver");
    pintar();
    expect(screen.getByRole("link", { name: "Datos de Pago" })).toHaveAttribute("href", "/gestion-pagos");
    expect(screen.queryByRole("link", { name: "Contactos de Emergencia" })).not.toBeInTheDocument();
  });

  it("RRHH ve contactos y datos de pago dentro de Gestión de Empleados", () => {
    conPermisos("empleados.gestionar", "contactos_emergencia.ver", "contactos_emergencia.editar", "datos_pago.editar");
    pintar("/gestion-pagos");
    const gestion = screen.getByRole("link", { name: "Gestión de Empleados" }).closest("li")!;
    expect(within(gestion).getByRole("link", { name: "Contactos de Emergencia" })).toHaveAttribute("href", "/gestion-contactos");
    expect(within(gestion).getByRole("link", { name: "Datos de Pago" })).toHaveAttribute("aria-current", "page");
  });

  it("marca como activo el apartado actual, también en sus subrutas", () => {
    conPermisos();
    pintar("/tickets/123");
    expect(screen.getByRole("link", { name: "Tickets" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tareas" })).not.toHaveAttribute("aria-current");
  });
});
