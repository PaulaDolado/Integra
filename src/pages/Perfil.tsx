import { useState, useEffect } from "react";
import { User, Edit, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Perfil() {
  const { profile, loading, getFullName, getDisplayName } = useEmployeeProfile();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    primer_apellido: "",
    segundo_apellido: "",
    correo_electronico: "",
    numero_telefono: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        nombre: profile.nombre || "",
        primer_apellido: profile.primer_apellido || "",
        segundo_apellido: profile.segundo_apellido || "",
        correo_electronico: profile.correo_electronico || "",
        numero_telefono: profile.numero_telefono || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.id) return;

    if (!formData.nombre.trim() || !formData.primer_apellido.trim()) {
      toast.error("El nombre y primer apellido son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("empleados")
        .update({
          nombre: formData.nombre.trim(),
          primer_apellido: formData.primer_apellido.trim(),
          segundo_apellido: formData.segundo_apellido.trim(),
          correo_electronico: formData.correo_electronico.trim(),
          numero_telefono: formData.numero_telefono.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Perfil actualizado correctamente");
      setEditDialogOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

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
        <Button className="gap-2" onClick={() => setEditDialogOpen(true)}>
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

      {/* Dialog de Edición de Perfil */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ingresa tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primer_apellido">Primer Apellido *</Label>
              <Input
                id="primer_apellido"
                value={formData.primer_apellido}
                onChange={(e) => setFormData({ ...formData, primer_apellido: e.target.value })}
                placeholder="Ingresa tu primer apellido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segundo_apellido">Segundo Apellido</Label>
              <Input
                id="segundo_apellido"
                value={formData.segundo_apellido}
                onChange={(e) => setFormData({ ...formData, segundo_apellido: e.target.value })}
                placeholder="Ingresa tu segundo apellido"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correo_electronico">Correo Electrónico</Label>
              <Input
                id="correo_electronico"
                type="email"
                value={formData.correo_electronico}
                onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero_telefono">Número de Teléfono</Label>
              <Input
                id="numero_telefono"
                value={formData.numero_telefono}
                onChange={(e) => setFormData({ ...formData, numero_telefono: e.target.value })}
                placeholder="+52 123 456 7890"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}