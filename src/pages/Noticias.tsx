import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Anuncio {
  id: string;
  titulo: string;
  contenido: string;
  fecha_publicacion: string;
  autor_id: string | null;
}

export default function Noticias() {
  const [noticias, setNoticias] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNoticias() {
      try {
        const { data, error } = await supabase
          .from("anuncios")
          .select("*")
          .order("fecha_publicacion", { ascending: false });

        if (error) {
          console.error("Error fetching noticias:", error);
        } else {
          setNoticias(data || []);
        }
      } catch (error) {
        console.error("Error fetching noticias:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNoticias();

    // Setup realtime subscription
    const channel = supabase
      .channel('noticias-page-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'anuncios'
        },
        () => {
          fetchNoticias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Centro de Noticias</h1>
        <p className="text-muted-foreground">
          Últimas noticias y anuncios de la empresa
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {noticias.map((noticia) => (
          <Card key={noticia.id} className="hover:shadow-lg transition-shadow cursor-pointer overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Calendar className="w-16 h-16 text-primary/40" />
            </div>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="secondary">Anuncio</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(noticia.fecha_publicacion), "dd MMM yyyy", { locale: es })}
                </span>
              </div>
              <CardTitle className="line-clamp-2">{noticia.titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="line-clamp-3 mb-4">
                {noticia.contenido}
              </CardDescription>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs">
                    <User className="w-3 h-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">Administración</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {noticias.length === 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No hay noticias disponibles</p>
        </div>
      )}
    </div>
  );
}
