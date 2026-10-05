import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";
import { notificarError } from "@/lib/monitorizacion";

vi.mock("@/lib/monitorizacion", () => ({ notificarError: vi.fn() }));

let fallar: Error | null = null;
const Pagina = () => {
  if (fallar) throw fallar;
  return <p>Contenido</p>;
};

// React relanza al window los errores que captura; jsdom los escribiría en la consola
const silenciarErrorDeVentana = (evento: ErrorEvent) => evento.preventDefault();

describe("ErrorBoundary", () => {
  const recargar = vi.fn();

  beforeEach(() => {
    fallar = null;
    sessionStorage.clear();
    vi.mocked(notificarError).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.addEventListener("error", silenciarErrorDeVentana);
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload: recargar } });
  });

  afterEach(() => {
    recargar.mockReset();
    window.removeEventListener("error", silenciarErrorDeVentana);
  });

  it("muestra un aviso en vez de dejar la pantalla en blanco", () => {
    fallar = new Error("fallo al pintar");
    render(<ErrorBoundary><Pagina /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo ha fallado");
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
    expect(recargar).not.toHaveBeenCalled();
  });

  it("manda el error a la monitorización con el árbol de componentes", () => {
    fallar = new Error("fallo al pintar");
    render(<ErrorBoundary><Pagina /></ErrorBoundary>);
    expect(notificarError).toHaveBeenCalledWith(
      fallar,
      expect.objectContaining({ origen: "interfaz", componentStack: expect.stringContaining("Pagina") })
    );
  });

  it("vuelve a intentarlo al pulsar Reintentar", async () => {
    fallar = new Error("fallo puntual");
    render(<ErrorBoundary><Pagina /></ErrorBoundary>);
    fallar = null;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("olvida el error al cambiar de ruta", () => {
    fallar = new Error("fallo en una página");
    const { rerender } = render(<ErrorBoundary resetKey="/tareas"><Pagina /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fallar = null;
    rerender(<ErrorBoundary resetKey="/calendario"><Pagina /></ErrorBoundary>);
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });

  it("si falta un archivo de una versión anterior, recarga una sola vez", () => {
    fallar = new TypeError("Failed to fetch dynamically imported module: /assets/Tareas-abc123.js");
    const primero = render(<ErrorBoundary><Pagina /></ErrorBoundary>);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Hay una versión nueva de Integra");
    primero.unmount();

    // Si tras recargar vuelve a fallar enseguida, no entra en bucle
    expect(notificarError).not.toHaveBeenCalled();
    render(<ErrorBoundary><Pagina /></ErrorBoundary>);
    expect(recargar).toHaveBeenCalledTimes(1);
    // Si no se arregla recargando, sí se avisa
    expect(notificarError).toHaveBeenCalledTimes(1);
  });
});
