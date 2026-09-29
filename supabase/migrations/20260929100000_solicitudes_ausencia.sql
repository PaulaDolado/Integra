-- Amplía las solicitudes de vacaciones a solicitudes de ausencia
ALTER TABLE public.solicitudes_vacacion
  ADD COLUMN tipo_ausencia VARCHAR(50) NOT NULL DEFAULT 'vacaciones'
    CHECK (tipo_ausencia IN (
      'vacaciones',
      'compensacion_dias_trabajados',
      'asunto_familiar',
      'asunto_personal',
      'permisos',
      'teletrabajo',
      'visita_medica',
      'cuidado_hijos'
    )),
  ADD COLUMN razon_especifica VARCHAR(100),
  ADD COLUMN justificante_path TEXT;

-- Bucket privado para los justificantes
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('justificantes', 'justificantes', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Cada usuario gestiona los ficheros de su propia carpeta ({user_id}/...)
CREATE POLICY "Users can upload their own justificantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'justificantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own justificantes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'justificantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own justificantes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'justificantes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
