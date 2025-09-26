import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Calendario from "./pages/Calendario";
import Tareas from "./pages/Tareas";
import Comunicacion from "./pages/Comunicacion";
import Tickets from "./pages/Tickets";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/tareas" element={<Tareas />} />
            <Route path="/comunicacion" element={<Comunicacion />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/documentos" element={<div className="p-6"><h1 className="text-2xl font-bold">Gestión Documental</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            <Route path="/noticias" element={<div className="p-6"><h1 className="text-2xl font-bold">Centro de Noticias</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            <Route path="/organigrama" element={<div className="p-6"><h1 className="text-2xl font-bold">Organigrama</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/cursos" element={<div className="p-6"><h1 className="text-2xl font-bold">Inscripción a Cursos</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            <Route path="/vacaciones" element={<div className="p-6"><h1 className="text-2xl font-bold">Solicitud de Vacaciones</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            <Route path="/cambio-turno" element={<div className="p-6"><h1 className="text-2xl font-bold">Cambio de Turno</h1><p className="text-muted-foreground">En desarrollo</p></div>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
