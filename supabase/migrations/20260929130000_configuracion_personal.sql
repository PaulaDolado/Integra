-- Configuración personal: datos de contacto, idioma y consentimientos del directorio
ALTER TABLE public.empleados
  ADD COLUMN direccion VARCHAR(255),
  ADD COLUMN complemento_direccion VARCHAR(255),
  ADD COLUMN codigo_postal VARCHAR(20),
  ADD COLUMN ciudad VARCHAR(100),
  ADD COLUMN pais VARCHAR(100) DEFAULT 'España',
  ADD COLUMN idioma VARCHAR(5) NOT NULL DEFAULT 'es' CHECK (idioma IN ('es', 'ca', 'en')),
  ADD COLUMN mostrar_telefono_directorio BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN mostrar_email_directorio BOOLEAN NOT NULL DEFAULT false;

-- Contactos de emergencia
CREATE TABLE public.contactos_emergencia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  nombre VARCHAR(255) NOT NULL,
  relacion VARCHAR(100),
  telefono VARCHAR(30) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contactos_emergencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own emergency contacts"
ON public.contactos_emergencia
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = contactos_emergencia.empleado_id
  AND empleados.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = contactos_emergencia.empleado_id
  AND empleados.user_id = auth.uid()
));

CREATE INDEX idx_contactos_emergencia_empleado_id ON public.contactos_emergencia(empleado_id);

-- Información de pago de la nómina (un registro por empleado)
CREATE TABLE public.datos_pago (
  empleado_id UUID NOT NULL PRIMARY KEY REFERENCES public.empleados(id) ON DELETE CASCADE,
  forma_pago VARCHAR(20) NOT NULL DEFAULT 'transferencia' CHECK (forma_pago IN ('transferencia')),
  iban VARCHAR(34),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.datos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own payment data"
ON public.datos_pago
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = datos_pago.empleado_id
  AND empleados.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = datos_pago.empleado_id
  AND empleados.user_id = auth.uid()
));

CREATE TRIGGER update_datos_pago_updated_at
BEFORE UPDATE ON public.datos_pago
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- El directorio muestra teléfono y email solo si el empleado lo ha aceptado
DROP FUNCTION IF EXISTS public.directorio_empleados();

CREATE FUNCTION public.directorio_empleados()
RETURNS TABLE (
  id UUID,
  nombre VARCHAR,
  primer_apellido VARCHAR,
  segundo_apellido VARCHAR,
  cargo VARCHAR,
  departamento VARCHAR,
  numero_telefono VARCHAR,
  correo_electronico VARCHAR
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    e.id, e.nombre, e.primer_apellido, e.segundo_apellido, c.nombre, d.nombre,
    CASE WHEN e.mostrar_telefono_directorio THEN e.numero_telefono END,
    CASE WHEN e.mostrar_email_directorio THEN e.correo_electronico END
  FROM public.empleados e
  LEFT JOIN public.cargos c ON c.id = e.cargo_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE e.activo AND auth.uid() IS NOT NULL
  ORDER BY e.nombre, e.primer_apellido;
$$;

REVOKE EXECUTE ON FUNCTION public.directorio_empleados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directorio_empleados() TO authenticated;
