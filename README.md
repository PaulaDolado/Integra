# Integra

Portal del empleado. Cada persona gestiona su día a día desde un solo sitio: fichajes, ausencias, cambios de turno, tareas, calendario, tickets, tablón de anuncios y chat interno. RRHH, Dirección, Finanzas y Tecnología tienen además sus propias pantallas de gestión.

## Índice

- [Stack](#stack)
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Módulos](#módulos)
- [Permisos por departamento](#permisos-por-departamento)
- [Seguridad](#seguridad)
- [Base de datos](#base-de-datos)
- [Tests](#tests)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Añadir una página](#añadir-una-página)
- [Despliegue](#despliegue)

## Stack

| Capa | Tecnología |
| --- | --- |
| Lenguaje | TypeScript 5 |
| Interfaz | React 18 |
| Build y servidor de desarrollo | Vite 5 (plugin React SWC) |
| Rutas | React Router 7 (modo declarativo, paquete `react-router`) |
| Estilos | Tailwind CSS 3, fuente Inter Variable, tema claro y oscuro |
| Componentes | shadcn/ui sobre Radix UI, iconos Lucide |
| Datos del servidor | Supabase JS y TanStack Query 5 |
| Formularios y validación | React Hook Form y Zod |
| Fechas | date-fns y react-day-picker |
| Backend | Supabase: PostgreSQL, Auth (con doble factor TOTP), Storage, Realtime y Row Level Security |
| Tests | Vitest, Testing Library y jsdom |
| Calidad de código | ESLint 9 y typescript-eslint |

## Puesta en marcha

Requisitos:

- Node.js 20 o superior, y npm.
- Acceso al proyecto de Supabase.
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar las migraciones desde la terminal.

```sh
git clone https://github.com/PaulaDolado/Integra.git
cd Integra
npm install
cp .env.example .env   # y rellena los valores de Supabase
npm run dev
```

La aplicación arranca en http://localhost:8080.

### Variables de entorno

Copia `.env.example` a `.env` y rellénalo con los datos de **Project Settings → API** de Supabase:

```
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- El `.env` no se sube a git.
- La clave publicable es pública por diseño: lo que protege los datos son las políticas RLS de la base de datos.
- **No pongas nunca la clave `secret` ni la `service_role` en el frontend ni en `.env`.**
- Si cambias el `.env`, reinicia `npm run dev` para que Vite cargue los valores nuevos.

### Usuario demo

1. En Supabase, entra en **Authentication → Users → Add user**, usa el email `demo@integra.local` y marca **Auto Confirm User**.
2. Ejecuta `supabase/seed-demo.sql` en el **SQL Editor** para crear su perfil de empleado.

El usuario demo es administrador (`empleados.es_admin`), así que ve todas las pantallas de gestión.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Build de producción en `dist/` (incluye la CSP) |
| `npm run build:dev` | Build en modo desarrollo |
| `npm run preview` | Sirve el build de `dist/` para probarlo |
| `npm test` | Ejecuta los tests una vez |
| `npm run test:watch` | Ejecuta los tests cada vez que se guarda un archivo |
| `npm run lint` | Ejecuta ESLint |

## Módulos

Todas las rutas requieren sesión, salvo `/login` y `/reset-password`. Si el usuario tiene activado el doble factor, también hace falta haberlo verificado.

### Para toda la plantilla

| Ruta | Módulo |
| --- | --- |
| `/login`, `/reset-password` | Inicio de sesión con email o Google, doble factor y recuperación de contraseña |
| `/dashboard` | Panel con widgets de calendario, tareas, tickets y noticias |
| `/calendario` | Eventos con vista diaria, semanal, mensual y anual |
| `/tareas` | Tablero kanban con detalle de cada tarea, propiedades personalizadas e imágenes, en tiempo real |
| `/comunicacion` | Chat interno con indicador de presencia |
| `/tickets`, `/tickets/:id` | Tickets al estilo GLPI: incidencias y peticiones, prioridades, respuestas, soluciones e imágenes adjuntas |
| `/noticias` | Tablón de corcho con los comunicados de RRHH y de Marketing |
| `/organigrama` | Quién es quién por departamento. Solo muestra el nombre y el puesto, sin datos personales |
| `/fichajes` | Fichaje de entrada y salida, y el historial propio |
| `/vacaciones` | Solicitar ausencia: tipo, motivo y justificante |
| `/cambio-turno` | Solicitar un cambio de turno, con o sin intercambio con un compañero |
| `/perfil`, `/configuracion` | Perfil, inicio de sesión (doble factor y Google), confidencialidad e información de pago |
| `/documentos`, `/cursos` | En desarrollo |

### Pantallas de gestión

Solo aparecen en el menú lateral si el departamento del usuario tiene el permiso correspondiente.

| Ruta | Módulo | Permiso |
| --- | --- | --- |
| `/bandeja-ausencias` | Aprobar o rechazar ausencias | `ausencias.aprobar` |
| `/bandeja-turnos` | Aprobar o rechazar cambios de turno | `turnos.aprobar` |
| `/gestion-empleados` | Altas, cargo, departamento y estado de los empleados | `empleados.gestionar` |
| `/gestion-tickets` | Todos los tickets: asignar, cambiar el estado y resolver | `tickets.gestionar` |
| `/gestion-fichajes` | Fichajes de la plantilla y exportación a CSV. Las correcciones manuales exigen justificación y quedan auditadas | `fichajes.ver_todos` y `fichajes.editar` |
| `/gestion-contactos` | Contactos de emergencia de la plantilla, en solo lectura | `contactos_emergencia.ver` |
| `/gestion-pagos` | Datos de pago para la nómina. El IBAN sale enmascarado, y cada consulta completa o exportación queda registrada | `datos_pago.ver` |

## Permisos por departamento

Los departamentos funcionan como roles. Qué permite cada permiso se define en `public.permisos`, y qué departamento lo tiene en `public.departamento_permisos`. Se cambian desde el panel de Supabase, sin tocar código.

| Departamento | Permisos |
| --- | --- |
| Recursos Humanos | `comunicados.rrhh`, `ausencias.aprobar`, `turnos.aprobar`, `empleados.gestionar`, `fichajes.ver_todos`, `fichajes.editar`, `contactos_emergencia.ver` |
| Dirección General | `ausencias.aprobar`, `turnos.aprobar`, `fichajes.ver_todos`, `fichajes.editar` |
| Finanzas y Contabilidad | `datos_pago.ver` |
| Marketing, Comunicación | `comunicados.marketing` |
| Tecnología | `tickets.gestionar` |

Un empleado con `es_admin = true` tiene todos los permisos.

- En el frontend, `usePermisos()` (`src/hooks/usePermisos.ts`) devuelve `tiene("permiso")`. Solo sirve para mostrar u ocultar opciones.
- Quien decide de verdad es la base de datos. Las políticas RLS y las funciones del servidor vuelven a comprobar cada permiso con `public.tengo_permiso(codigo)`.

## Seguridad

- **Row Level Security** en todas las tablas. Cada empleado solo lee y modifica sus propios datos, salvo lo que le conceda su departamento.
- **Datos sensibles a través de funciones del servidor.** El organigrama, los contactos de emergencia y los datos de pago se leen con funciones `SECURITY DEFINER`, que devuelven solo los campos necesarios:
  - El organigrama nunca envía el teléfono, el correo ni la dirección.
  - El IBAN llega enmascarado. Para verlo entero hay que pedirlo con `ver_iban()`, que registra quién lo consultó en `accesos_datos_pago`.
- **Doble factor.** Si un usuario lo activa, una política restrictiva en cada tabla (`public.cumple_doble_factor()`) le bloquea los datos hasta que lo verifique.
- **Content Security Policy.** Se añade en el build con un plugin de Vite (`vite.config.ts`) y solo permite cargar código propio y conectar con Supabase. En desarrollo no se aplica, porque el HMR de Vite necesita scripts en línea.
- **Anti-clickjacking.** `src/main.tsx` impide que la app se muestre dentro de un iframe de otra web.
- **Adjuntos.** Solo se admiten imágenes PNG, JPG, WEBP o GIF de hasta 5 MB. Van a buckets privados y se sirven con URLs firmadas de 1 hora.
- **Dependencias.** `npm audit --omit=dev` debe salir limpio. React Router se actualizó a la versión 7 por los avisos GHSA-wrjc-x8rr-h8h6 y GHSA-337j-9hxr-rhxg.

## Base de datos

El esquema está versionado en `supabase/migrations/`. Las migraciones se pueden volver a ejecutar sin romper nada (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`).

Para aplicarlas:

- Pega cada archivo nuevo en el **SQL Editor** de Supabase, o
- desde la terminal:

```sh
supabase link --project-ref <project-id>
supabase db push
```

Tablas principales:

| Tabla | Contenido |
| --- | --- |
| `empleados`, `departamentos`, `cargos` | Plantilla y organización |
| `permisos`, `departamento_permisos` | Qué puede hacer cada departamento |
| `fichajes`, `fichaje_correcciones` | Control horario y registro de las correcciones, con su justificación |
| `solicitudes_vacacion` | Ausencias y su aprobación (justificantes en el bucket `justificantes`) |
| `solicitudes_turno` | Cambios e intercambios de turno |
| `tareas`, `proyectos` | Tablero de tareas (imágenes en el bucket `tareas`) |
| `eventos`, `evento_participantes` | Calendario |
| `tickets`, `ticket_seguimientos`, `ticket_adjuntos` | Tickets (imágenes en el bucket `tickets`) |
| `anuncios` | Tablón de anuncios |
| `contactos_emergencia`, `datos_pago`, `accesos_datos_pago` | Datos personales y registro de consultas del IBAN |

Los tipos de TypeScript están en `src/integrations/supabase/types.ts`. Si cambias el esquema, regenéralos:

```sh
supabase gen types typescript --project-id <project-id> > src/integrations/supabase/types.ts
```

## Tests

```sh
npm test
```

Los tests usan Vitest con jsdom y Testing Library. Están junto al código que prueban (`*.test.ts`, `*.test.tsx`):

| Test | Qué comprueba |
| --- | --- |
| `components/fichajes/calculo.test.ts` | Horas trabajadas, tramos, incidencias, fichajes anulados y corregidos, y el formato del CSV para Excel |
| `components/tickets/adjuntos.test.ts` | Tipos, tamaño y número máximo de imágenes adjuntas |
| `components/ProtectedRoute.test.tsx` | Redirige al login sin sesión o sin el doble factor verificado |
| `components/layout/AppSidebar.test.tsx` | El menú solo muestra las pantallas de gestión que concede el departamento, y marca el apartado activo |
| `hooks/usePermisos.test.tsx` | Carga los permisos una vez por usuario y no concede nada si la consulta falla |
| `lib/tema.test.ts` | El modo oscuro se recuerda y, si no hay preferencia guardada, sigue la del sistema |
| `pages/Organigrama.test.tsx` | Solo usa la función `organigrama`, nunca la tabla `empleados`, y no muestra correos ni teléfonos |
| `pages/GestionDatosPago.test.tsx` | IBAN enmascarado; el completo solo se pide al pulsar «Mostrar» |

Los tests nunca se conectan a Supabase: cada uno simula el cliente con `vi.mock` (hay un ayudante en `src/test/supabase-mock.ts`). Las políticas RLS no se prueban aquí, porque necesitan una base de datos real.

El workflow de despliegue ejecuta los tests antes del build. Si alguno falla, no se publica.

## Estructura del proyecto

```
src/
├── App.tsx                  # Rutas
├── main.tsx                 # Punto de entrada: tema, anti-iframe y render
├── index.css                # Tokens de diseño (colores, sombras, tema oscuro)
├── components/
│   ├── ProtectedRoute.tsx   # Exige sesión (y doble factor si está activado)
│   ├── layout/              # Layout, menú lateral y cabecera
│   ├── dashboard/           # Widgets del panel principal
│   ├── ausencias/ chat/ configuracion/ fichajes/ noticias/ tareas/ tickets/ turnos/
│   └── ui/                  # Componentes de shadcn/ui
├── contexts/                # Sesión (AuthContext) y presencia del chat
├── hooks/                   # Permisos, perfil, fichaje actual, toasts…
├── integrations/supabase/   # Cliente y tipos
├── lib/                     # Utilidades, rutas base y tema
├── pages/                   # Una página por ruta
└── test/                    # Configuración y ayudantes de los tests
supabase/
├── migrations/              # Esquema, políticas RLS y funciones
└── seed-demo.sql            # Perfil del usuario demo
```

El alias `@` apunta a `src/`, por ejemplo `import { supabase } from "@/integrations/supabase/client"`.

## Añadir una página

1. Crea el componente en `src/pages/`.
2. Añade la ruta en `src/App.tsx`, dentro de `ProtectedRoute` y `AppLayout`, antes de la ruta `*`.
3. Añade el enlace en `src/components/layout/AppSidebar.tsx`. Si es una pantalla de gestión, va en `managementItems` con su `permiso`.
4. Si necesita un permiso nuevo:
   - añádelo en una migración a `permisos` y a `departamento_permisos`;
   - añádelo al tipo `Permiso` de `src/hooks/usePermisos.ts`;
   - compruébalo también en las políticas RLS.
5. Importa las rutas desde `react-router`, no desde `react-router-dom`.

Para añadir componentes de shadcn/ui:

```sh
npx shadcn@latest add <componente>
```

## Despliegue

`npm run build` genera una web estática en `dist/`. La app usa rutas del lado del cliente, así que el hosting debe servir `index.html` para cualquier ruta. Si no, al recargar una página como `/tareas` aparece un 404.

En Supabase, añade el dominio de producción en **Authentication → URL Configuration** para que funcionen el inicio de sesión, Google y la recuperación de contraseña.

### GitHub Pages

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) se ejecuta en cada push a `main`. Pasa los tests, compila y publica en `https://<usuario>.github.io/<repositorio>/`. También se puede lanzar a mano desde **Actions → Publicar en GitHub Pages → Run workflow**.

Configuración, una sola vez:

1. En GitHub, **Settings → Pages → Build and deployment → Source**: elige **GitHub Actions**.
2. En **Settings → Secrets and variables → Actions**, crea los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, con los mismos valores que en `.env`.
3. En Supabase, **Authentication → URL Configuration**:
   - **Site URL**: `https://<usuario>.github.io/<repositorio>/`
   - **Redirect URLs**: añade `https://<usuario>.github.io/<repositorio>/**`

El workflow compila con `BASE_PATH=/<repositorio>/`. Después copia `index.html` a `404.html`, para que al recargar una ruta se cargue la app y no el 404 de GitHub.

GitHub Pages no permite enviar cabeceras HTTP. Por eso la CSP va en una etiqueta `<meta>` que se añade en el build, y la protección contra iframes se hace en `src/main.tsx`.
