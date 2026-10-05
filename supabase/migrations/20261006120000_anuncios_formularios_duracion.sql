-- Tablón de anuncios: notas con enlace a un formulario y duración configurable.

-- Una nota puede ser un comunicado o un formulario (con enlace para rellenarlo)
ALTER TABLE public.anuncios
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'comunicado'
    CHECK (tipo IN ('comunicado', 'formulario')),
  ADD COLUMN IF NOT EXISTS enlace TEXT
    CHECK (enlace IS NULL OR enlace ~* '^https?://'),
  -- Hasta cuándo sigue en el tablón (NULL = fijo, no caduca)
  ADD COLUMN IF NOT EXISTS fecha_fin TIMESTAMPTZ;

ALTER TABLE public.anuncios
  DROP CONSTRAINT IF EXISTS anuncios_formulario_con_enlace;
ALTER TABLE public.anuncios
  ADD CONSTRAINT anuncios_formulario_con_enlace
    CHECK (tipo <> 'formulario' OR enlace IS NOT NULL);

ALTER TABLE public.anuncios
  DROP CONSTRAINT IF EXISTS anuncios_fin_posterior;
ALTER TABLE public.anuncios
  ADD CONSTRAINT anuncios_fin_posterior
    CHECK (fecha_fin IS NULL OR fecha_fin > fecha_publicacion);

-- Hasta ahora cada comunicado solo se veía en el mes de su publicación
UPDATE public.anuncios
SET fecha_fin = (date_trunc('month', fecha_publicacion AT TIME ZONE 'Europe/Madrid') + INTERVAL '1 month')
                  AT TIME ZONE 'Europe/Madrid'
WHERE fecha_fin IS NULL;
