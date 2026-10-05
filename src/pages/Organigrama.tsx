import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Crown, Loader2, Network, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { comprobar } from "@/lib/query-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// Solo nombre, puesto y departamento: el organigrama no muestra datos personales
type Persona = Database["public"]["Functions"]["organigrama"]["Returns"][number];

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase();

export default function Organigrama() {
  const [busqueda, setBusqueda] = useState("");
  const { data: personas = [], isPending: loading } = useQuery({
    queryKey: ["organigrama"],
    queryFn: async () => comprobar(await supabase.rpc("organigrama")) ?? [],
  });

  const texto = busqueda.trim().toLowerCase();
  const grupos = useMemo(() => {
    const visibles = personas.filter(
      (p) =>
        !texto ||
        p.nombre.toLowerCase().includes(texto) ||
        (p.cargo ?? "").toLowerCase().includes(texto) ||
        (p.departamento ?? "").toLowerCase().includes(texto)
    );
    const mapa = new Map<string, { nombre: string; personas: Persona[] }>();
    for (const p of visibles) {
      const clave = p.departamento_id ?? "sin-departamento";
      if (!mapa.has(clave)) mapa.set(clave, { nombre: p.departamento ?? "Sin departamento", personas: [] });
      mapa.get(clave)!.personas.push(p);
    }
    return [...mapa.values()];
  }, [personas, texto]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Organigrama
          </h1>
          <p className="text-muted-foreground mt-1">Quién es quién en la empresa, por departamento.</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar persona, puesto o departamento..."
            aria-label="Buscar persona, puesto o departamento"
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No hay personas que coincidan</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {grupos.map((g) => (
            <Card key={g.nombre}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {g.nombre}
                  </span>
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {g.personas.length} persona{g.personas.length === 1 ? "" : "s"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {g.personas.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={`text-xs font-medium ${p.es_responsable ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}
                        >
                          {iniciales(p.nombre)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {p.nombre}
                          {p.es_responsable && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Responsable del departamento" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.es_responsable ? "Responsable · " : ""}
                          {p.cargo ?? "Sin puesto asignado"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
