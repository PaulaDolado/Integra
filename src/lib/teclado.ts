import type { KeyboardEvent } from "react";

// Para elementos con role="button" que no pueden ser un <button> (p. ej. una
// tarjeta arrastrable con contenido propio): Intro y Espacio hacen lo mismo que
// el clic, como en un botón nativo. Solo reacciona cuando el foco está en el
// propio elemento, no en un control que lleve dentro.
export const activarConTeclado = (accion: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    accion();
  }
};
