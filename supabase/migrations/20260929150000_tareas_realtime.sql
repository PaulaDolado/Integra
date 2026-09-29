-- Publica los cambios de tareas en tiempo real (kanban y widget del dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tareas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
  END IF;
END $$;

-- Incluye la fila completa en los eventos de actualización y borrado
ALTER TABLE public.tareas REPLICA IDENTITY FULL;
