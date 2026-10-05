-- Los justificantes solo admitían ficheros de hasta 5 MB, de cualquier tipo.
-- Se limitan a los mismos tipos que ofrece el formulario: PDF, imágenes y Word.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'justificantes';
