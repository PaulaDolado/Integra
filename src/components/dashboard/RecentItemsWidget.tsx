import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useAvisarError } from "@/hooks/useAvisarError";
import { tituloNota } from "@/components/documentos/notas";

const MAX_RECIENTES = 4;

const haceCuanto = (fecha: string) => formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es });

// Últimas notas de Gestión Documental que ha abierto el usuario
export function RecentItemsWidget() {
  const { data: notas = [], isPending: loading, error } = useQuery({
    queryKey: ["notas", "recientes"],
    queryFn: async () => comprobar(await supabase.rpc("notas_recientes", { p_limite: MAX_RECIENTES })) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar las notas recientes");

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Abierto Recientemente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : notas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-4">
            Todavía no has abierto ninguna nota de Gestión Documental.
          </p>
        ) : (
          <ul className="space-y-1">
            {notas.map((nota) => (
              <li key={nota.id}>
                <Link
                  to={`/documentos/${nota.id}`}
                  className="flex items-start gap-3 p-2 rounded-lg border border-transparent transition-colors hover:bg-accent/50 hover:border-border focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="p-2 rounded-full bg-accent/50 text-blue-600 dark:text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-sm font-medium text-foreground leading-tight truncate">{tituloNota(nota.titulo)}</h3>
                    {nota.extracto && <p className="text-xs text-muted-foreground line-clamp-2">{nota.extracto}</p>}
                    <p className="text-xs text-muted-foreground">
                      Abierta {haceCuanto(nota.abierta_at)}
                      {nota.mi_rol !== "propietario" && ` · de ${nota.propietario_nombre}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-2 border-t border-border">
          <Link
            to="/documentos"
            className="block text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors"
          >
            Ir a Gestión Documental →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
