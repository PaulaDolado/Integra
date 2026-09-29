# Integra

Portal del empleado: calendario, tareas, tickets, fichajes, vacaciones, noticias, organigrama y comunicación interna.

## Stack

| Capa | Tecnología |
| --- | --- |
| Lenguaje | TypeScript 5 |
| Interfaz | React 18 |
| Build y servidor de desarrollo | Vite 5 (plugin React SWC) |
| Estilos | Tailwind CSS 3 + `tailwindcss-animate` |
| Componentes | shadcn/ui sobre Radix UI, iconos Lucide |
| Rutas | React Router 6 |
| Datos del servidor | TanStack Query 5 |
| Formularios y validación | React Hook Form + Zod |
| Fechas | date-fns, react-day-picker |
| Gráficos | Recharts |
| Notificaciones | Sonner |
| Backend | Supabase: PostgreSQL, Auth y Row Level Security |
| Calidad de código | ESLint 9 + typescript-eslint |

## Requisitos

- Node.js 18 o superior y npm
- Acceso al proyecto de Supabase (`pqxghndxexdsonnkoacu`)
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migraciones

## Puesta en marcha

```sh
git clone https://github.com/PaulaDolado/integra.git
cd integra
npm install
cp .env.example .env   # y rellena los valores de Supabase
npm run dev
```

La aplicación arranca en http://localhost:8080.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción en `dist/` |
| `npm run build:dev` | Build en modo desarrollo |
| `npm run preview` | Sirve el build de `dist/` para probarlo |
| `npm run lint` | Ejecuta ESLint |

## Configuración de Supabase

El cliente está en `src/integrations/supabase/client.ts` y lee la configuración de las variables de entorno. Copia `.env.example` a `.env` y rellénalo con los datos de **Project Settings → API**:

```
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

El archivo `.env` no se sube a git. La clave publicable es pública por diseño: la seguridad depende de las políticas RLS de la base de datos. No añadas nunca la clave `secret` (o `service_role`) al frontend ni a `.env`.

Si cambias el `.env`, reinicia `npm run dev` para que Vite cargue los valores nuevos.

### Base de datos

El esquema está versionado en `supabase/migrations/`. Tablas principales:

| Tabla | Contenido |
| --- | --- |
| `empleados` | Perfil del empleado, enlazado al usuario de Supabase Auth |
| `departamentos`, `cargos` | Estructura de la organización (organigrama) |
| `proyectos`, `proyecto_miembros` | Proyectos y quién participa |
| `tareas` | Tareas por proyecto y empleado |
| `eventos`, `evento_participantes` | Calendario |
| `tickets` | Incidencias, con estado y prioridad |
| `solicitudes_vacacion` | Vacaciones y su aprobación |
| `fichajes` | Control horario |
| `anuncios` | Noticias internas |

Todas las tablas tienen Row Level Security activado.

Para aplicar las migraciones en un proyecto nuevo:

```sh
supabase link --project-ref <project-id>
supabase db push
```

### Usuario demo

1. En Supabase, entra en **Authentication → Users → Add user**, usa el email `demo@integra.local` y marca **Auto Confirm User**.
2. Ejecuta `supabase/seed-demo.sql` en el **SQL Editor** para crear su perfil de empleado.

Si cambias el esquema, regenera los tipos de TypeScript:

```sh
supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

## Estructura del proyecto

```
src/
├── App.tsx                  # Rutas de la aplicación
├── main.tsx                 # Punto de entrada
├── index.css                # Tokens de diseño (colores, degradados, tema oscuro)
├── components/
│   ├── ProtectedRoute.tsx   # Redirige a /login si no hay sesión
│   ├── layout/              # Layout, barra lateral y cabecera
│   ├── dashboard/           # Widgets del panel principal
│   └── ui/                  # Componentes de shadcn/ui
├── contexts/AuthContext.tsx # Sesión y usuario actual
├── hooks/                   # Hooks (perfil del empleado, toasts, móvil)
├── integrations/supabase/   # Cliente y tipos generados
├── lib/utils.ts             # Utilidades (cn)
└── pages/                   # Una página por ruta
supabase/
├── config.toml
└── migrations/              # Esquema de la base de datos
public/                      # Iconos y archivos estáticos
```

El alias `@` apunta a `src/`, por ejemplo `import { supabase } from "@/integrations/supabase/client"`.

## Módulos

| Ruta | Página | Estado |
| --- | --- | --- |
| `/login`, `/reset-password` | Acceso y recuperación de contraseña | Operativo |
| `/dashboard` | Panel con calendario, tareas, tickets y noticias | Operativo |
| `/calendario` | Calendario con vista mensual y por horas | Operativo |
| `/tareas` | Gestión de tareas | Operativo |
| `/tickets` | Incidencias | Operativo |
| `/fichajes` | Control horario | Operativo |
| `/vacaciones` | Solicitudes de vacaciones | Operativo |
| `/noticias` | Anuncios internos | Operativo |
| `/organigrama` | Departamentos y cargos | Operativo |
| `/perfil` | Perfil del empleado (editable) | Operativo |
| `/comunicacion` | Comunicación interna y chat | Maqueta, sin datos |
| `/documentos` | Gestión documental | En desarrollo |
| `/cursos` | Inscripción a cursos | En desarrollo |
| `/cambio-turno` | Cambio de turno | En desarrollo |

Todas las rutas salvo `/login` y `/reset-password` requieren sesión.

## Añadir una página

1. Crea el componente en `src/pages/`.
2. Añade la ruta en `src/App.tsx`, envuelta en `ProtectedRoute` y `AppLayout`, antes de la ruta `*`.
3. Añade el enlace en `src/components/layout/AppSidebar.tsx`.

Para añadir componentes de shadcn/ui:

```sh
npx shadcn@latest add <componente>
```

## Despliegue

`npm run build` genera una web estática en `dist/`, que se puede publicar en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages, Azure Static Web Apps, Nginx…).

La app usa rutas del lado del cliente, así que el hosting debe redirigir todas las rutas a `index.html`. Si no, al recargar una página como `/tareas` aparecerá un error 404.

En Supabase, añade el dominio de producción en **Authentication → URL Configuration** para que funcionen el inicio de sesión y la recuperación de contraseña.

### GitHub Pages

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica la web en `https://<usuario>.github.io/<repositorio>/` en cada push a `main`. También se puede lanzar a mano desde **Actions → Publicar en GitHub Pages → Run workflow**.

Configuración, una sola vez:

1. En GitHub, **Settings → Pages → Build and deployment → Source**: elige **GitHub Actions**.
2. En **Settings → Secrets and variables → Actions**, crea los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con los mismos valores que en `.env`.
3. En Supabase, **Authentication → URL Configuration**:
   - **Site URL**: `https://<usuario>.github.io/<repositorio>/`
   - **Redirect URLs**: añade `https://<usuario>.github.io/<repositorio>/**`

El workflow compila con `BASE_PATH=/<repositorio>/` y copia `index.html` a `404.html`, para que al recargar una ruta como `/tareas` se cargue la app en lugar del 404 de GitHub.

GitHub Pages no permite enviar cabeceras HTTP, así que la política de seguridad de contenido (CSP) va en una etiqueta `<meta>` que se añade en el build, y la protección contra la inclusión en iframes se hace en `src/main.tsx`.
