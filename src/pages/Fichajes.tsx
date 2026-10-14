import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { comprobar } from "@/lib/query-client";
import { useEmployeeProfile } from "@/hooks/useEmployeeProfile";
import { claveMisFichajes } from "@/hooks/useFichajeActual";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Coffee, LogIn, LogOut, Calendar, Pencil } from "lucide-react";
import { format, parseISO, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { descansoEntre, formatDuracion, resumirFichajes, segundosEntre } from "@/components/fichajes/calculo";

// Días del historial
const DIAS_HISTORIAL = 30;

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
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const { toast } = useToast();

  // Cuelga de la clave de los fichajes del empleado: el Realtime de la barra
  // superior la invalida, así que también refleja lo que se fiche desde allí
  const empleadoId = profile?.id ?? null;
  const { data: fichajes = [], isLoading } = useQuery({
    queryKey: [...claveMisFichajes(empleadoId), "historial"],
    queryFn: async () =>
      comprobar(
        await supabase
          .from("fichajes")
          .select("*")
          .eq("empleado_id", empleadoId!)
          // Por días completos: con un límite de registros, el día más antiguo podría quedar a medias
          .gte("fecha_hora", subDays(startOfDay(new Date()), DIAS_HISTORIAL - 1).toISOString())
          .order("fecha_hora", { ascending: false })
      ) as Fichaje[],
    enabled: !!empleadoId,
  });

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
        queryClient.invalidateQueries({ queryKey: claveMisFichajes(profile.id) });
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

  if (profileLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Los fichajes anulados por RRHH se muestran en el historial pero no cuentan
  const ultimoFichaje = fichajes.find((f) => !f.anulado);
  const puedeEntrar = !ultimoFichaje || ultimoFichaje.tipo === "salida";
  const { dias } = resumirFichajes(fichajes);
  // Los anulados no cuentan, pero se enseñan en su día
  const anuladosDe = (fecha: string) =>
    fichajes.filter((f) => f.anulado && format(new Date(f.fecha_hora), "yyyy-MM-dd") === fecha).reverse();

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
            Últimos {DIAS_HISTORIAL} días. Cada día suma el tiempo trabajado entre tus entradas y salidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dias.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No hay fichajes registrados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dias.map((dia) => {
                const enCurso = dia.tramos.find((t) => t.enCurso);
                const anulados = anuladosDe(dia.fecha);
                const fechaLarga = format(parseISO(dia.fecha), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
                return (
                  <section key={dia.fecha} className="rounded-lg border" aria-label={fechaLarga}>
                    <header className="flex flex-col gap-1 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-medium first-letter:uppercase">{fechaLarga}</h3>
                      <p className="text-sm">
                        <span className="text-muted-foreground">{enCurso ? "Total hasta ahora: " : "Total: "}</span>
                        <span className="font-mono font-semibold tabular-nums">
                          {enCurso?.entrada ? (
                            <DuracionEnCurso desde={enCurso.entrada} base={dia.segundos} />
                          ) : (
                            formatDuracion(dia.segundos)
                          )}
                        </span>
                      </p>
                    </header>
                    <ol className="divide-y">
                      {dia.tramos.map((tramo, i) => {
                        const descanso = i > 0 ? descansoEntre(dia.tramos[i - 1], tramo) : null;
                        return (
                          <li key={i}>
                            {descanso !== null && (
                              <p className="flex items-center gap-2 bg-muted/20 px-4 py-1.5 text-xs text-muted-foreground">
                                <Coffee className="h-3.5 w-3.5" aria-hidden />
                                Descanso de <span className="font-mono tabular-nums">{formatDuracion(descanso)}</span>
                              </p>
                            )}
                            <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-sm text-muted-foreground">Tramo {i + 1}</span>
                                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                                  <LogIn className="h-4 w-4 text-green-600" aria-label="Entrada" />
                                  {tramo.entrada ? format(tramo.entrada, "HH:mm:ss") : "—"}
                                  <span className="text-muted-foreground" aria-hidden>
                                    →
                                  </span>
                                  <LogOut className="h-4 w-4 text-orange-600" aria-label="Salida" />
                                  {tramo.salida ? format(tramo.salida, "HH:mm:ss") : tramo.enCurso ? "ahora" : "—"}
                                </span>
                                {tramo.correcciones.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                    <Pencil className="h-3 w-3" aria-hidden />
                                    Corregido por RRHH · {tramo.correcciones.map((c) => `«${c}»`).join(", ")}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono font-semibold tabular-nums sm:text-right">
                                {tramo.segundos !== null ? (
                                  formatDuracion(tramo.segundos)
                                ) : tramo.enCurso && tramo.entrada ? (
                                  <span className="text-primary">
                                    <DuracionEnCurso desde={tramo.entrada} />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-sans text-sm font-normal text-amber-700 dark:text-amber-400">
                                    <AlertTriangle className="h-4 w-4" aria-hidden />
                                    {tramo.entrada ? "Falta la salida" : "Falta la entrada"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                    {anulados.length > 0 && (
                      <ul className="space-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
                        {anulados.map((f) => (
                          <li key={f.id}>
                            <span className="line-through">
                              {f.tipo === "entrada" ? "Entrada" : "Salida"} de las {format(new Date(f.fecha_hora), "HH:mm:ss")}
                            </span>{" "}
                            anulada por RRHH{f.justificacion && <> · «{f.justificacion}»</>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Tiempo desde una entrada todavía abierta, que avanza cada segundo. `base` se
// suma al resultado (lo ya trabajado en tramos anteriores del día).
function DuracionEnCurso({ desde, base = 0 }: { desde: Date; base?: number }) {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const intervalo = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);
  return <>{formatDuracion(base + segundosEntre(desde, ahora))}</>;
}
