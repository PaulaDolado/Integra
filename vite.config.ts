import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// Política de seguridad de contenido para el build de producción: solo se
// permite cargar código propio y conectar con el proyecto de Supabase (y con
// Sentry, si la monitorización de errores está activada con VITE_SENTRY_DSN).
// En desarrollo no se aplica porque Vite inyecta scripts en línea para el HMR.
function contentSecurityPolicy(supabaseUrl: string | undefined, sentryDsn: string | undefined): Plugin {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  // El DSN es https://<clave>@<host de ingesta>/<proyecto>: solo se permite ese host
  const sentry = sentryDsn ? new URL(sentryDsn).origin : "";
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Radix y los gráficos aplican estilos en línea
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} ${sentry}`.trimEnd(),
    // Service worker y manifiesto de la app instalable: solo los propios
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join("; ");

  return {
    name: "integra-csp",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "strict-origin-when-cross-origin" }, injectTo: "head" },
    ],
  };
}

// App instalable en el móvil (PWA). El service worker solo guarda la «carcasa»
// de la app (JS, CSS, HTML, fuentes e iconos del build) para que arranque
// rápido. Nunca guarda datos: no hay reglas de caché en tiempo de ejecución,
// así que las peticiones a Supabase (REST, Auth, Storage, Realtime) y a
// cualquier otro origen van siempre a la red sin pasar por la caché.
function appInstalable(base: string) {
  return VitePWA({
    // La versión nueva espera a que el usuario pulse «Actualizar» (src/lib/pwa.ts)
    registerType: "prompt",
    // El registro lo hace src/lib/pwa.ts; nada de scripts en línea (CSP)
    injectRegister: false,
    // Los iconos ya entran en la precaché por globPatterns; así no salen repetidos
    includeManifestIcons: false,
    manifest: {
      id: base,
      name: "Integra",
      short_name: "Integra",
      description: "Portal del empleado: fichajes, vacaciones, turnos, tareas y comunicación interna.",
      lang: "es",
      dir: "ltr",
      start_url: base,
      scope: base,
      display: "standalone",
      orientation: "any",
      // --background del tema claro (src/index.css)
      theme_color: "#f9fafb",
      background_color: "#f9fafb",
      categories: ["business", "productivity"],
      icons: [
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      shortcuts: [{ name: "Fichar", short_name: "Fichar", url: `${base}fichajes` }],
    },
    workbox: {
      // Solo los archivos del build; placeholder.svg y robots.txt no hacen falta
      globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
      globIgnores: ["placeholder.svg"],
      // Rutas de la app (p. ej. /Integra/fichajes) sin conexión: se sirve index.html.
      // Solo afecta a las navegaciones dentro del scope del service worker.
      navigateFallback: "index.html",
      cleanupOutdatedCaches: true,
      // Sin runtimeCaching a propósito: ver el comentario de arriba
      runtimeCaching: [],
    },
    devOptions: { enabled: false },
  });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // En GitHub Pages la web vive en /<repositorio>/; el workflow pasa BASE_PATH
  const base = process.env.BASE_PATH || "/";

  return {
    base,
    server: {
      host: "::",
      port: 8080,
      // Carpetas de herramientas (skills de agentes) que no forman parte de la web
      watch: {
        ignored: ["**/.agents/**", "**/.claude/**"],
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL, env.VITE_SENTRY_DSN),
      appInstalable(base),
    ],
    build: {
      rolldownOptions: {
        output: {
          // Las librerías base cambian poco: en archivos aparte, el navegador
          // las conserva en caché aunque se publique una versión nueva de la app
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
              { name: "supabase", test: /node_modules[\\/]@supabase[\\/]/ },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
