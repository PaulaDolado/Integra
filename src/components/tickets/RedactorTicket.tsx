import { useState } from "react";
import { Loader2, MessageSquare, Send, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Ticket } from "./ticket-config";
import { SelectorImagenes } from "./SelectorImagenes";
import { imagenesDelPortapapeles, subirAdjuntos, validarImagenes } from "./adjuntos";
import { useAvisarFallo } from "./useAvisarFallo";
import type { Plantilla } from "./useTicketDetalle";

type Modo = "respuesta" | "solucion";

interface RedactorTicketProps {
  ticket: Ticket;
  puedeSolucionar: boolean;
  soySolicitante: boolean;
  plantillas: Plantilla[];
  // Compartido con la valoración de la solución: mientras se envía algo no se puede hacer otra acción
  enviando: boolean;
  setEnviando: (enviando: boolean) => void;
  recargar: () => void;
}

// Caja para responder al ticket o, si eres técnico, añadir una solución (con plantillas e imágenes)
export function RedactorTicket({ ticket, puedeSolucionar, soySolicitante, plantillas, enviando, setEnviando, recargar }: RedactorTicketProps) {
  const { toast } = useToast();
  const avisarFallo = useAvisarFallo();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [modo, setModo] = useState<Modo>("respuesta");
  const [texto, setTexto] = useState("");

  const modoActivo: Modo = puedeSolucionar ? modo : "respuesta";

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      const { data: seguimientoId, error } =
        modoActivo === "solucion"
          ? await supabase.rpc("solucionar_ticket", { p_ticket: ticket.id, p_contenido: texto })
          : await supabase.rpc("responder_ticket", { p_ticket: ticket.id, p_contenido: texto });
      if (error) {
        avisarFallo(error);
        return;
      }
      // El mensaje ya está guardado: si fallan las imágenes se dice en el mismo aviso
      const { fallidas } = await subirAdjuntos(ticket.id, seguimientoId, archivos).catch((e: unknown) => {
        console.error("Error uploading ticket images:", e);
        return { fallidas: archivos.length };
      });
      const titulo = modoActivo === "solucion" ? "Solución añadida" : "Respuesta enviada";
      if (fallidas > 0) {
        toast({
          title: `${titulo}, pero sin todas las imágenes`,
          description: `${fallidas} imagen(es) no se pudieron adjuntar`,
          variant: "destructive",
        });
      } else {
        toast({
          title: titulo,
          description: modoActivo === "solucion" ? "El ticket queda resuelto a la espera de que el solicitante lo apruebe" : undefined,
        });
      }
      setTexto("");
      setArchivos([]);
      setModo("respuesta");
      recargar();
    } catch (error) {
      avisarFallo(error);
    } finally {
      setEnviando(false);
    }
  };

  const pegar = (event: React.ClipboardEvent) => {
    const imagenes = imagenesDelPortapapeles(event);
    if (imagenes.length === 0) return;
    event.preventDefault();
    const { validas, errores } = validarImagenes(imagenes, archivos);
    if (errores.length > 0) toast({ title: "Algunas imágenes no se han añadido", description: errores.join(". "), variant: "destructive" });
    setArchivos([...archivos, ...validas]);
  };

  const aplicarPlantilla = (plantillaId: string) => {
    const plantilla = plantillas.find((p) => p.id === plantillaId);
    if (plantilla) setTexto(plantilla.contenido);
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {puedeSolucionar && (
          <Tabs value={modoActivo} onValueChange={(v) => setModo(v as Modo)}>
            <TabsList>
              <TabsTrigger value="respuesta" className="gap-1.5">
                <MessageSquare className="w-4 h-4" />
                Responder
              </TabsTrigger>
              <TabsTrigger value="solucion" className="gap-1.5">
                <Wrench className="w-4 h-4" />
                Añadir una solución
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        {modoActivo === "solucion" && plantillas.length > 0 && (
          <Select onValueChange={aplicarPlantilla}>
            <SelectTrigger className="sm:w-72" aria-label="Plantilla de solución">
              <SelectValue placeholder="Usar una plantilla de respuesta..." />
            </SelectTrigger>
            <SelectContent>
              {plantillas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Textarea
          aria-label={modoActivo === "solucion" ? "Solución" : "Respuesta"}
          rows={modoActivo === "solucion" ? 8 : 4}
          placeholder={modoActivo === "solucion" ? "Describe la solución aplicada..." : "Escribe tu respuesta..."}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={pegar}
        />
        <SelectorImagenes archivos={archivos} onChange={setArchivos} disabled={enviando} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {modoActivo === "solucion"
              ? "El ticket pasará a Resuelto y el solicitante podrá aprobarlo o rechazarlo."
              : soySolicitante && ["en_espera", "resuelto"].includes(ticket.estado)
                ? "Al responder, el ticket volverá a estar en curso."
                : "Todos los participantes del ticket verán tu respuesta."}
          </p>
          <Button className="gap-2 shrink-0" onClick={enviar} disabled={enviando || !texto.trim()}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : modoActivo === "solucion" ? <Wrench className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {modoActivo === "solucion" ? "Añadir solución" : "Responder"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
