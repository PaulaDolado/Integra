import { useState, useEffect } from "react";
import { Ticket, Plus, Filter, Search, AlertCircle, Clock, CheckCircle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TicketData {
  id: string;
  titulo: string;
  descripcion: string;
  prioridad: string;
  estado: string;
  fecha_creacion: string;
  fecha_cierre: string | null;
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "urgente":
      return { color: "destructive" as const, label: "Urgente" };
    case "alta":
      return { color: "destructive" as const, label: "Alta" };
    case "media":
      return { color: "secondary" as const, label: "Media" };
    default:
      return { color: "outline" as const, label: "Baja" };
  }
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "abierto":
      return {
        icon: AlertCircle,
        color: "text-destructive",
        bgColor: "bg-red-50",
        label: "Abierto"
      };
    case "en_progreso":
      return {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-orange-50",
        label: "En Progreso"
      };
    case "resuelto":
      return {
        icon: CircleCheck,
        color: "text-primary",
        bgColor: "bg-blue-50",
        label: "Resuelto"
      };
    case "cerrado":
      return {
        icon: CheckCircle,
        color: "text-success",
        bgColor: "bg-green-50",
        label: "Cerrado"
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

const COLUMNS: { status: string; title: string; empty: string; icon: typeof Clock; iconClass: string }[] = [
  { status: "abierto", title: "Abiertos", empty: "No hay tickets abiertos", icon: AlertCircle, iconClass: "text-destructive" },
  { status: "en_progreso", title: "En Progreso", empty: "No hay tickets en progreso", icon: Clock, iconClass: "text-warning" },
  { status: "resuelto", title: "Resueltos", empty: "No hay tickets resueltos", icon: CircleCheck, iconClass: "text-primary" },
  { status: "cerrado", title: "Cerrados", empty: "No hay tickets cerrados", icon: CheckCircle, iconClass: "text-success" },
];

export default function Tickets() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('tickets-page-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      const { data: employeeData, error: empError } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empError || !employeeData) {
        console.error('Error fetching employee:', empError);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .or(`autor_id.eq.${employeeData.id},asignado_a_id.eq.${employeeData.id}`)
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los tickets",
          variant: "destructive",
        });
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Ticket className="w-6 h-6 text-primary" />
            Sistema de Tickets
          </h1>
          <p className="text-muted-foreground">
            Gestiona solicitudes de soporte y reportes de incidencias.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Ticket
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tickets..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(({ status, title, empty, icon: ColumnIcon, iconClass }) => {
            const columnTickets = filteredTickets.filter(t => t.estado === status);
            const isFinished = status === "resuelto" || status === "cerrado";

            return (
              <Card key={status}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ColumnIcon className={`w-5 h-5 ${iconClass}`} />
                    {title} ({columnTickets.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {columnTickets.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {empty}
                    </p>
                  ) : (
                    columnTickets.map((ticket) => {
                      const statusConfig = getStatusConfig(ticket.estado);
                      const priorityConfig = getPriorityConfig(ticket.prioridad);
                      const StatusIcon = statusConfig.icon;

                      return (
                        <div
                          key={ticket.id}
                          className={`p-3 border rounded-lg hover:bg-accent/50 transition-colors ${
                            status === "cerrado" ? "opacity-75" : ""
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div className={`p-1 rounded-full ${statusConfig.bgColor}`}>
                                  <StatusIcon className={`w-3 h-3 ${statusConfig.color}`} />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  {ticket.id.slice(0, 8)}
                                </span>
                              </div>
                              <Badge variant={priorityConfig.color} className="text-xs">
                                {priorityConfig.label}
                              </Badge>
                            </div>

                            <h4 className="text-sm font-medium text-foreground leading-tight">
                              {ticket.titulo}
                            </h4>

                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ticket.descripcion}
                            </p>

                            <p className="text-xs text-muted-foreground">
                              {isFinished && ticket.fecha_cierre
                                ? `${statusConfig.label}: ${new Date(ticket.fecha_cierre).toLocaleDateString("es-ES")}`
                                : new Date(ticket.fecha_creacion).toLocaleDateString("es-ES")}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}