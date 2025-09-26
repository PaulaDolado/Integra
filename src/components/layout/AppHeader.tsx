import { useState } from "react";
import { Bell, Settings, LogOut, Clock, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const { toast } = useToast();

  const handleClockToggle = () => {
    setIsClockedIn(!isClockedIn);
    toast({
      title: isClockedIn ? "Fichaje de Salida" : "Fichaje de Entrada",
      description: `Has fichado la ${isClockedIn ? "salida" : "entrada"} correctamente - ${new Date().toLocaleTimeString()}`,
    });
  };

  const handleThemeToggle = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
    toast({
      title: "Tema actualizado",
      description: `Cambiado al modo ${isDarkMode ? "claro" : "oscuro"}`,
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 gap-4">
        <SidebarTrigger />
        
        <div className="flex-1 flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-medium text-foreground">
              ¡Hola, <span className="text-primary">Ana García</span>! 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              {getCurrentDate()} - {getCurrentTime()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón de Fichaje */}
          <Button
            onClick={handleClockToggle}
            variant={isClockedIn ? "destructive" : "default"}
            className="gap-2"
          >
            <Clock className="w-4 h-4" />
            {isClockedIn ? "Fichar Salida" : "Fichar Entrada"}
          </Button>

          {/* Toggle Tema */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleThemeToggle}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </Button>

          {/* Notificaciones */}
          <Button variant="outline" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-xs">
              3
            </Badge>
          </Button>

          {/* Menú Usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/placeholder-avatar.jpg" alt="Ana García" />
                  <AvatarFallback className="bg-primary text-primary-foreground">AG</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Ana García</p>
                  <p className="text-xs text-muted-foreground">Desarrolladora Frontend</p>
                  <p className="text-xs text-muted-foreground">ana.garcia@empresa.com</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Configuración
              </DropdownMenuItem>
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}