import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// findBy y waitFor esperan 1 s por defecto: con toda la batería en paralelo a
// veces no basta y el test falla de forma intermitente
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = "";
});

// jsdom no implementa matchMedia (lo usan el tema y el hook de móvil)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom tampoco implementa lo que usan los Select de Radix para abrirse y
// desplazarse, ni las URL de objeto de las miniaturas de imágenes
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
URL.createObjectURL ??= () => "blob:miniatura";
URL.revokeObjectURL ??= () => {};
