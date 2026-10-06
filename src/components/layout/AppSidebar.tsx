import {
  Home,
  Calendar,
  CheckSquare,
  MessageSquare,
  Ticket,
  FileText,
  Newspaper,
  Users,
  GraduationCap,
  Plane,
  Clock,
  Inbox,
  UserCog,
  LifeBuoy,
  Timer,
  CalendarClock,
  HeartPulse,
  Landmark,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { NavLink, matchPath, useLocation } from "react-router";
import { usePermisos, type Permiso } from "@/hooks/usePermisos";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavEntry {
  title: string;
  url: string;
  icon: LucideIcon;
}

const menuItems: NavEntry[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Calendario", url: "/calendario", icon: Calendar },
  { title: "Tareas", url: "/tareas", icon: CheckSquare },
  { title: "Comunicación", url: "/comunicacion", icon: MessageSquare },
  { title: "Tickets", url: "/tickets", icon: Ticket },
  { title: "Gestión Documental", url: "/documentos", icon: FileText },
  { title: "Noticias", url: "/noticias", icon: Newspaper },
  { title: "Organigrama", url: "/organigrama", icon: Users },
  { title: "Registro de Fichajes", url: "/fichajes", icon: Clock },
  { title: "Contraseñas", url: "/contrasenas", icon: KeyRound },
];

const requestItems: NavEntry[] = [
  { title: "Inscripción Cursos", url: "/cursos", icon: GraduationCap },
  { title: "Solicitar Ausencia", url: "/vacaciones", icon: Plane },
  { title: "Cambio de Turno", url: "/cambio-turno", icon: Clock },
];

interface NavGestion extends NavEntry {
  // Basta con uno de estos permisos para ver el apartado
  permisos: Permiso[];
  // Apartados que cuelgan de este en el menú
  hijos?: NavGestion[];
}

// Pantallas de gestión: solo se muestran a los departamentos con el permiso
const managementItems: NavGestion[] = [
  { title: "Bandeja de Ausencias", url: "/bandeja-ausencias", icon: Inbox, permisos: ["ausencias.aprobar"] },
  { title: "Cambios de Turno", url: "/bandeja-turnos", icon: CalendarClock, permisos: ["turnos.aprobar"] },
  {
    title: "Gestión de Empleados",
    url: "/gestion-empleados",
    icon: UserCog,
    permisos: ["empleados.gestionar"],
    hijos: [
      {
        title: "Contactos de Emergencia",
        url: "/gestion-contactos",
        icon: HeartPulse,
        permisos: ["contactos_emergencia.ver", "contactos_emergencia.editar"],
      },
      { title: "Datos de Pago", url: "/gestion-pagos", icon: Landmark, permisos: ["datos_pago.ver", "datos_pago.editar"] },
    ],
  },
  { title: "Todos los Tickets", url: "/gestion-tickets", icon: LifeBuoy, permisos: ["tickets.gestionar"] },
  { title: "Fichajes de la Plantilla", url: "/gestion-fichajes", icon: Timer, permisos: ["fichajes.ver_todos"] },
];

// Apartados visibles con sus hijos visibles. Si no se ve el padre (Finanzas no
// gestiona empleados), sus hijos visibles suben al primer nivel.
function apartadosVisibles(items: NavGestion[], tiene: (permiso: Permiso) => boolean) {
  const puede = (item: NavGestion) => item.permisos.some(tiene);
  return items.flatMap((item): (NavEntry & { hijos: NavEntry[] })[] => {
    const hijos = (item.hijos ?? []).filter(puede);
    if (puede(item)) return [{ ...item, hijos }];
    return hijos.map((hijo) => ({ ...hijo, hijos: [] }));
  });
}

// El estado activo se pasa a SidebarMenuButton: con asChild, un className en
// forma de función del NavLink se convertiría en texto y no funcionaría
function NavItem({ item, isCollapsed, hijos = [] }: { item: NavEntry; isCollapsed: boolean; hijos?: NavEntry[] }) {
  const { pathname } = useLocation();
  const activo = (url: string) => !!matchPath({ path: url, end: false }, pathname);
  const isActive = activo(item.url);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={isCollapsed ? item.title : undefined}
        className="h-9 gap-3 rounded-lg px-3 text-sidebar-foreground transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground data-[active=true]:hover:bg-sidebar-accent data-[active=true]:hover:text-sidebar-accent-foreground"
      >
        <NavLink to={item.url} aria-current={isActive ? "page" : undefined}>
          <item.icon className="w-4 h-4" />
          <span className="text-sm">{item.title}</span>
        </NavLink>
      </SidebarMenuButton>
      {hijos.length > 0 && (
        <SidebarMenuSub>
          {hijos.map((hijo) => (
            <SidebarMenuSubItem key={hijo.url}>
              <SidebarMenuSubButton asChild isActive={activo(hijo.url)}>
                {/* Sin icono: así cabe el nombre entero en el submenú */}
                <NavLink to={hijo.url} aria-current={activo(hijo.url) ? "page" : undefined}>
                  <span>{hijo.title}</span>
                </NavLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

function NavGroup({
  label,
  items,
  isCollapsed,
}: {
  label: string;
  items: (NavEntry & { hijos?: NavEntry[] })[];
  isCollapsed: boolean;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {items.map((item) =>
            // Plegado, el submenú se oculta: sus apartados van en la lista como los demás
            isCollapsed ? (
              [item, ...(item.hijos ?? [])].map((i) => <NavItem key={i.url} item={i} isCollapsed />)
            ) : (
              <NavItem key={item.url} item={item} isCollapsed={false} hijos={item.hijos} />
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { tiene } = usePermisos();
  const visibleManagementItems = apartadosVisibles(managementItems, tiene);

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent className="gap-0">
        <nav aria-label="Navegación principal" className="flex flex-col">
          {/* Misma altura que la barra superior (h-16) para que las líneas coincidan */}
          <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-xs">
                <Home className="w-4 h-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-foreground">Integra</p>
                  <p className="text-xs text-muted-foreground">Portal del empleado</p>
                </div>
              )}
            </div>
          </div>

          <NavGroup label="Menú Principal" items={menuItems} isCollapsed={isCollapsed} />
          <NavGroup label="Solicitudes" items={requestItems} isCollapsed={isCollapsed} />
          {visibleManagementItems.length > 0 && (
            <NavGroup label="Gestión" items={visibleManagementItems} isCollapsed={isCollapsed} />
          )}
        </nav>
      </SidebarContent>
    </Sidebar>
  );
}
