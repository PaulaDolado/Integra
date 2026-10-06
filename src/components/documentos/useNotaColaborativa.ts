import { useEffect, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useInvalidarEnCambios } from "@/hooks/useInvalidarEnCambios";
import { SincronizadorNota, type EstadoSync } from "./sincronizacion";
import { textoDeDocumento } from "./contenido";
import type { Rol } from "./notas";

export interface SesionNota {
  doc: Y.Doc;
  awareness: Awareness;
  sync: SincronizadorNota;
}

// Título, formato y rol: se vuelven a pedir cuando cambian (Realtime). Es una
// consulta ligera, sin el contenido.
export function useMetaNota(notaId: string) {
  const clave = ["notas", "meta", notaId];
  const consulta = useQuery({
    queryKey: clave,
    queryFn: async () => {
      const [nota, rol] = await Promise.all([
        supabase.from("notas").select("id, titulo, formato, propietario_id").eq("id", notaId).maybeSingle(),
        supabase.rpc("rol_en_nota", { p_nota: notaId }),
      ]);
      const datos = comprobar(nota);
      const miRol = comprobar(rol) as Rol | null;
      // Sin fila o sin rol: la nota no existe o ya no la compartes
      return datos && miRol ? { ...datos, rol: miRol } : null;
    },
  });
  useInvalidarEnCambios(
    `nota-meta:${notaId}`,
    [
      { table: "notas", filter: `id=eq.${notaId}` },
      { table: "nota_colaboradores", filter: `nota_id=eq.${notaId}` },
    ],
    [clave, ["notas", "colaboradores", notaId]]
  );
  return consulta;
}

// Abre la nota: carga el documento Yjs y lo mantiene sincronizado mientras el
// componente esté montado. `sesion` es null hasta que termina la carga.
// `editable` sale del rol actual (useMetaNota); si cambia, la sesión se rehace
// con el permiso nuevo. Mientras sea undefined no se carga nada.
export function useNotaColaborativa(notaId: string, editable: boolean | undefined) {
  const [sesion, setSesion] = useState<SesionNota | null>(null);
  const [estado, setEstado] = useState<EstadoSync>("guardado");
  const [errorCarga, setErrorCarga] = useState<unknown>(null);

  // El contenido inicial se pide una sola vez por visita (puede pesar):
  // después todo llega por la sincronización
  const { data: inicial, error } = useQuery({
    queryKey: ["notas", "abrir", notaId],
    queryFn: async () => {
      const filas = comprobar(await supabase.rpc("abrir_nota", { p_nota: notaId }));
      if (!filas?.[0]) throw new Error("La nota no existe");
      return filas[0];
    },
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: editable !== undefined,
  });

  useEffect(() => {
    if (!inicial || editable === undefined) return;
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const sync = new SincronizadorNota({
      notaId,
      doc,
      awareness,
      puedeEditar: editable,
      extracto: () => textoDeDocumento(doc),
      onEstado: setEstado,
    });
    let cancelado = false;

    sync
      .cargar({ estado: inicial.estado, estado_hasta: inicial.estado_hasta })
      .then(() => {
        if (cancelado) return;
        sync.conectar();
        setSesion({ doc, awareness, sync });
      })
      .catch((e) => {
        if (!cancelado) setErrorCarga(e);
      });

    return () => {
      cancelado = true;
      setSesion(null);
      // Primero se guarda lo pendiente (se codifica al momento), luego se libera
      void sync.destruir().finally(() => {
        awareness.destroy();
        doc.destroy();
      });
    };
  }, [inicial, notaId, editable]);

  // Avisa antes de cerrar la pestaña si quedan cambios sin guardar
  useEffect(() => {
    if (!sesion) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      if (!sesion.sync.hayPendientes) return;
      void sesion.sync.guardarAhora();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [sesion]);

  return { sesion, estado, error: error ?? errorCarga };
}

export interface Presente {
  clientId: number;
  id: string;
  nombre: string;
  color: string;
}

// Quién más tiene la nota abierta ahora mismo (una entrada por persona)
export function usePresentes(awareness: Awareness | null) {
  const instantanea = useSyncExternalStore(
    (avisar) => {
      if (!awareness) return () => {};
      awareness.on("change", avisar);
      return () => awareness.off("change", avisar);
    },
    () => (awareness ? clavePresentes(awareness) : "")
  );
  return instantanea ? (JSON.parse(instantanea) as Presente[]) : [];
}

// Texto estable para useSyncExternalStore: solo cambia si cambia la lista
function clavePresentes(awareness: Awareness) {
  const propio = awareness.getLocalState()?.user as { id?: string } | undefined;
  const vistos = new Set<string>(propio?.id ? [propio.id] : []);
  const lista: Presente[] = [];
  awareness.getStates().forEach((estado, clientId) => {
    if (clientId === awareness.clientID) return;
    const u = estado.user as { id?: unknown; name?: unknown; color?: unknown } | undefined;
    if (!u || typeof u.id !== "string" || vistos.has(u.id)) return;
    vistos.add(u.id);
    lista.push({
      clientId,
      id: u.id,
      nombre: typeof u.name === "string" ? u.name : "Alguien",
      color: typeof u.color === "string" ? u.color : "#2563eb",
    });
  });
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return JSON.stringify(lista);
}
