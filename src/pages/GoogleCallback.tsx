import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Google vuelve aquí tras pedir permiso para leer el calendario. Esta página le
// pasa el código a la Edge Function, que lo cambia por los tokens, y vuelve al
// Calendario con el resultado (?google=conectado|cancelado|caducado|error).
export default function GoogleCallback() {
  const [parametros] = useSearchParams();
  const navigate = useNavigate();
  // En desarrollo React monta dos veces: el código de Google solo vale una
  const enviado = useRef(false);

  useEffect(() => {
    if (enviado.current) return;
    enviado.current = true;

    const terminar = (resultado: string) => navigate(`/calendario?google=${resultado}`, { replace: true });
    supabase.functions
      .invoke("google-calendar", {
        body: {
          accion: "completar",
          code: parametros.get("code"),
          state: parametros.get("state"),
          error: parametros.get("error"),
        },
      })
      .then(({ data, error }) => terminar(error ? "error" : (data?.resultado ?? "error")))
      .catch(() => terminar("error"));
  }, [parametros, navigate]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      <p>Conectando con Google Calendar…</p>
    </div>
  );
}
