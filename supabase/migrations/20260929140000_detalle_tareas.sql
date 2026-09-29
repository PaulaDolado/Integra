-- Ficha de tarea ampliada: resumen, imagen, subtareas, etiquetas, propiedades y tiempo
ALTER TABLE public.tareas
  ALTER COLUMN proyecto_id DROP NOT NULL,
  ADD COLUMN resumen VARCHAR(255),
  ADD COLUMN imagen_path TEXT,
  -- [{ "id": "...", "titulo": "...", "completada": false }]
  ADD COLUMN subtareas JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN etiquetas TEXT[] NOT NULL DEFAULT '{}',
  -- { "coste": "120 €", ... }
  ADD COLUMN propiedades JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN tiempo_estimado_min INTEGER CHECK (tiempo_estimado_min >= 0),
  ADD COLUMN tiempo_real_min INTEGER NOT NULL DEFAULT 0 CHECK (tiempo_real_min >= 0);

-- Imágenes de las tareas: las sube cada usuario en su carpeta ({user_id}/...)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('tareas', 'tareas', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Las tareas son visibles para cualquier usuario autenticado, igual que sus imágenes
CREATE POLICY "Authenticated users can view task images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'tareas');

CREATE POLICY "Users can upload their own task images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tareas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own task images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'tareas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
