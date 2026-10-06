// Edge Function «calendario-ics»: el calendario de una persona en formato
// iCalendar, para suscribirse desde Google Calendar (u Outlook, o Apple).
//
// GET /functions/v1/calendario-ics?token=<token>
//
// Google pide el enlace sin iniciar sesión, así que no usa el JWT de Supabase:
// el token secreto de cada persona (tabla calendario_enlaces) hace de llave.
// Un token que no existe recibe la misma respuesta que uno mal escrito (404),
// para no dar pistas.

import { createClient } from "npm:@supabase/supabase-js@2";
import { calendarioIcs, tokenValido, type EventoIcs } from "./ics.ts";

const APP_URL = Deno.env.get("APP_URL") ?? "";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const texto = (cuerpo: string, status: number) =>
  new Response(cuerpo, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return texto("Método no permitido", 405);

  const token = new URL(req.url).searchParams.get("token");
  if (!tokenValido(token)) return texto("Calendario no encontrado", 404);

  // Los eventos y, a la vez, si el token existe (un enlace regenerado da 404,
  // no un calendario vacío, para que Google avise de que ya no funciona)
  const [{ data: eventos, error }, { count }] = await Promise.all([
    supabase.rpc("eventos_suscripcion_calendario", { p_token: token }),
    supabase.from("calendario_enlaces").select("empleado_id", { count: "exact", head: true }).eq("token", token),
  ]);
  if (error) {
    console.error("Error al leer el calendario:", error.message);
    return texto("No se pudo generar el calendario", 500);
  }
  if (!count) return texto("Calendario no encontrado", 404);

  const ics = calendarioIcs((eventos ?? []) as EventoIcs[], { urlApp: APP_URL || undefined });
  return new Response(req.method === "HEAD" ? null : ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="integra.ics"',
      // Son datos de una persona: que no los guarde ningún proxy intermedio
      "Cache-Control": "private, max-age=300",
    },
  });
});
