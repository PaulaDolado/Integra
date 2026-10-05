import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addHours, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { EMPTY_FORM, datosDelFormulario, fechasValidas, toInputValue, type Event, type EventFormData } from "./fechas";

// Estado de los diálogos de crear, editar y eliminar eventos, y sus escrituras
export function useEditorEvento() {
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eventForm, setEventForm] = useState<EventFormData>(EMPTY_FORM);
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useEmployeeProfile();
  const queryClient = useQueryClient();

  // La base de datos solo deja editar y borrar los eventos propios
  const esMio = !!selectedEvent && !!profile && selectedEvent.creador_id === profile.id;

  const avisarDatosNoValidos = () =>
    toast({ title: "Datos no válidos", description: "Revisa título y que la fecha fin sea posterior al inicio", variant: "destructive" });

  const openCreateEvent = (start?: Date) => {
    const inicio = start ?? addHours(startOfDay(new Date()), new Date().getHours() + 1);
    setEventForm({
      ...EMPTY_FORM,
      fecha_inicio: toInputValue(inicio),
      fecha_fin: toInputValue(addHours(inicio, 1)),
    });
    setIsCreateEventOpen(true);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ title: "Sesión requerida", description: "Inicia sesión para crear eventos", variant: "destructive" });
      return;
    }
    if (!profile) {
      toast({ title: "Perfil de empleado no encontrado", description: "Crea tu perfil de empleado para poder crear eventos", variant: "destructive" });
      return;
    }
    const fechas = fechasValidas(eventForm);
    if (!fechas) {
      avisarDatosNoValidos();
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('eventos')
        .insert([{ ...datosDelFormulario(eventForm, fechas.inicio, fechas.fin), creador_id: profile.id }]);

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo crear el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento creado",
          description: "El evento se ha creado exitosamente",
        });
        setIsCreateEventOpen(false);
        setEventForm(EMPTY_FORM);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast({ title: "Error", description: "No se pudo crear el evento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEventForm({
      titulo: event.titulo,
      descripcion: event.descripcion || '',
      fecha_inicio: toInputValue(new Date(event.fecha_inicio)),
      fecha_fin: toInputValue(new Date(event.fecha_fin)),
      ubicacion: event.ubicacion || '',
      es_privado: event.es_privado
    });
    setIsEditEventOpen(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !esMio) return;

    const fechas = fechasValidas(eventForm);
    if (!fechas) {
      avisarDatosNoValidos();
      return;
    }

    setSaving(true);
    try {
      // Con .select() se sabe si se ha cambiado algo: si la base de datos no deja
      // tocar el evento, no da error, solo no actualiza ninguna fila
      const { data, error } = await supabase
        .from('eventos')
        .update(datosDelFormulario(eventForm, fechas.inicio, fechas.fin))
        .eq('id', selectedEvent.id)
        .select('id');

      if (error || data?.length === 0) {
        toast({
          title: "Error",
          description: "No se pudo actualizar el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento actualizado",
          description: "El evento se ha actualizado exitosamente",
        });
        setIsEditEventOpen(false);
        setSelectedEvent(null);
        setEventForm(EMPTY_FORM);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error updating event:', error);
      toast({ title: "Error", description: "No se pudo actualizar el evento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !esMio) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('eventos')
        .delete()
        .eq('id', selectedEvent.id)
        .select('id');

      if (error || data?.length === 0) {
        toast({
          title: "Error",
          description: "No se pudo eliminar el evento",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Evento eliminado",
          description: "El evento se ha eliminado exitosamente",
        });
        setConfirmDelete(false);
        setIsEditEventOpen(false);
        setSelectedEvent(null);
        queryClient.invalidateQueries({ queryKey: ['eventos'] });
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({ title: "Error", description: "No se pudo eliminar el evento", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return {
    eventForm,
    setEventForm,
    selectedEvent,
    esMio,
    saving,
    isCreateEventOpen,
    setIsCreateEventOpen,
    isEditEventOpen,
    setIsEditEventOpen,
    confirmDelete,
    setConfirmDelete,
    openCreateEvent,
    handleEditEvent,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  };
}

export type EditorEvento = ReturnType<typeof useEditorEvento>;
