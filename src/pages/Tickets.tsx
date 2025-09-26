import { Ticket, Plus, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function Tickets() {
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
        <div className="flex-1">
          <Input placeholder="Buscar tickets..." className="pl-10" />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        </div>
        <Button variant="outline" className="gap-2">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mis Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Sistema completo de tickets en desarrollo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}