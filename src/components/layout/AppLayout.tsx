import { useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
}

const ID_CONTENIDO = "contenido";

export function AppLayout({ children }: AppLayoutProps) {
  const principal = useRef<HTMLElement>(null);

  // El foco se mueve a mano: con BrowserRouter, cambiar el hash de la URL no
  // basta en todos los navegadores para que el siguiente Tab siga desde <main>
  const saltarAlContenido = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    principal.current?.focus();
  };

  return (
    <SidebarProvider>
      {/* Primer elemento enfocable: permite saltarse el menú lateral y la barra superior */}
      <a
        href={`#${ID_CONTENIDO}`}
        onClick={saltarAlContenido}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AppHeader />
          {/* tabIndex -1 para recibir el foco del enlace de salto; no es un control,
              así que no se le pinta el anillo de foco */}
          <main id={ID_CONTENIDO} ref={principal} tabIndex={-1} className="flex-1 overflow-auto focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
