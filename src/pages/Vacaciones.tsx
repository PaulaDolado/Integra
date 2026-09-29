import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Loader2, Plus, Filter, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AbsenceRequest {
  id: string;
  tipo_ausencia: string;
  razon_especifica: string | null;
  justificante_path: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  created_at: string;
}

const TIPOS_AUSENCIA = [
  { value: "vacaciones", label: "Vacaciones" },
  { value: "compensacion_dias_trabajados", label: "Compensación de días trabajados" },
  { value: "asunto_familiar", label: "Asunto familiar" },
  { value: "asunto_personal", label: "Asunto personal" },
  { value: "permisos", label: "Permisos" },
  { value: "teletrabajo", label: "Teletrabajo" },
  { value: "visita_medica", label: "Visita médica" },
  { value: "cuidado_hijos", label: "Cuidado de hijos" },
];

// Razones específicas por tipo de ausencia; se irán añadiendo para el resto de tipos
const RAZONES_ESPECIFICAS: Record<string, { value: string; label: string }[]> = {
  compensacion_dias_trabajados: [
    { value: "descanso_horas_extras", label: "Descanso por horas extras" },
    { value: "descanso_festivo_trabajado", label: "Descanso por festivo trabajado" },
  ],
};

const JUSTIFICANTE_MAX_BYTES = 5 * 1024 * 1024;
const JUSTIFICANTE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.doc,.docx";

const getTipoLabel = (value: string) =>
  TIPOS_AUSENCIA.find((t) => t.value === value)?.label ?? value;

const getRazonLabel = (tipo: string, value: string) =>
  RAZONES_ESPECIFICAS[tipo]?.find((r) => r.value === value)?.label ?? value;

const emptyForm = {
  tipo_ausencia: "",
  razon_especifica: "",
  fecha_inicio: "",
  fecha_fin: "",
};

export default function Vacaciones() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);

  const [formData, setFormData] = useState(emptyForm);
  const [justificante, setJustificante] = useState<File | null>(null);

  const razonesDisponibles = RAZONES_ESPECIFICAS[formData.tipo_ausencia] ?? [];

  useEffect(() => {
    if (user) {
      fetchEmpleadoId();
    }
  }, [user]);

  useEffect(() => {
    if (empleadoId) {
      fetchRequests();
    }
  }, [empleadoId, filterStatus]);

  const fetchEmpleadoId = async () => {
    try {
      const { data, error } = await supabase
        .from("empleados")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setEmpleadoId(data.id);
    } catch (error) {
      console.error("Error fetching empleado:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener la información del empleado",
        variant: "destructive",
      });
    }
  };

  const fetchRequests = async () => {
    if (!empleadoId) return;

    try {
      setLoading(true);
      let query = supabase
        .from("solicitudes_vacacion")
        .select("*")
        .eq("empleado_id", empleadoId)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("estado", filterStatus as "pendiente" | "aprobada" | "rechazada");
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las solicitudes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setJustificante(null);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetForm();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > JUSTIFICANTE_MAX_BYTES) {
      toast({
        title: "Archivo demasiado grande",
        description: "El justificante no puede superar los 5 MB",
        variant: "destructive",
      });
      e.target.value = "";
      setJustificante(null);
      return;
    }
    setJustificante(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleadoId || !user) return;

    if (!formData.tipo_ausencia) {
      toast({
        title: "Error",
        description: "Selecciona el tipo de ausencia",
        variant: "destructive",
      });
      return;
    }

    if (razonesDisponibles.length > 0 && !formData.razon_especifica) {
      toast({
        title: "Error",
        description: "Selecciona la razón específica",
        variant: "destructive",
      });
      return;
    }

    const startDate = new Date(formData.fecha_inicio);
    const endDate = new Date(formData.fecha_fin);

    if (endDate < startDate) {
      toast({
        title: "Error",
        description: "La fecha de fin debe ser posterior a la fecha de inicio",
        variant: "destructive",
      });
      return;
    }

    let justificantePath: string | null = null;

    try {
      setSubmitting(true);

      if (justificante) {
        const safeName = justificante.name.replace(/[^\w.-]/g, "_");
        justificantePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("justificantes")
          .upload(justificantePath, justificante);

        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("solicitudes_vacacion").insert({
        empleado_id: empleadoId,
        tipo_ausencia: formData.tipo_ausencia,
        razon_especifica: formData.razon_especifica || null,
        justificante_path: justificantePath,
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
        estado: "pendiente",
      });

      if (error) {
        if (justificantePath) {
          await supabase.storage.from("justificantes").remove([justificantePath]);
        }
        throw error;
      }

      toast({
        title: "Solicitud enviada",
        description: "Tu solicitud de ausencia ha sido enviada correctamente",
      });

      resetForm();
      setDialogOpen(false);
      fetchRequests();
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar la solicitud",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openJustificante = async (path: string) => {
    const { data, error } = await supabase.storage
      .from("justificantes")
      .createSignedUrl(path, 60);

    if (error || !data) {
      toast({
        title: "Error",
        description: "No se pudo abrir el justificante",
        variant: "destructive",
      });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">Pendiente</Badge>;
      case "aprobada":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Aprobada</Badge>;
      case "rechazada":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">Rechazada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Solicitud de Ausencia</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus solicitudes de ausencia
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Solicitud
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Nueva Solicitud de Ausencia</DialogTitle>
              <DialogDescription>
                Completa el formulario para solicitar una ausencia
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_ausencia">Tipo de ausencia</Label>
                <Select
                  value={formData.tipo_ausencia}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipo_ausencia: value, razon_especifica: "" })
                  }
                >
                  <SelectTrigger id="tipo_ausencia">
                    <SelectValue placeholder="Selecciona el tipo de ausencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_AUSENCIA.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {razonesDisponibles.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="razon_especifica">Razón específica</Label>
                  <Select
                    value={formData.razon_especifica}
                    onValueChange={(value) =>
                      setFormData({ ...formData, razon_especifica: value })
                    }
                  >
                    <SelectTrigger id="razon_especifica">
                      <SelectValue placeholder="Selecciona la razón específica" />
                    </SelectTrigger>
                    <SelectContent>
                      {razonesDisponibles.map((razon) => (
                        <SelectItem key={razon.value} value={razon.value}>
                          {razon.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de Inicio</Label>
                <Input
                  id="fecha_inicio"
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_inicio: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha de Fin</Label>
                <Input
                  id="fecha_fin"
                  type="date"
                  value={formData.fecha_fin}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha_fin: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="justificante">Importa el justificante (opcional)</Label>
                <Input
                  id="justificante"
                  type="file"
                  accept={JUSTIFICANTE_ACCEPT}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  Un documento a la vez. PDF, imagen o Word, máximo 5 MB.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogChange(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar Solicitud
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mis Solicitudes</CardTitle>
              <CardDescription>Historial de solicitudes de ausencia</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="aprobada">Aprobadas</SelectItem>
                  <SelectItem value="rechazada">Rechazadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No hay solicitudes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <div className="font-semibold">
                          {getTipoLabel(request.tipo_ausencia)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(request.fecha_inicio), "dd 'de' MMMM", { locale: es })} -{" "}
                          {format(new Date(request.fecha_fin), "dd 'de' MMMM yyyy", { locale: es })}
                          {" · "}
                          {calculateDays(request.fecha_inicio, request.fecha_fin)} día(s)
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(request.estado)}
                  </div>
                  {request.razon_especifica && (
                    <div className="mt-2 text-sm text-muted-foreground pl-8">
                      <span className="font-medium">Razón específica:</span>{" "}
                      {getRazonLabel(request.tipo_ausencia, request.razon_especifica)}
                    </div>
                  )}
                  {request.motivo && (
                    <div className="mt-2 text-sm text-muted-foreground pl-8">
                      <span className="font-medium">Motivo:</span> {request.motivo}
                    </div>
                  )}
                  {request.justificante_path && (
                    <div className="mt-2 pl-8">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-sm"
                        onClick={() => openJustificante(request.justificante_path!)}
                      >
                        <Paperclip className="w-3 h-3 mr-1" />
                        Ver justificante
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 text-xs text-muted-foreground pl-8">
                    Solicitado el {format(new Date(request.created_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
