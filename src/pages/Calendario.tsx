import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Calendario() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-8 h-8 text-primary" />
            Calendario
          </h1>
          <p className="text-muted-foreground">
            Gestiona tus eventos, reuniones y recordatorios.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vista Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Vista de calendario completo en desarrollo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}