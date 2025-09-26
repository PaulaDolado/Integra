import { User, Edit, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Perfil() {
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
                <AvatarImage src="/placeholder-avatar.jpg" alt="Ana García" />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">AG</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-foreground">Ana García</h3>
                <p className="text-muted-foreground">Desarrolladora Frontend</p>
                <Badge variant="secondary" className="mt-2">Departamento IT</Badge>
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
                  <p className="font-medium">ana.garcia@empresa.com</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">+34 612 345 678</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-medium">Madrid, España</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Ingreso</p>
                  <p className="font-medium">15 de Marzo, 2021</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium mb-2">Información Laboral</h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">ID Empleado:</span>
                  <span className="ml-2 font-medium">EMP-2021-0145</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Supervisor:</span>
                  <span className="ml-2 font-medium">Carlos Martínez</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Horario:</span>
                  <span className="ml-2 font-medium">09:00 - 18:00</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Modalidad:</span>
                  <span className="ml-2 font-medium">Híbrido</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}