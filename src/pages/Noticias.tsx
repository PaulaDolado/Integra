import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChevronLeft, ChevronRight, Newspaper, Pencil, Pin, Plus, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { type Comunicado, ComunicadoDialog } from "@/components/noticias/ComunicadoDialog";
import { usePermisos } from "@/hooks/usePermisos";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { type AreaComunicado, AREAS, getArea } from "@/components/noticias/areas";

type Anuncio = Comunicado;

type Filtro = "todas" | AreaComunicado;

// Inclinación fija por nota (según su id) para que no cambie al recargar
const getRotation = (id: string) => {
  const hash = [...id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ((hash % 5) - 2) * 0.6;
};

export default function Noticias() {
  const [noticias, setNoticias] = useState<Anuncio[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierta, setAbierta] = useState<Anuncio | null>(null);
  const [empleadoId, setEmpleadoId] = useState<string | null>(null);
  // undefined = cerrado, null = nuevo comunicado
  const [editando, setEditando] = useState<Anuncio | null | undefined>(undefined);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const { toast } = useToast();
  const { tiene } = usePermisos();

  // Áreas en las que el departamento del usuario puede publicar (vacío = solo lectura)
  const misAreas = (Object.keys(AREAS) as AreaComunicado[]).filter((area) => tiene(`comunicados.${area}`));

  useEffect(() => {
    supabase.rpc("mi_empleado_id").then(({ data }) => setEmpleadoId(data ?? null));
  }, []);

  const puedeGestionar = (noticia: Anuncio) => misAreas.includes(noticia.area as AreaComunicado);

  const handleSaved = () => {
    setEditando(undefined);
    setAbierta(null);
    setRecarga((n) => n + 1);
  };

  const borrar = async () => {
    if (!abierta) return;
    const { error } = await supabase.from("anuncios").delete().eq("id", abierta.id);
    if (error) {
      console.error("Error deleting comunicado:", error);
      toast({ title: "Error", description: "No se pudo eliminar el comunicado", variant: "destructive" });
      return;
    }
    toast({ title: "Comunicado eliminado", description: "Se ha retirado del tablón" });
    setConfirmarBorrado(false);
    handleSaved();
  };

  useEffect(() => {
    async function fetchNoticias() {
      try {
        const { data, error } = await supabase
          .from("anuncios")
          .select("*")
          .gte("fecha_publicacion", mes.toISOString())
          .lt("fecha_publicacion", addMonths(mes, 1).toISOString())
          .in("area", ["rrhh", "marketing"])
          .order("fecha_publicacion", { ascending: false });

        if (error) {
          console.error("Error fetching noticias:", error);
        } else {
          setNoticias(data || []);
        }
      } catch (error) {
        console.error("Error fetching noticias:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchNoticias();

    // Setup realtime subscription
    const channel = supabase
      .channel('noticias-page-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'anuncios'
        },
        () => {
          fetchNoticias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mes, recarga]);

  const visibles = filtro === "todas" ? noticias : noticias.filter((n) => n.area === filtro);
  const contar = (area: AreaComunicado) => noticias.filter((n) => n.area === area).length;
  const nombreMes = format(mes, "MMMM yyyy", { locale: es });
  const esMesActual = isSameMonth(mes, new Date());

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="w-8 h-8 text-primary" />
            Tablón de anuncios
          </h1>
          <p className="text-muted-foreground">
            Comunicados de Recursos Humanos y Marketing del mes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {misAreas.length > 0 && (
            <Button className="gap-2" onClick={() => setEditando(null)}>
              <Plus className="w-4 h-4" />
              Nuevo comunicado
            </Button>
          )}
          <ToggleGroup
            type="single"
            size="sm"
            variant="outline"
            value={filtro}
            onValueChange={(value) => value && setFiltro(value as Filtro)}
            aria-label="Filtrar por área"
          >
            <ToggleGroupItem value="todas" className="px-3 text-xs">
              Todos ({noticias.length})
            </ToggleGroupItem>
            {(Object.keys(AREAS) as AreaComunicado[]).map((area) => (
              <ToggleGroupItem key={area} value={area} className="px-3 text-xs">
                {AREAS[area].label} ({contar(area)})
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Mes anterior"
              onClick={() => setMes((m) => addMonths(m, -1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="min-w-[9rem] text-center text-sm font-medium first-letter:uppercase">
              {nombreMes}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              aria-label="Mes siguiente"
              onClick={() => setMes((m) => addMonths(m, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            {!esMesActual && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setMes(startOfMonth(new Date()))}>
                Mes actual
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tablón: fondo punteado de corcho claro, en la paleta de Integra */}
      <div className="rounded-xl border bg-muted/40 p-4 sm:p-6 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px]">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : visibles.length === 0 ? (
          <div className="py-16 text-center">
            <Pin className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              No hay comunicados{filtro !== "todas" && ` de ${AREAS[filtro].label}`} en {nombreMes}
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 2xl:columns-4">
            {visibles.map((noticia) => {
              const area = getArea(noticia.area);
              return (
                <button
                  type="button"
                  key={noticia.id}
                  onClick={() => setAbierta(noticia)}
                  style={{ "--giro": `${getRotation(noticia.id)}deg` } as React.CSSProperties}
                  className={`relative mb-6 block w-full break-inside-avoid rounded-sm p-5 pt-7 text-left shadow-md transition-all [transform:rotate(var(--giro))] hover:z-10 hover:shadow-xl hover:[transform:rotate(0deg)_scale(1.02)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${area.nota}`}
                >
                  <Pin
                    className={`absolute left-1/2 top-1.5 h-5 w-5 -translate-x-1/2 rotate-12 fill-current ${area.chincheta}`}
                    aria-hidden
                  />
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${area.etiqueta}`}>
                      {area.label}
                    </span>
                    <span className="text-xs opacity-70">
                      {format(new Date(noticia.fecha_publicacion), "d MMM", { locale: es })}
                    </span>
                  </div>
                  <h3 className="mb-2 font-semibold leading-snug">{noticia.titulo}</h3>
                  <p className="line-clamp-6 whitespace-pre-line text-sm opacity-90">{noticia.contenido}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!abierta} onOpenChange={(open) => !open && setAbierta(null)}>
        <DialogContent className="sm:max-w-lg">
          {abierta && (
            <>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${getArea(abierta.area).etiqueta}`}>
                    {getArea(abierta.area).label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(abierta.fecha_publicacion), "d 'de' MMMM yyyy", { locale: es })}
                  </span>
                </div>
                <DialogTitle>{abierta.titulo}</DialogTitle>
                <DialogDescription className="sr-only">Comunicado completo</DialogDescription>
              </DialogHeader>
              <p className="whitespace-pre-line text-sm leading-relaxed">{abierta.contenido}</p>
              {puedeGestionar(abierta) && (
                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive"
                    onClick={() => setConfirmarBorrado(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => setEditando(abierta)}>
                    <Pencil className="w-4 h-4" />
                    Editar
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {misAreas.length > 0 && (
        <ComunicadoDialog
          open={editando !== undefined}
          comunicado={editando ?? null}
          areas={misAreas}
          empleadoId={empleadoId}
          onClose={() => setEditando(undefined)}
          onSaved={handleSaved}
        />
      )}

      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este comunicado?</AlertDialogTitle>
            <AlertDialogDescription>
              "{abierta?.titulo}" se retirará del tablón para todos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
