import { Ticket, Plus, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const tickets = [
  {
    id: "TK-1247",
    title: "Error en el módulo de autenticación",
    description: "Los usuarios no pueden acceder después del último update",
    priority: "urgent",
    status: "open",
    assignedTo: "Equipo Desarrollo",
    createdAt: "2024-01-15",
    category: "Bug"
  },
  {
    id: "TK-1246",
    title: "Solicitud nuevo acceso VPN",
    description: "Necesito acceso VPN para trabajar desde casa",
    priority: "medium",
    status: "in-progress", 
    assignedTo: "IT Support",
    createdAt: "2024-01-14",
    category: "Acceso"
  },
  {
    id: "TK-1245",
    title: "Actualización software diseño",
    description: "Solicitud de actualización a Adobe Creative Suite 2024",
    priority: "low",
    status: "resolved",
    assignedTo: "IT Support",
    createdAt: "2024-01-12",
    category: "Software"
  },
  {
    id: "TK-1244",
    title: "Problema con impresora oficina",
    description: "La impresora de la planta 2 no está funcionando correctamente",
    priority: "medium",
    status: "open",
    assignedTo: "Mantenimiento",
    createdAt: "2024-01-10",
    category: "Hardware"
  }
];

const getPriorityConfig = (priority: string): { color: "default" | "destructive" | "outline" | "secondary"; label: string } => {
  switch (priority) {
    case "urgent":
      return { color: "destructive", label: "Urgente" };
    case "high":
      return { color: "destructive", label: "Alta" };
    case "medium":
      return { color: "secondary", label: "Media" };
    default:
      return { color: "outline", label: "Baja" };
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "open":
      return {
        icon: AlertCircle,
        color: "text-destructive",
        bgColor: "bg-red-50",
        label: "Abierto"
      };
    case "in-progress":
      return {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-orange-50",
        label: "En Progreso"
      };
    case "resolved":
      return {
        icon: CheckCircle,
        color: "text-success",
        bgColor: "bg-green-50",
        label: "Resuelto"
      };
    default:
      return {
        icon: AlertCircle,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        label: "Desconocido"
      };
  }
};

export function TicketsWidget() {
  const myTickets = tickets.filter(ticket => 
    ticket.assignedTo === "Equipo Desarrollo" || ticket.createdAt === "2024-01-15"
  );

  const ticketCounts = {
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          Mis Tickets
        </CardTitle>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Ticket
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de estados */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="text-lg font-bold text-destructive">{ticketCounts.open}</div>
            <div className="text-xs text-destructive">Abiertos</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="text-lg font-bold text-warning">{ticketCounts.inProgress}</div>
            <div className="text-xs text-warning">En Progreso</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="text-lg font-bold text-success">{ticketCounts.resolved}</div>
            <div className="text-xs text-success">Resueltos</div>
          </div>
        </div>

        {/* Lista de tickets */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Tickets Recientes</h4>
          {myTickets.slice(0, 3).map((ticket) => {
            const statusConfig = getStatusConfig(ticket.status);
            const priorityConfig = getPriorityConfig(ticket.priority);
            const StatusIcon = statusConfig.icon;
            
            return (
              <div
                key={ticket.id}
                className="p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded-full ${statusConfig.bgColor}`}>
                        <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {ticket.id}
                      </span>
                    </div>
                    <Badge variant={priorityConfig.color} className="text-xs">
                      {priorityConfig.label}
                    </Badge>
                  </div>
                  
                  <h4 className="text-sm font-medium text-foreground leading-tight">
                    {ticket.title}
                  </h4>
                  
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {ticket.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Asignado a: {ticket.assignedTo}</span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString("es-ES")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="pt-2 border-t border-border">
          <button className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors">
            Ver todos los tickets →
          </button>
        </div>
      </CardContent>
    </Card>
  );
}