import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            {/* En pantallas muy anchas el contenido no se estira de lado a lado */}
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}