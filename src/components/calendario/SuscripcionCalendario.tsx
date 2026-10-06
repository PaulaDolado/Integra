import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Copy, ExternalLink, Link2, Loader2, RefreshCw, TriangleAlert, Unlink } from "lucide-react";
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
  // Conexión para ver Google Calendar dentro de Integra (si no se pasa, no se muestra)
  google?: {
    conexion: { email: string | null; conectado_en: string } | null;
    conectar: () => Promise<void>;
    desconectar: () => Promise<void>;
  };
}

// Enlace privado para ver el calendario de Integra en Google Calendar (u otro).
// Solo va de Integra a Google, y Google lo actualiza cada pocas horas.
export function SuscripcionCalendario({ open, onOpenChange, google }: SuscripcionCalendarioProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [confirmarNuevo, setConfirmarNuevo] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [confirmarDesconectar, setConfirmarDesconectar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const conectarGoogle = async () => {
    if (!google) return;
    setConectando(true);
    try {
      await google.conectar(); // lleva a Google: si va bien, la página cambia
    } catch (e) {
      console.error("Error al conectar Google Calendar:", e);
      toast({ title: "Error", description: "No se pudo conectar con Google Calendar", variant: "destructive" });
      setConectando(false);
    }
  };

  const desconectarGoogle = async () => {
    if (!google) return;
    setDesconectando(true);
    try {
      await google.desconectar();
      setConfirmarDesconectar(false);
      toast({ title: "Google Calendar desconectado", description: "Tus eventos de Google ya no se ven en Integra." });
    } catch (e) {
      console.error("Error al desconectar Google Calendar:", e);
      toast({ title: "Error", description: "No se pudo desconectar Google Calendar", variant: "destructive" });
    } finally {
      setDesconectando(false);
    }
  };

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
            <DialogTitle>Google Calendar</DialogTitle>
            <DialogDescription>Tus eventos de Google en Integra y los de Integra en Google.</DialogDescription>
          </DialogHeader>

          {google && (
            <section aria-labelledby="google-en-integra" className="space-y-3 border-b pb-5">
              <h3 id="google-en-integra" className="font-medium">
                Ver Google Calendar en Integra
              </h3>
              {google.conexion ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Conectado{google.conexion.email && <> con <strong className="text-foreground">{google.conexion.email}</strong></>} desde
                    el {format(new Date(google.conexion.conectado_en), "d 'de' MMMM", { locale: es })}. Tus eventos de Google salen
                    en azul en el calendario, solo para ti y en solo lectura.
                  </p>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setConfirmarDesconectar(true)}>
                    <Unlink className="h-4 w-4" />
                    Desconectar
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Conecta tu cuenta de Google para ver aquí tus eventos de Google Calendar. Integra solo podrá leerlos: no
                    puede crear, cambiar ni borrar nada en Google.
                  </p>
                  <Button type="button" className="gap-2" onClick={conectarGoogle} disabled={conectando}>
                    {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Conectar Google Calendar
                  </Button>
                </>
              )}
            </section>
          )}

          <h3 className="font-medium">Ver Integra en Google Calendar</h3>
          <p className="-mt-2 text-sm text-muted-foreground">
            Añade tu calendario de Integra a Google Calendar con este enlace privado. Verás los mismos eventos que aquí, y
            Google los actualiza solo cada pocas horas.
          </p>

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

      <AlertDialog open={confirmarDesconectar} onOpenChange={setConfirmarDesconectar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Tus eventos de Google dejarán de verse en Integra y se retirará el permiso en tu cuenta de Google. Puedes
              volver a conectarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void desconectarGoogle();
              }}
              disabled={desconectando}
            >
              {desconectando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
