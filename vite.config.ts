import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Política de seguridad de contenido para el build de producción: solo se
// permite cargar código propio y conectar con el proyecto de Supabase.
// En desarrollo no se aplica porque Vite inyecta scripts en línea para el HMR.
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const supabaseWs = supabase.replace(/^http/, "ws");
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // Radix y los gráficos aplican estilos en línea
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs}`,
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    // En GitHub Pages la web vive en /<repositorio>/; el workflow pasa BASE_PATH
    base: process.env.BASE_PATH || "/",
    server: {
      host: "::",
      port: 8080,
      // Carpetas de herramientas (skills de agentes) que no forman parte de la web
      watch: {
        ignored: ["**/.agents/**", "**/.claude/**"],
      },
    },
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.VITE_SUPABASE_URL)],
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
