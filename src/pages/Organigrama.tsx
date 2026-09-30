import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, User, Mail, Phone, Briefcase, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Empleado {
  id: string;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  correo_electronico: string;
  numero_telefono?: string;
  cargo_id?: string;
  departamento_id?: string;
}

interface Departamento {
  id: string;
  nombre: string;
  jefe_departamento_id?: string;
  empleados: Empleado[];
  cargo_jefe?: string;
}

interface PerfilEmpleado extends Empleado {
  cargo_nombre?: string;
  departamento_nombre?: string;
}

export default function Organigrama() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargos, setCargos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedEmpleado, setSelectedEmpleado] = useState<PerfilEmpleado | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchOrganigrama() {
      try {
        // Fetch all data
        const [deptosResult, empleadosResult, cargosResult] = await Promise.all([
          supabase.from("departamentos").select("*"),
          supabase.from("empleados").select("*"),
          supabase.from("cargos").select("*")
        ]);

        if (deptosResult.error || empleadosResult.error || cargosResult.error) {
          console.error("Error fetching data");
          return;
        }

        const cargosMap = (cargosResult.data || []).reduce((acc, cargo) => {
          acc[cargo.id] = cargo.nombre;
          return acc;
        }, {} as Record<string, string>);

        setCargos(cargosMap);
        setEmpleados(empleadosResult.data || []);

        // Group employees by department
        const deptosConEmpleados = (deptosResult.data || []).map(depto => {
          const empleadosDepto = (empleadosResult.data || []).filter(
            emp => emp.departamento_id === depto.id
          );
          
          const jefe = empleadosDepto.find(emp => emp.id === depto.jefe_departamento_id);
          
          return {
            ...depto,
            empleados: empleadosDepto,
            cargo_jefe: jefe?.cargo_id ? cargosMap[jefe.cargo_id] : undefined
          };
        });

        setDepartamentos(deptosConEmpleados);
      } catch (error) {
        console.error("Error fetching organigrama:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganigrama();
  }, []);

  const handleEmpleadoClick = async (empleado: Empleado) => {
    // Get department and cargo names
    const departamento = departamentos.find(d => d.id === empleado.departamento_id);
    const cargoNombre = empleado.cargo_id ? cargos[empleado.cargo_id] : undefined;

    setSelectedEmpleado({
      ...empleado,
      cargo_nombre: cargoNombre,
      departamento_nombre: departamento?.nombre
    });
    setDialogOpen(true);
  };

  const getInitials = (nombre: string, apellido: string) => {
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
  };

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Organigrama</h1>
        <p className="text-muted-foreground">
          Estructura organizacional de la empresa
        </p>
      </div>

      <div className="space-y-6">
        {departamentos.map((depto) => {
          const jefe = depto.empleados.find(emp => emp.id === depto.jefe_departamento_id);
          const subordinados = depto.empleados.filter(emp => emp.id !== depto.jefe_departamento_id);

          return (
            <Card key={depto.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <CardTitle>{depto.nombre}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {jefe && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Jefe de Departamento</p>
                    <div
                      onClick={() => handleEmpleadoClick(jefe)}
                      className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors border border-primary/20"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(jefe.nombre, jefe.primer_apellido)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">
                          {jefe.nombre} {jefe.primer_apellido} {jefe.segundo_apellido}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {jefe.cargo_id ? cargos[jefe.cargo_id] : "Sin cargo"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                )}

                {subordinados.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-px h-6 bg-border ml-6"></div>
                    </div>
                    <div className="pl-6 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Equipo</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subordinados.map((empleado) => (
                          <div
                            key={empleado.id}
                            onClick={() => handleEmpleadoClick(empleado)}
                            className="flex items-center gap-3 p-3 bg-card rounded-lg cursor-pointer hover:bg-accent/50 transition-colors border"
                          >
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {getInitials(empleado.nombre, empleado.primer_apellido)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {empleado.nombre} {empleado.primer_apellido}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {empleado.cargo_id ? cargos[empleado.cargo_id] : "Sin cargo"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Información del Empleado</DialogTitle>
          </DialogHeader>
          {selectedEmpleado && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                    {getInitials(selectedEmpleado.nombre, selectedEmpleado.primer_apellido)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">
                    {selectedEmpleado.nombre} {selectedEmpleado.primer_apellido} {selectedEmpleado.segundo_apellido}
                  </h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge>{selectedEmpleado.cargo_nombre || "Sin cargo"}</Badge>
                    {selectedEmpleado.departamento_nombre && (
                      <Badge variant="outline">{selectedEmpleado.departamento_nombre}</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedEmpleado.correo_electronico}</p>
                  </div>
                </div>

                {selectedEmpleado.numero_telefono && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Teléfono</p>
                      <p className="font-medium">{selectedEmpleado.numero_telefono}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Cargo</p>
                    <p className="font-medium">{selectedEmpleado.cargo_nombre || "No asignado"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Departamento</p>
                    <p className="font-medium">{selectedEmpleado.departamento_nombre || "No asignado"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {departamentos.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">No hay departamentos disponibles</p>
        </div>
      )}
    </div>
  );
}
