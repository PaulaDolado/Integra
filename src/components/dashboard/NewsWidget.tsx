import { Newspaper, Pin, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const news = [
  {
    id: 1,
    title: "Nueva política de trabajo remoto aprobada",
    summary: "A partir del próximo mes, se implementará la nueva política que permitirá trabajo híbrido 3 días presencial y 2 días remoto.",
    category: "Política",
    author: "Recursos Humanos",
    authorAvatar: "RH",
    publishedAt: "2024-01-15",
    isPinned: true,
    views: 156,
  },
  {
    id: 2,
    title: "Resultados del Q4 2023 superan expectativas",
    summary: "La empresa ha logrado un crecimiento del 15% en el último trimestre, superando los objetivos establecidos.",
    category: "Resultados",
    author: "Dirección General",
    authorAvatar: "DG",
    publishedAt: "2024-01-12",
    isPinned: false,
    views: 243,
  },
  {
    id: 3,
    title: "Nuevo programa de formación en IA",
    summary: "Se lanza el programa de capacitación en Inteligencia Artificial para todos los empleados del área técnica.",
    category: "Formación",
    author: "Desarrollo Profesional",
    authorAvatar: "DP",
    publishedAt: "2024-01-10",
    isPinned: false,
    views: 89,
  },
  {
    id: 4,
    title: "Celebración aniversario empresa - 25 años",
    summary: "El próximo mes celebraremos 25 años de trayectoria. Habrá evento especial para todos los empleados.",
    category: "Eventos",
    author: "Comunicación Interna",
    authorAvatar: "CI",
    publishedAt: "2024-01-08",
    isPinned: true,
    views: 312,
  },
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case "Política":
      return "default";
    case "Resultados":
      return "secondary";
    case "Formación":
      return "outline";
    case "Eventos":
      return "destructive";
    default:
      return "secondary";
  }
};

export function NewsWidget() {
  const pinnedNews = news.filter(item => item.isPinned);
  const regularNews = news.filter(item => !item.isPinned);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          Noticias y Comunicados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Noticias destacadas */}
        {pinnedNews.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Pin className="w-3 h-3" />
              Destacadas
            </h4>
            {pinnedNews.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-lg bg-accent/30 border border-accent hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold text-foreground leading-tight">
                      {item.title}
                    </h4>
                    <Badge variant={getCategoryColor(item.category)} className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src="" alt={item.author} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {item.authorAvatar}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {item.author}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" />
                      {item.views}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Noticias regulares */}
        <div className="space-y-3">
          {pinnedNews.length > 0 && (
            <h4 className="text-sm font-medium text-muted-foreground">
              Recientes
            </h4>
          )}
          {regularNews.slice(0, 2).map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-foreground leading-tight">
                    {item.title}
                  </h4>
                  <Badge variant={getCategoryColor(item.category)} className="text-xs">
                    {item.category}
                  </Badge>
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.summary}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src="" alt={item.author} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {item.authorAvatar}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.publishedAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    {item.views}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="pt-2 border-t border-border">
          <button className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors">
            Ver todas las noticias →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}