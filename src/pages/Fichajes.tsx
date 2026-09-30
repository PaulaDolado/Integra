import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Fichaje {
  id: string;
  empleado_id: string;
  tipo: "entrada" | "salida";
  fecha_hora: string;
  es_manual: boolean;
  anulado: boolean;
  fecha_hora_original: string | null;
  justificacion: string | null;
}

export default function Fichajes() {
  const { profile, loading: profileLoading } = useEmployeeProfile();
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!profile) return;
    fetchFichajes();

    // Refleja también los fichajes hechos desde el botón de la barra superior
    const channel = supabase
      .channel(`fichajes-pagina-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fichajes", filter: `empleado_id=eq.${profile.id}` }, () =>
        fetchFichajes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  async function fetchFichajes() {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("fichajes")
        .select("*")
        .eq("empleado_id", profile.id)
        .order("fecha_hora", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching fichajes:", error);
      } else {
        setFichajes((data || []) as Fichaje[]);
      }
    } catch (error) {
      console.error("Error fetching fichajes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFichaje(tipo: "entrada" | "salida") {
    if (!profile) return;

    setRegistering(true);
    try {
      const { error } = await supabase
        .from("fichajes")
        .insert({
          empleado_id: profile.id,
          tipo: tipo,
          fecha_hora: new Date().toISOString()
        });

      if (error) {
        console.error("Error registering fichaje:", error);
        toast({
          title: "Error",
          description: "No se pudo registrar el fichaje",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Fichaje registrado",
          description: `${tipo === "entrada" ? "Entrada" : "Salida"} registrada correctamente`,
        });
        fetchFichajes();
      }
    } catch (error) {
      console.error("Error registering fichaje:", error);
      toast({
        title: "Error",
        description: "No se pudo registrar el fichaje",
        variant: "destructive"
      });
    } finally {
      setRegistering(false);
    }
  }

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Los fichajes anulados por RRHH se muestran en el historial pero no cuentan
  const ultimoFichaje = fichajes.find((f) => !f.anulado);
  const puedeEntrar = !ultimoFichaje || ultimoFichaje.tipo === "salida";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Registro de Fichajes</h1>
        <p className="text-muted-foreground">
          Registra tu entrada y salida del trabajo
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Fichar Ahora
          </CardTitle>
          <CardDescription>
            {puedeEntrar 
              ? "Registra tu entrada al trabajo"
              : "Registra tu salida del trabajo"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => handleFichaje("entrada")}
              disabled={!puedeEntrar || registering}
              className="flex-1"
              size="lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Fichar Entrada
            </Button>
            <Button
              onClick={() => handleFichaje("salida")}
              disabled={puedeEntrar || registering}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Fichar Salida
            </Button>
          </div>

          {ultimoFichaje && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Último fichaje:</p>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {ultimoFichaje.tipo === "entrada" ? (
                    <LogIn className="w-5 h-5 text-green-600" />
                  ) : (
                    <LogOut className="w-5 h-5 text-orange-600" />
                  )}
                  <div>
                    <p className="font-medium">
                      {ultimoFichaje.tipo === "entrada" ? "Entrada" : "Salida"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(ultimoFichaje.fecha_hora), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                    </p>
                  </div>
                </div>
                <Badge variant={ultimoFichaje.tipo === "entrada" ? "default" : "secondary"}>
                  {ultimoFichaje.tipo === "entrada" ? "En el trabajo" : "Fuera"}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Historial de Fichajes
          </CardTitle>
          <CardDescription>
            Últimos 50 registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fichajes.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No hay fichajes registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {fichajes.map((fichaje) => (
                <div
                  key={fichaje.id}
                  className={`flex flex-col gap-3 p-4 rounded-lg border transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    fichaje.anulado ? "opacity-60" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {fichaje.tipo === "entrada" ? (
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <LogIn className="w-5 h-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <LogOut className="w-5 h-5 text-orange-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {fichaje.tipo === "entrada" ? "Entrada" : "Salida"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(fichaje.fecha_hora), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                      </p>
                      {(fichaje.anulado || fichaje.es_manual || fichaje.fecha_hora_original) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {fichaje.anulado
                              ? "Anulado por RRHH"
                              : fichaje.es_manual
                                ? "Añadido por RRHH"
                                : `Hora corregida por RRHH (registraste las ${format(new Date(fichaje.fecha_hora_original!), "HH:mm")})`}
                          </span>
                          {fichaje.justificacion && <> · «{fichaje.justificacion}»</>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className={`font-mono text-lg font-semibold ${fichaje.anulado ? "line-through" : ""}`}>
                      {format(new Date(fichaje.fecha_hora), "HH:mm:ss")}
                    </p>
                    <Badge 
                      variant={fichaje.tipo === "entrada" ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {fichaje.tipo === "entrada" ? "Entrada" : "Salida"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
