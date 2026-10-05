import { useMemo, useState } from "react";
import { Loader2, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { analizarSalud } from "@/components/contrasenas/contrasenas";
import { filtrarEntradas, type Filtro } from "@/components/contrasenas/lista";
import { useBoveda } from "@/components/contrasenas/useBoveda";
import { usePortapapeles } from "@/components/contrasenas/usePortapapeles";
import { CrearBoveda, DesbloquearBoveda } from "@/components/contrasenas/AccesoBoveda";
import { AccionesBoveda, CabeceraBoveda } from "@/components/contrasenas/CabeceraBoveda";
import { ResumenSalud } from "@/components/contrasenas/ResumenSalud";
import { BarraFiltros } from "@/components/contrasenas/BarraFiltros";
import { FilaEntrada } from "@/components/contrasenas/FilaEntrada";
import { EntradaDialog } from "@/components/contrasenas/EntradaDialog";
import { CambiarMaestraDialog } from "@/components/contrasenas/CambiarMaestraDialog";
import { BorrarEntradaDialog, GeneradorDialog, VaciarBovedaDialog } from "@/components/contrasenas/DialogosBoveda";

export default function Contrasenas() {
  const boveda = useBoveda();
  const { estado, entradas, editando } = boveda;
  const copiar = usePortapapeles();

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [generador, setGenerador] = useState(false);
  // Si la bóveda se bloquea (por inactividad) con el generador abierto, se cierra:
  // si no, volvería a aparecer solo al desbloquear
  if (estado !== "abierta" && generador) setGenerador(false);

  const salud = useMemo(() => analizarSalud(entradas), [entradas]);
  const mostradas = filtrarEntradas(entradas, salud, filtro, busqueda);

  if (estado === "cargando") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="p-6 space-y-6">
        <CabeceraBoveda />
        <Card>
          <CardContent className="py-16 text-center">
            <TriangleAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No se pudo cargar la bóveda</p>
            <Button variant="outline" className="mt-4" onClick={boveda.cargarParametros}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (estado !== "abierta") {
    return (
      <div className="p-6 space-y-6">
        <CabeceraBoveda />
        <div className="py-4">
          {estado === "sin-boveda" ? (
            <CrearBoveda onCrear={boveda.crear} />
          ) : (
            <DesbloquearBoveda onDesbloquear={boveda.desbloquear} onOlvidada={() => boveda.setVaciando(true)} />
          )}
        </div>
        <VaciarBovedaDialog open={boveda.vaciando} onOpenChange={boveda.setVaciando} onVaciar={boveda.vaciar} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CabeceraBoveda />
        <AccionesBoveda
          onGenerador={() => setGenerador(true)}
          onBloquear={boveda.bloquear}
          onCambiarMaestra={() => boveda.setCambiandoMaestra(true)}
          onNueva={() => boveda.setEditando("nueva")}
        />
      </div>

      <ResumenSalud total={entradas.length} salud={salud} ilegibles={boveda.ilegibles} filtro={filtro} onFiltrar={setFiltro} />

      <BarraFiltros filtro={filtro} onFiltro={setFiltro} busqueda={busqueda} onBusqueda={setBusqueda} />

      <Card className="overflow-hidden">
        {entradas.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-primary" />
            <p className="font-medium">Tu bóveda está vacía</p>
            <p className="text-sm text-muted-foreground mb-4">Guarda aquí las contraseñas de tus herramientas de trabajo.</p>
            <Button className="gap-2" onClick={() => boveda.setEditando("nueva")}>
              <Plus className="w-4 h-4" />
              Añadir la primera
            </Button>
          </div>
        ) : mostradas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">No hay contraseñas que coincidan</div>
        ) : (
          <ul className="divide-y">
            {mostradas.map((e) => (
              <FilaEntrada
                key={e.id}
                entrada={e}
                revelada={boveda.reveladas.has(e.id)}
                debil={salud.debiles.has(e.id)}
                repetida={salud.repetidas.has(e.id)}
                onEditar={() => boveda.setEditando(e)}
                onCopiar={copiar}
                onAlternarRevelada={() => boveda.alternarRevelada(e.id)}
                onAlternarFavorito={() => boveda.alternarFavorito(e)}
                onBorrar={() => boveda.setBorrando(e)}
              />
            ))}
          </ul>
        )}
      </Card>

      <EntradaDialog
        open={editando !== null}
        entrada={editando === "nueva" ? null : editando}
        onCancel={() => boveda.setEditando(null)}
        onGuardar={boveda.guardar}
      />

      <CambiarMaestraDialog
        open={boveda.cambiandoMaestra}
        onCancel={() => boveda.setCambiandoMaestra(false)}
        onCambiar={boveda.cambiarMaestra}
      />

      <GeneradorDialog open={generador} onOpenChange={setGenerador} onCopiar={(c) => copiar(c, "contrasena")} />

      <BorrarEntradaDialog entrada={boveda.borrando} onCancel={() => boveda.setBorrando(null)} onBorrar={boveda.borrar} />
    </div>
  );
}
