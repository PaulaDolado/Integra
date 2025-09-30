import { User, Edit, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function Perfil() {
  const { profile, loading, getFullName, getDisplayName } = useEmployeeProfile();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getInitials = () => {
    if (profile) {
      return `${profile.nombre.charAt(0)}${profile.primer_apellido.charAt(0)}`;
    }
    return "U";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <User className="w-8 h-8 text-primary" />
            Mi Perfil
          </h1>
          <p className="text-muted-foreground">
            Gestiona tu información personal y configuraciones.
          </p>
        </div>
        <Button className="gap-2">
          <Edit className="w-4 h-4" />
          Editar Perfil
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src="/placeholder-avatar.jpg" alt={getFullName()} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground">{getFullName()}</h3>
                <p className="text-muted-foreground">{profile?.cargo_nombre || 'Empleado'}</p>
                <Badge variant="secondary" className="mt-2">
                  {profile?.departamento_nombre || 'Sin departamento'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.correo_electronico || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{profile?.numero_telefono || 'No disponible'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Cargo</p>
                  <p className="font-medium">{profile?.cargo_nombre || 'No asignado'}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Departamento</p>
                  <p className="font-medium">{profile?.departamento_nombre || 'No asignado'}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium mb-2">Información del Perfil</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nombre Completo:</span>
                  <span className="ml-2 font-medium">{getFullName()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ID Empleado:</span>
                  <span className="ml-2 font-medium">{profile?.id?.slice(0, 8) || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo:</span>
                  <span className="ml-2 font-medium">{profile?.cargo_nombre || 'No asignado'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Departamento:</span>
                  <span className="ml-2 font-medium">{profile?.departamento_nombre || 'No asignado'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}