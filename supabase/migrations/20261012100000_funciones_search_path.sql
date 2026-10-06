-- search_path fijo en las tres funciones que aún no lo tenían. Lo señalaba el
-- analizador de seguridad de Supabase (function_search_path_mutable).
-- Solo usan funciones nativas de Postgres, así que su comportamiento no cambia.

ALTER FUNCTION public.etiqueta_ticket(TEXT) SET search_path = public;
ALTER FUNCTION public.rango_fechas(DATE, DATE) SET search_path = public;
ALTER FUNCTION public.nuevo_token_calendario() SET search_path = public;
