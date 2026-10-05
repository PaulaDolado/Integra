import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventFormData } from "./fechas";

interface CamposEventoProps {
  // Prefijo de los id, para que no choquen los del diálogo de crear y el de editar
  prefix: string;
  eventForm: EventFormData;
  setEventForm: (form: EventFormData) => void;
}

export function CamposEvento({ prefix, eventForm, setEventForm }: CamposEventoProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${prefix}titulo`}>Título del evento</Label>
        <Input
          id={`${prefix}titulo`}
          value={eventForm.titulo}
          onChange={(e) => setEventForm({ ...eventForm, titulo: e.target.value })}
          placeholder="Ingrese el título del evento"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}descripcion`}>Descripción</Label>
        <Textarea
          id={`${prefix}descripcion`}
          value={eventForm.descripcion}
          onChange={(e) => setEventForm({ ...eventForm, descripcion: e.target.value })}
          placeholder="Describe el evento..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${prefix}fecha_inicio`}>Inicio</Label>
          <Input
            id={`${prefix}fecha_inicio`}
            type="datetime-local"
            value={eventForm.fecha_inicio}
            onChange={(e) => setEventForm({ ...eventForm, fecha_inicio: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${prefix}fecha_fin`}>Fin</Label>
          <Input
            id={`${prefix}fecha_fin`}
            type="datetime-local"
            value={eventForm.fecha_fin}
            onChange={(e) => setEventForm({ ...eventForm, fecha_fin: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${prefix}ubicacion`}>Ubicación (opcional)</Label>
        <Input
          id={`${prefix}ubicacion`}
          value={eventForm.ubicacion}
          onChange={(e) => setEventForm({ ...eventForm, ubicacion: e.target.value })}
          placeholder="Ubicación del evento"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id={`${prefix}es_privado`}
          checked={eventForm.es_privado}
          onChange={(e) => setEventForm({ ...eventForm, es_privado: e.target.checked })}
          className="rounded"
        />
        <Label htmlFor={`${prefix}es_privado`}>Evento privado</Label>
      </div>
    </>
  );
}
