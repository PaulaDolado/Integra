import {
  Home,
  Calendar,
  CheckSquare,
  MessageSquare,
  Ticket,
  FileText,
  Newspaper,
  Users,
  User,
  GraduationCap,
  Plane,
  Clock
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Calendario", url: "/calendario", icon: Calendar },
  { title: "Tareas", url: "/tareas", icon: CheckSquare },
  { title: "Comunicación", url: "/comunicacion", icon: MessageSquare },
  { title: "Tickets", url: "/tickets", icon: Ticket },
  { title: "Gestión Documental", url: "/documentos", icon: FileText },
  { title: "Noticias", url: "/noticias", icon: Newspaper },
  { title: "Organigrama", url: "/organigrama", icon: Users },
  { title: "Registro de Fichajes", url: "/fichajes", icon: Clock },
  { title: "Mi Perfil", url: "/perfil", icon: User },
];

const requestItems = [
  { title: "Inscripción Cursos", url: "/cursos", icon: GraduationCap },
  { title: "Solicitar Vacaciones", url: "/vacaciones", icon: Plane },
  { title: "Cambio de Turno", url: "/cambio-turno", icon: Clock },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-border bg-card">
      <SidebarContent className="gap-0">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div>
                <h2 className="font-semibold text-foreground">Integra</h2>
                <p className="text-sm text-muted-foreground">Portal del empleado</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10">
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Solicitudes</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {requestItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-10">
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                        }`
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      {!isCollapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}