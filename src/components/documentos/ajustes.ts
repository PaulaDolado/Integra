import { useSyncExternalStore } from "react";
import type * as Y from "yjs";

// Ajustes de la nota que se comparten con quien colabora. Viven en el propio
// documento Yjs, así que se guardan y se sincronizan como el texto.
const MAPA_AJUSTES = "ajustes";

export interface AjustesNota {
  numerarPaginas: boolean;
}

export function leerAjustes(doc: Y.Doc): AjustesNota {
  const mapa = doc.getMap(MAPA_AJUSTES);
  return { numerarPaginas: mapa.get("numerarPaginas") === true };
}

export function cambiarAjuste<K extends keyof AjustesNota>(doc: Y.Doc, clave: K, valor: AjustesNota[K]) {
  doc.getMap(MAPA_AJUSTES).set(clave, valor);
}

export function useAjustesNota(doc: Y.Doc): AjustesNota {
  const numerar = useSyncExternalStore(
    (avisar) => {
      const mapa = doc.getMap(MAPA_AJUSTES);
      mapa.observe(avisar);
      return () => mapa.unobserve(avisar);
    },
    () => leerAjustes(doc).numerarPaginas
  );
  return { numerarPaginas: numerar };
}
