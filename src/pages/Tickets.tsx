import { useState, useEffect } from "react";
import { Ticket, Plus, Filter, Search, AlertCircle, Clock, CheckCircle } from "lucide-react";
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

  const groupedTickets = {
    abierto: filteredTickets.filter(t => t.estado === "abierto"),
    en_progreso: filteredTickets.filter(t => t.estado === "en_progreso"),
    cerrado: filteredTickets.filter(t => t.estado === "cerrado"),
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Ticket className="w-8 h-8 text-primary" />
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
        <div className="grid md:grid-cols-3 gap-6">
          {/* Abiertos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Abiertos ({groupedTickets.abierto.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedTickets.abierto.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tickets abiertos
                </p>
              ) : (
                groupedTickets.abierto.map((ticket) => {
                  const statusConfig = getStatusConfig(ticket.estado);
                  const priorityConfig = getPriorityConfig(ticket.prioridad);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={ticket.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
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
                          {new Date(ticket.fecha_creacion).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* En Progreso */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-warning" />
                En Progreso ({groupedTickets.en_progreso.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedTickets.en_progreso.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tickets en progreso
                </p>
              ) : (
                groupedTickets.en_progreso.map((ticket) => {
                  const statusConfig = getStatusConfig(ticket.estado);
                  const priorityConfig = getPriorityConfig(ticket.prioridad);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={ticket.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
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
                          {new Date(ticket.fecha_creacion).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Cerrados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle className="w-5 h-5 text-success" />
                Cerrados ({groupedTickets.cerrado.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {groupedTickets.cerrado.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay tickets cerrados
                </p>
              ) : (
                groupedTickets.cerrado.map((ticket) => {
                  const statusConfig = getStatusConfig(ticket.estado);
                  const priorityConfig = getPriorityConfig(ticket.prioridad);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={ticket.id} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors opacity-75">
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
                          Cerrado: {ticket.fecha_cierre ? new Date(ticket.fecha_cierre).toLocaleDateString("es-ES") : 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}