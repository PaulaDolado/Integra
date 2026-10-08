import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import { useAvisarError } from "@/hooks/useAvisarError";
import { useMiEmpleadoId } from "@/hooks/useMiEmpleadoId";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { TarjetaNota } from "@/components/documentos/TarjetaNota";
import { eliminarNota, salirDeNota } from "@/components/documentos/acciones";
import { filtrarNotas, tituloNota, type FiltroNotas, type NotaResumen } from "@/components/documentos/notas";

const FILTROS: { valor: FiltroNotas; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todas" },
  { valor: "mias", etiqueta: "Mías" },
  { valor: "compartidas", etiqueta: "Compartidas conmigo" },
];

export default function Documentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { empleadoId } = useMiEmpleadoId();
  const [filtro, setFiltro] = useState<FiltroNotas>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [confirmar, setConfirmar] = useState<{ nota: NotaResumen; accion: "eliminar" | "salir" } | null>(null);
  const [procesando, setProcesando] = useState(false);

  const clave = ["notas", "lista"];
  const { data: notas = [], isLoading, error } = useQuery({
    queryKey: clave,
    queryFn: async () => comprobar(await supabase.rpc("mis_notas")) ?? [],
  });
  useAvisarError(error, "No se pudieron cargar las notas");
  useInvalidarEnCambios("notas-lista", [{ table: "notas" }, { table: "nota_colaboradores" }], [clave]);

  const visibles = filtrarNotas(notas, filtro, busqueda);

  const crear = async () => {
    setCreando(true);
    const { data, error } = await supabase.rpc("crear_nota", {});
    setCreando(false);
    if (error || !data) {
      toast({ title: "Error", description: "No se pudo crear la nota", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: clave });
    navigate(`/documentos/${data}`);
  };

  const ejecutarConfirmacion = async () => {
    if (!confirmar) return;
    setProcesando(true);
    try {
      if (confirmar.accion === "eliminar") await eliminarNota(confirmar.nota.id);
      else if (empleadoId) await salirDeNota(confirmar.nota.id, empleadoId);
      toast({ title: confirmar.accion === "eliminar" ? "Nota eliminada" : "Ya no colaboras en la nota" });
      queryClient.invalidateQueries({ queryKey: clave });
      setConfirmar(null);
    } catch (e) {
      console.error("Error en la nota", e);
      toast({ title: "Error", description: "No se pudo completar la acción", variant: "destructive" });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            Gestión Documental
          </h1>
          <p className="text-muted-foreground">Notas colaborativas.</p>
        </div>
        <Button className="gap-2" onClick={crear} disabled={creando}>
          {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nueva nota
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar notas"
            aria-label="Buscar notas"
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filtro}
          onValueChange={(v) => v && setFiltro(v as FiltroNotas)}
          className="justify-start"
          aria-label="Qué notas mostrar"
        >
          {FILTROS.map((f) => (
            <ToggleGroupItem key={f.valor} value={f.valor} size="sm" className="px-3">
              {f.etiqueta}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Cargando" />
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6" aria-label="Notas">
            {filtro !== "compartidas" && !busqueda.trim() && (
              <li>
                <button
                  type="button"
                  onClick={crear}
                  disabled={creando}
                  className="flex aspect-[210/297] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {creando ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : <Plus className="h-6 w-6" aria-hidden="true" />}
                  <span className="text-sm font-medium">Página en blanco</span>
                </button>
              </li>
            )}
            {visibles.map((nota) => (
              <TarjetaNota
                key={nota.id}
                nota={nota}
                onEliminar={(n) => setConfirmar({ nota: n, accion: "eliminar" })}
                onSalir={(n) => setConfirmar({ nota: n, accion: "salir" })}
              />
            ))}
          </ul>
          {visibles.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {busqueda.trim()
                ? "Ninguna nota coincide con la búsqueda."
                : filtro === "compartidas"
                  ? "Todavía nadie ha compartido una nota contigo."
                  : "Aún no tienes notas. Empieza con una página en blanco."}
            </p>
          )}
        </>
      )}

      <AlertDialog open={confirmar !== null} onOpenChange={(open) => !open && !procesando && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.accion === "eliminar" ? "¿Eliminar la nota?" : "¿Dejar de colaborar?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.accion === "eliminar"
                ? `«${tituloNota(confirmar?.nota.titulo)}» y sus imágenes se borrarán para todas las personas con las que la compartes. No se puede deshacer.`
                : `Dejarás de ver «${tituloNota(confirmar?.nota.titulo)}». Su propietario puede volver a compartirla contigo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void ejecutarConfirmacion();
              }}
              disabled={procesando}
              className={confirmar?.accion === "eliminar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {procesando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmar?.accion === "eliminar" ? "Eliminar" : "Dejar de colaborar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
