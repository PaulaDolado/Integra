import { FileText, MessageSquare, Ticket, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const recentItems = [
  {
    id: 1,
    type: "document",
    title: "Manual de Procedimientos Q4",
    description: "Actualizado por Recursos Humanos",
    timestamp: "hace 2 horas",
    author: "María López",
    authorAvatar: "ML",
  },
  {
    id: 2,
    type: "message",
    title: "Nuevo mensaje en Desarrollo",
    description: "Carlos: ¿Podemos revisar el PR antes del viernes?",
    timestamp: "hace 4 horas",
    author: "Carlos Ruiz",
    authorAvatar: "CR",
  },
  {
    id: 3,
    type: "ticket",
    title: "Ticket #1247 - Error en login",
    description: "Asignado a tu equipo",
    timestamp: "hace 6 horas",
    author: "Sistema",
    authorAvatar: "S",
    status: "urgent",
  },
  {
    id: 4,
    type: "document",
    title: "Informe Mensual Enero",
    description: "Compartido contigo",
    timestamp: "ayer",
    author: "Ana García",
    authorAvatar: "AG",
  },
];

const getItemIcon = (type: string) => {
  switch (type) {
    case "document":
      return FileText;
    case "message":
      return MessageSquare;
    case "ticket":
      return Ticket;
    default:
      return Clock;
  }
};

const getItemColor = (type: string) => {
  switch (type) {
    case "document":
      return "text-blue-600";
    case "message":
      return "text-green-600";
    case "ticket":
      return "text-orange-600";
    default:
      return "text-gray-600";
  }
};

export function RecentItemsWidget() {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Abierto Recientemente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentItems.slice(0, 3).map((item) => {
          const Icon = getItemIcon(item.type);
          
          return (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors border border-transparent hover:border-border"
            >
              <div className={`p-2 rounded-full bg-accent/50 ${getItemColor(item.type)}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-foreground leading-tight">
                    {item.title}
                  </h4>
                  {item.status === "urgent" && (
                    <Badge variant="destructive" className="text-xs">
                      Urgente
                    </Badge>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
                
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src="" alt={item.author} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {item.authorAvatar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-foreground">
                    {item.author} • {item.timestamp}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t border-border">
          <button className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors">
            Ver todo el historial →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}