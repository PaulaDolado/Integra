import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router";
import { AuthProvider } from "./contexts/AuthContext";
import { PresenceProvider } from "./contexts/PresenceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { ROUTER_BASENAME } from "@/lib/app-url";
import { queryClient } from "@/lib/query-client";

// Cada página se descarga la primera vez que se visita
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Tareas = lazy(() => import("./pages/Tareas"));
const Comunicacion = lazy(() => import("./pages/Comunicacion"));
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetalle = lazy(() => import("./pages/TicketDetalle"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Noticias = lazy(() => import("./pages/Noticias"));
const Organigrama = lazy(() => import("./pages/Organigrama"));
const Fichajes = lazy(() => import("./pages/Fichajes"));
const Contrasenas = lazy(() => import("./pages/Contrasenas"));
const Vacaciones = lazy(() => import("./pages/Vacaciones"));
const BandejaAusencias = lazy(() => import("./pages/BandejaAusencias"));
const CambioTurno = lazy(() => import("./pages/CambioTurno"));
const BandejaTurnos = lazy(() => import("./pages/BandejaTurnos"));
const GestionEmpleados = lazy(() => import("./pages/GestionEmpleados"));
const GestionFichajes = lazy(() => import("./pages/GestionFichajes"));
const GestionContactosEmergencia = lazy(() => import("./pages/GestionContactosEmergencia"));
const GestionDatosPago = lazy(() => import("./pages/GestionDatosPago"));
const GoogleCallback = lazy(() => import("./pages/GoogleCallback"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Cargando = ({ pantallaCompleta = false }: { pantallaCompleta?: boolean }) => (
  <div className={`${pantallaCompleta ? "min-h-screen" : "py-24"} flex items-center justify-center`}>
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const EnDesarrollo = ({ titulo }: { titulo: string }) => (
  <div className="p-6">
    <h1 className="text-2xl font-bold">{titulo}</h1>
    <p className="text-muted-foreground">En desarrollo</p>
  </div>
);

// Sesión obligatoria, menú lateral y cabecera; la página cambia dentro de <main>.
// Si una página falla, el menú sigue funcionando y al navegar se olvida el error.
const ZonaPrivada = () => {
  const { pathname } = useLocation();
  return (
    <ProtectedRoute>
      <AppLayout>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Cargando />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </AppLayout>
    </ProtectedRoute>
  );
};

const App = () => (
  <ErrorBoundary pantallaCompleta>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <PresenceProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <Suspense fallback={<Cargando pantallaCompleta />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Pública: la enlaza la pantalla de permisos de Google */}
              <Route path="/privacidad" element={<Privacidad />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route element={<ZonaPrivada />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/google-callback" element={<GoogleCallback />} />
                <Route path="/tareas" element={<Tareas />} />
                <Route path="/comunicacion" element={<Comunicacion />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:id" element={<TicketDetalle />} />
                <Route path="/documentos" element={<EnDesarrollo titulo="Gestión Documental" />} />
                <Route path="/noticias" element={<Noticias />} />
                <Route path="/organigrama" element={<Organigrama />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/configuracion" element={<Configuracion />} />
                <Route path="/fichajes" element={<Fichajes />} />
                <Route path="/contrasenas" element={<Contrasenas />} />
                <Route path="/cursos" element={<EnDesarrollo titulo="Inscripción a Cursos" />} />
                <Route path="/vacaciones" element={<Vacaciones />} />
                <Route path="/cambio-turno" element={<CambioTurno />} />

                {/* Pantallas de gestión: el menú solo las muestra con el permiso del departamento */}
                <Route path="/gestion-tickets" element={<Tickets vista="todos" />} />
                <Route path="/gestion-contactos" element={<GestionContactosEmergencia />} />
                <Route path="/gestion-pagos" element={<GestionDatosPago />} />
                <Route path="/gestion-fichajes" element={<GestionFichajes />} />
                <Route path="/gestion-empleados" element={<GestionEmpleados />} />
                <Route path="/bandeja-ausencias" element={<BandejaAusencias />} />
                <Route path="/bandeja-turnos" element={<BandejaTurnos />} />
              </Route>

              {/* Las rutas nuevas van encima de esta */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </PresenceProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
