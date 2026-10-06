-- nota_de_texto() con search_path fijo, como las demás funciones. Lo señalaba
-- el analizador de seguridad de Supabase (function_search_path_mutable).

CREATE OR REPLACE FUNCTION public.nota_de_texto(p_texto TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE
    WHEN p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_texto::uuid
  END;
$$;
