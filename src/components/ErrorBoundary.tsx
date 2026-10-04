import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CLAVE_RECARGA = "integra:recarga-por-version";
const MARGEN_RECARGA_MS = 10_000;

// Tras publicar una versión nueva, los archivos de las páginas cambian de nombre
// y los antiguos dejan de existir: quien tenga la app abierta no puede cargarlos
const esErrorDeVersion = (error: Error) =>
  /dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(
    `${error.name} ${error.message}`
  );

// Recarga una sola vez para traer la versión nueva; si vuelve a fallar enseguida,
// no entra en bucle y se muestra el aviso
function recargarPorVersion() {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0);
    if (Date.now() - ultima < MARGEN_RECARGA_MS) return false;
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  pantallaCompleta?: boolean;
  // Al cambiar (por ejemplo, la ruta), se olvida el error y se vuelve a pintar
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Si un componente falla al pintarse, muestra un aviso en vez de dejar la pantalla en blanco
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error al pintar la interfaz:", error, info.componentStack);
    if (esErrorDeVersion(error)) recargarPorVersion();
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reintentar = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const deVersion = esErrorDeVersion(error);
    return (
      <div
        role="alert"
        className={`${this.props.pantallaCompleta ? "min-h-screen bg-background" : "py-24"} flex items-center justify-center p-6`}
      >
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">
              {deVersion ? "Hay una versión nueva de Integra" : "Algo ha fallado"}
            </h1>
            <p className="text-muted-foreground">
              {deVersion
                ? "Recarga la página para seguir usando la aplicación."
                : "No se ha podido mostrar esta pantalla. Prueba otra vez o recarga la página."}
            </p>
          </div>
          <div className="flex justify-center gap-2">
            {!deVersion && (
              <Button variant="outline" onClick={this.reintentar}>
                Reintentar
              </Button>
            )}
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
