import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { PresenceProvider } from "./contexts/PresenceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Calendario from "./pages/Calendario";
import Tareas from "./pages/Tareas";
import Comunicacion from "./pages/Comunicacion";
import Tickets from "./pages/Tickets";
import Perfil from "./pages/Perfil";
import Noticias from "./pages/Noticias";
import Organigrama from "./pages/Organigrama";
import Fichajes from "./pages/Fichajes";
import Vacaciones from "./pages/Vacaciones";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PresenceProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/calendario" element={
              <ProtectedRoute>
                <AppLayout>
                  <Calendario />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/tareas" element={
              <ProtectedRoute>
                <AppLayout>
                  <Tareas />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/comunicacion" element={
              <ProtectedRoute>
                <AppLayout>
                  <Comunicacion />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/tickets" element={
              <ProtectedRoute>
                <AppLayout>
                  <Tickets />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/documentos" element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="p-6"><h1 className="text-2xl font-bold">Gestión Documental</h1><p className="text-muted-foreground">En desarrollo</p></div>
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/noticias" element={
              <ProtectedRoute>
                <AppLayout>
                  <Noticias />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/organigrama" element={
              <ProtectedRoute>
                <AppLayout>
                  <Organigrama />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/perfil" element={
              <ProtectedRoute>
                <AppLayout>
                  <Perfil />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/fichajes" element={
              <ProtectedRoute>
                <AppLayout>
                  <Fichajes />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/cursos" element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="p-6"><h1 className="text-2xl font-bold">Inscripción a Cursos</h1><p className="text-muted-foreground">En desarrollo</p></div>
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/vacaciones" element={
              <ProtectedRoute>
                <AppLayout>
                  <Vacaciones />
                </AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/cambio-turno" element={
              <ProtectedRoute>
                <AppLayout>
                  <div className="p-6"><h1 className="text-2xl font-bold">Cambio de Turno</h1><p className="text-muted-foreground">En desarrollo</p></div>
                </AppLayout>
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </PresenceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
