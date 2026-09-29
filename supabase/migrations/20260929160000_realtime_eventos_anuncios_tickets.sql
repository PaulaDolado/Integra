-- Publica en tiempo real los cambios del calendario, las noticias y los tickets
DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['eventos', 'anuncios', 'tickets'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabla);
    END IF;
  END LOOP;
END $$;

-- Incluye la fila completa en los eventos de actualización y borrado
ALTER TABLE public.eventos REPLICA IDENTITY FULL;
ALTER TABLE public.anuncios REPLICA IDENTITY FULL;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
