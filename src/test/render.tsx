import type { ReactElement, ReactNode } from "react";
import { render, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Cliente nuevo en cada test, sin reintentos para que los fallos se vean al momento
export const crearClienteDePrueba = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

export function conQuery(cliente = crearClienteDePrueba()) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

// render() de Testing Library con un QueryClientProvider alrededor
export const renderConQuery = (ui: ReactElement, cliente = crearClienteDePrueba()) =>
  render(ui, { wrapper: conQuery(cliente) });

export const renderHookConQuery = <T,>(hook: () => T, cliente = crearClienteDePrueba()) =>
  renderHook(hook, { wrapper: conQuery(cliente) });
