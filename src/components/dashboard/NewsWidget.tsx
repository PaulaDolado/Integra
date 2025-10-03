import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Anuncio {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: string;
  autor_id: string | null;
}

export function NewsWidget() {
  const [news, setNews] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    const { data, error } = await supabase
      .from("anuncios")
      .select("id, titulo, contenido, fecha_publicacion, autor_id")
      .order("fecha_publicacion", { ascending: false })
      .limit(3);

    if (!error && data) {
      setNews(data);
    }
    setLoading(false);
  };

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
            <div
              key={item.id}
              className="p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border"
              onClick={() => navigate("/noticias")}
            >
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground leading-tight">
                  {item.titulo}
                </h4>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.contenido}
                </p>
                
                <div className="flex items-center gap-2">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src="" alt="Autor" />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      A
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.fecha_publicacion).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
        
        <div className="pt-2 border-t border-border">
          <button 
            onClick={() => navigate("/noticias")}
            className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors"
          >
            Ver todas las noticias →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
