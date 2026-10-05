import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const suscribir = (aviso: () => void) => {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", aviso);
  return () => mql.removeEventListener("change", aviso);
};

export function useIsMobile() {
  return React.useSyncExternalStore(
    suscribir,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
