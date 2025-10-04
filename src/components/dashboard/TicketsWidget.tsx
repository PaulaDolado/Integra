import { useState, useEffect } from "react";
import { Ticket, Plus, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

const getPriorityConfig = (priority: string): { color: "default" | "destructive" | "outline" | "secondary"; label: string } => {
  switch (priority) {
    case "urgente":
      return { color: "destructive", label: "Urgente" };
    case "alta":
      return { color: "destructive", label: "Alta" };
    case "media":
      return { color: "secondary", label: "Media" };
    default:
      return { color: "outline", label: "Baja" };
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

export function TicketsWidget() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState<{
    titulo: string;
    descripcion: string;
    prioridad: 'alta' | 'baja' | 'media' | 'urgente';
  }>({
    titulo: '',
    descripcion: '',
    prioridad: 'media'
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchTickets();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('tickets-changes')
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
      // First get the employee profile
      const { data: employeeData, error: empError } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (empError || !employeeData) {
        console.error('Error fetching employee:', empError);
        setTickets([]);
        setLoading(false);
        return;
      }

      // Get tickets created by or assigned to this employee
      const { data, error } = await supabase
        .from('tickets')
        .select('id, titulo, descripcion, prioridad, estado, fecha_creacion')
        .or(`autor_id.eq.${employeeData.id},asignado_a_id.eq.${employeeData.id}`)
        .order('fecha_creacion', { ascending: false })
        .limit(10);

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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    try {
      const { data: employeeData } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!employeeData) return;

      const { error } = await supabase
        .from('tickets')
        .insert([
          {
            titulo: ticketForm.titulo,
            descripcion: ticketForm.descripcion,
            prioridad: ticketForm.prioridad,
            autor_id: employeeData.id,
            estado: 'abierto'
          }
        ]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear el ticket",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ticket creado",
          description: "El ticket se ha creado exitosamente",
        });
        setIsCreateOpen(false);
        setTicketForm({ titulo: '', descripcion: '', prioridad: 'media' });
        fetchTickets();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
    }
  };

  const ticketCounts = {
    open: tickets.filter(t => t.estado === "abierto").length,
    inProgress: tickets.filter(t => t.estado === "en_progreso").length,
    resolved: tickets.filter(t => t.estado === "cerrado").length
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          Mis Tickets
        </CardTitle>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Nuevo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={ticketForm.titulo}
                  onChange={(e) => setTicketForm({ ...ticketForm, titulo: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  value={ticketForm.descripcion}
                  onChange={(e) => setTicketForm({ ...ticketForm, descripcion: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prioridad">Prioridad</Label>
                <Select value={ticketForm.prioridad} onValueChange={(value) => setTicketForm({ ...ticketForm, prioridad: value as 'alta' | 'baja' | 'media' | 'urgente' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Crear</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : (
          <>
            {/* Resumen de estados */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                <div className="text-base font-bold text-destructive">{ticketCounts.open}</div>
                <div className="text-xs text-destructive">Abiertos</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-orange-50 border border-orange-200">
                <div className="text-base font-bold text-warning">{ticketCounts.inProgress}</div>
                <div className="text-xs text-warning">En Progreso</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-green-50 border border-green-200">
                <div className="text-base font-bold text-success">{ticketCounts.resolved}</div>
                <div className="text-xs text-success">Cerrados</div>
              </div>
            </div>

            {/* Lista de tickets */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Tickets Recientes</h4>
              {tickets.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Ticket className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No tienes tickets</p>
                </div>
              ) : (
                 tickets.slice(0, 2).map((ticket) => {
                  const statusConfig = getStatusConfig(ticket.estado);
                  const priorityConfig = getPriorityConfig(ticket.prioridad);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div
                      key={ticket.id}
                      className="p-2 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
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
                        
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{statusConfig.label}</span>
                          <span>{new Date(ticket.fecha_creacion).toLocaleDateString("es-ES")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="pt-2 border-t border-border">
              <button className="text-sm text-primary hover:text-primary-hover font-medium w-full text-center p-2 rounded-md hover:bg-accent/50 transition-colors">
                Ver todos los tickets →
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}