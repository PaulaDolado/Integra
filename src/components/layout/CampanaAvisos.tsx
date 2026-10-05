import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeftRight, Bell, CalendarDays, CheckCheck, Megaphone, Ticket, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { useAvisos, type Aviso } from "@/hooks/useAvisos";
import { cn } from "@/lib/utils";

const ICONOS: Record<string, LucideIcon> = {
  ausencia: CalendarDays,
  turno: ArrowLeftRight,
  ticket: Ticket,
  comunicado: Megaphone,
};

const etiquetaCampana = (sinLeer: number) => (sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : "Avisos");

// Avisa con un toast de los avisos que llegan con la app abierta (no de los que
// ya había al cargarla)
function useToastAvisosNuevos(avisos: Aviso[], cargando: boolean) {
  const conocidos = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (cargando) return;
    if (!conocidos.current) {
      conocidos.current = new Set(avisos.map((a) => a.id));
      return;
    }
    const vistos = conocidos.current;
    const nuevos = avisos.filter((a) => !vistos.has(a.id) && !a.leido_en);
    for (const a of avisos) vistos.add(a.id);
    if (nuevos.length === 1) {
      toast({ title: nuevos[0].titulo, description: nuevos[0].cuerpo || undefined });
    } else if (nuevos.length > 1) {
      toast({ title: `Tienes ${nuevos.length} avisos nuevos`, description: "Ábrelos desde la campana." });
    }
  }, [avisos, cargando]);
}

export function CampanaAvisos() {
  const [abierta, setAbierta] = useState(false);
  const navigate = useNavigate();
  const { avisos, sinLeer, loading, marcarLeido, marcarTodos } = useAvisos();
  useToastAvisosNuevos(avisos, loading);

  const abrir = (aviso: Aviso) => {
    if (!aviso.leido_en) marcarLeido(aviso.id);
    setAbierta(false);
    if (aviso.enlace?.startsWith("/")) navigate(aviso.enlace);
  };

  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={etiquetaCampana(sinLeer)}>
          <Bell className="w-4 h-4" />
          {sinLeer > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center tabular-nums"
            >
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Avisos</h2>
          {sinLeer > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={marcarTodos}>
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todos como leídos
            </Button>
          )}
        </div>

        {avisos.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {loading ? "Cargando avisos…" : "No tienes avisos"}
          </p>
        ) : (
          <ul className="max-h-[min(28rem,70vh)] overflow-y-auto py-1" aria-label="Lista de avisos">
            {avisos.map((aviso) => {
              const Icono = ICONOS[aviso.tipo] ?? Bell;
              const sinLeerAviso = !aviso.leido_en;
              return (
                <li key={aviso.id}>
                  <button
                    type="button"
                    onClick={() => abrir(aviso)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-hidden",
                      sinLeerAviso && "bg-primary/5"
                    )}
                  >
                    <Icono
                      aria-hidden="true"
                      className={cn("mt-0.5 h-4 w-4 shrink-0", sinLeerAviso ? "text-primary" : "text-muted-foreground")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", sinLeerAviso ? "font-semibold" : "text-muted-foreground")}>
                        {aviso.titulo}
                        {sinLeerAviso && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      {aviso.cuerpo && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{aviso.cuerpo}</span>
                      )}
                      <time dateTime={aviso.created_at} className="mt-1 block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(aviso.created_at), { addSuffix: true, locale: es })}
                      </time>
                    </span>
                    {sinLeerAviso && <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
