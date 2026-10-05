import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CamposEvento } from "./CamposEvento";
import type { EditorEvento } from "./useEditorEvento";

// Diálogos de crear y de editar o ver un evento, y la confirmación de borrado
export function DialogosEvento({ editor }: { editor: EditorEvento }) {
  const {
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
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
  } = editor;

  return (
    <>
      <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <CamposEvento prefix="" eventForm={eventForm} setEventForm={setEventForm} />
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateEventOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Crear Evento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditEventOpen} onOpenChange={setIsEditEventOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{esMio ? 'Editar Evento' : 'Detalle del evento'}</DialogTitle>
            {!esMio && (
              <DialogDescription>Solo quien creó el evento puede modificarlo o eliminarlo.</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={handleUpdateEvent} className="space-y-4">
            <fieldset disabled={!esMio} className="space-y-4">
              <CamposEvento prefix="edit-" eventForm={eventForm} setEventForm={setEventForm} />
            </fieldset>
            {esMio ? (
              <div className="flex justify-between pt-4">
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Eliminar
                </Button>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditEventOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditEventOpen(false)}>
                  Cerrar
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{selectedEvent?.titulo}" del calendario. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Se cierra al terminar, no al pulsar: si falla, se puede reintentar
                e.preventDefault();
                handleDeleteEvent();
              }}
              disabled={saving}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
