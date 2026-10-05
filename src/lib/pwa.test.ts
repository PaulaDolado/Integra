import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerSW, type RegisterSWOptions } from "virtual:pwa-register";
import { toast } from "sonner";
import { registrarServiceWorker } from "./pwa";

// El módulo virtual solo existe con vite-plugin-pwa, que los tests no cargan
vi.mock("virtual:pwa-register", () => ({ registerSW: vi.fn() }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const actualizar = vi.fn(async () => {});

// Opciones con las que se llamó a registerSW
const opciones = () => vi.mocked(registerSW).mock.calls[0][0] as RegisterSWOptions;

describe("registrarServiceWorker", () => {
  beforeEach(() => {
    vi.mocked(registerSW).mockReturnValue(actualizar);
    Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
  });

  afterEach(() => {
    // jsdom no tiene service worker: se deja como estaba
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });

  it("no hace nada si el navegador no admite service workers", () => {
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    registrarServiceWorker();
    expect(registerSW).not.toHaveBeenCalled();
  });

  it("con una versión nueva avisa y no recarga hasta que se pulsa Actualizar", () => {
    registrarServiceWorker();
    opciones().onNeedRefresh!();

    expect(toast).toHaveBeenCalledWith(
      "Hay una versión nueva de Integra",
      expect.objectContaining({ duration: Infinity }),
    );
    expect(actualizar).not.toHaveBeenCalled();

    const { action } = vi.mocked(toast).mock.calls[0][1] as { action: { label: string; onClick: () => void } };
    expect(action.label).toBe("Actualizar");
    action.onClick();
    expect(actualizar).toHaveBeenCalledWith(true);
  });

  it("comprueba cada hora si hay versión nueva", () => {
    vi.useFakeTimers();
    try {
      const update = vi.fn(async () => {});
      registrarServiceWorker();
      opciones().onRegisteredSW!("sw.js", { update } as unknown as ServiceWorkerRegistration);

      vi.advanceTimersByTime(59 * 60 * 1000);
      expect(update).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60 * 1000);
      expect(update).toHaveBeenCalledTimes(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
