import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { Link, useNavigate } from "react-router";
import { getArea } from "@/components/noticias/areas";

export function NewsWidget() {
  const navigate = useNavigate();

  const { data: news = [], isPending: loading } = useQuery({
    queryKey: ["anuncios", "recientes"],
    queryFn: async () =>
      comprobar(
        await supabase
          .from("anuncios")
          .select("id, titulo, contenido, fecha_publicacion, autor_id, area")
          .order("fecha_publicacion", { ascending: false })
          .limit(3)
      ) ?? [],
  });

  useInvalidarEnCambios("news-changes", [{ table: "anuncios" }], [["anuncios"]]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Noticias Recientes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-4">
            No hay noticias disponibles
          </p>
        ) : (
          news.map((item) => (
            <Link
              key={item.id}
              to="/noticias"
              className="block p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground leading-tight">
                  {item.titulo}
                </h3>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.contenido}
                </p>
                
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getArea(item.area).etiqueta}`}>
                    {getArea(item.area).label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.fecha_publicacion).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
        
        <div className="pt-2 border-t border-border">
          <button 
            onClick={() => navigate("/noticias")}
            className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors"
          >
            Ver el tablón de anuncios →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
