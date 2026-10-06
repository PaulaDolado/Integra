import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const CLAVE = ["calendario-token"];
// La pantalla de Google Calendar para añadir un calendario «Desde URL»
const GOOGLE_AÑADIR_URL = "https://calendar.google.com/calendar/u/0/r/settings/addbyurl";

const urlSuscripcion = (token: string) =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendario-ics?token=${token}`;

interface SuscripcionCalendarioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Enlace privado para ver el calendario de Integra en Google Calendar (u otro).
// Solo va de Integra a Google, y Google lo actualiza cada pocas horas.
export function SuscripcionCalendario({ open, onOpenChange }: SuscripcionCalendarioProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [confirmarNuevo, setConfirmarNuevo] = useState(false);
  const [regenerando, setRegenerando] = useState(false);

  const { data: token, isPending, error } = useQuery({
    queryKey: CLAVE,
    queryFn: async () => comprobar(await supabase.rpc("mi_token_calendario")),
    enabled: open,
    staleTime: Infinity,
  });
  const url = token ? urlSuscripcion(token) : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: "No se pudo copiar", description: "Selecciona el enlace y cópialo a mano", variant: "destructive" });
    }
  };

  const regenerar = async () => {
    setRegenerando(true);
    const { data, error } = await supabase.rpc("regenerar_token_calendario");
    setRegenerando(false);
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo generar un enlace nuevo", variant: "destructive" });
      return;
    }
    queryClient.setQueryData(CLAVE, data);
    setConfirmarNuevo(false);
    toast({
      title: "Enlace nuevo generado",
      description: "El anterior ya no funciona. Si lo tenías en Google Calendar, añade este en su lugar.",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ver el calendario en Google Calendar</DialogTitle>
            <DialogDescription>
              Añade tu calendario de Integra a Google Calendar con este enlace privado. Verás los mismos eventos que
              aquí, y Google los actualiza solo cada pocas horas. Los cambios que hagas en Google no vuelven a Integra.
            </DialogDescription>
          </DialogHeader>

          {isPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando el enlace" />
            </div>
          ) : error || !token ? (
            <p className="text-sm text-destructive">No se pudo obtener tu enlace. Inténtalo de nuevo más tarde.</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="enlace-calendario">Tu enlace privado</Label>
                <div className="flex gap-2">
                  <Input
                    id="enlace-calendario"
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" className="shrink-0 gap-2" onClick={copiar}>
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  No lo compartas: quien lo tenga puede ver tus eventos, también los privados.
                </p>
              </div>

              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Copia el enlace.</li>
                <li>
                  En Google Calendar, junto a <strong>Otros calendarios</strong>, pulsa <strong>+</strong> y elige{" "}
                  <strong>Desde URL</strong>.
                </li>
                <li>
                  Pega el enlace y pulsa <strong>Añadir calendario</strong>. Aparecerá como «Integra».
                </li>
              </ol>

              <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setConfirmarNuevo(true)}
                >
                  <RefreshCw className="h-4 w-4" />
                  Generar un enlace nuevo
                </Button>
                <Button asChild className="gap-2">
                  <a href={GOOGLE_AÑADIR_URL} target="_blank" rel="noopener noreferrer">
                    Abrir Google Calendar
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarNuevo} onOpenChange={setConfirmarNuevo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Generar un enlace nuevo?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace actual dejará de funcionar. Hazlo si crees que alguien más lo tiene. Si ya lo habías añadido a
              Google Calendar, tendrás que quitarlo y añadir el nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void regenerar();
              }}
              disabled={regenerando}
            >
              {regenerando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generar enlace nuevo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
