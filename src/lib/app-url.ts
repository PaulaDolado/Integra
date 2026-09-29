// Ruta base de la app: "/" en local y "/Integra/" en GitHub Pages
export const BASE_PATH = import.meta.env.BASE_URL;

// basename para React Router (sin barra final; undefined si la app está en la raíz)
export const ROUTER_BASENAME = BASE_PATH === "/" ? undefined : BASE_PATH.replace(/\/$/, "");

// URL absoluta a una ruta de la app, para los enlaces que envía Supabase por email o OAuth
export const appUrl = (path: string) =>
  `${window.location.origin}${BASE_PATH}${path.replace(/^\//, "")}`;
