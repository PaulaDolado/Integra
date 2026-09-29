-- Chat interno: conversaciones 1 a 1 y de grupo, con mensajes en tiempo real.

CREATE TYPE conversacion_tipo AS ENUM ('directa', 'grupo');

CREATE TABLE public.conversaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo conversacion_tipo NOT NULL,
  nombre VARCHAR(100),
  creado_por UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  ultimo_mensaje_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT grupo_con_nombre CHECK (tipo = 'directa' OR nombre IS NOT NULL)
);

CREATE TABLE public.conversacion_participantes (
  conversacion_id UUID NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  empleado_id UUID NOT NULL REFERENCES public.empleados(id) ON DELETE CASCADE,
  ultimo_leido_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  PRIMARY KEY (conversacion_id, empleado_id)
);

CREATE TABLE public.mensajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversacion_id UUID NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES public.empleados(id) ON DELETE SET NULL,
  contenido TEXT NOT NULL CHECK (char_length(trim(contenido)) BETWEEN 1 AND 4000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX idx_participantes_empleado ON public.conversacion_participantes(empleado_id);
CREATE INDEX idx_mensajes_conversacion_fecha ON public.mensajes(conversacion_id, created_at DESC);

-- Funciones auxiliares ------------------------------------------------------

-- Empleado de la sesión actual
CREATE OR REPLACE FUNCTION public.mi_empleado_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.empleados WHERE user_id = auth.uid();
$$;

-- Evita recursión en las políticas RLS de participantes
CREATE OR REPLACE FUNCTION public.es_participante(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversacion_participantes
    WHERE conversacion_id = conv_id AND empleado_id = public.mi_empleado_id()
  );
$$;

-- Directorio de compañeros para iniciar chats: solo datos básicos, sin teléfono ni fechas
CREATE OR REPLACE FUNCTION public.directorio_empleados()
RETURNS TABLE (
  id UUID,
  nombre VARCHAR,
  primer_apellido VARCHAR,
  segundo_apellido VARCHAR,
  cargo VARCHAR,
  departamento VARCHAR
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.nombre, e.primer_apellido, e.segundo_apellido, c.nombre, d.nombre
  FROM public.empleados e
  LEFT JOIN public.cargos c ON c.id = e.cargo_id
  LEFT JOIN public.departamentos d ON d.id = e.departamento_id
  WHERE e.activo AND auth.uid() IS NOT NULL
  ORDER BY e.nombre, e.primer_apellido;
$$;

-- Abre la conversación directa con otro empleado, creándola si no existe
CREATE OR REPLACE FUNCTION public.abrir_conversacion_directa(otro_empleado_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  conv UUID;
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'No tienes perfil de empleado';
  END IF;
  IF otro_empleado_id = yo THEN
    RAISE EXCEPTION 'No puedes abrir una conversación contigo mismo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empleados WHERE id = otro_empleado_id AND activo) THEN
    RAISE EXCEPTION 'Empleado no encontrado';
  END IF;

  SELECT c.id INTO conv
  FROM public.conversaciones c
  JOIN public.conversacion_participantes p1 ON p1.conversacion_id = c.id AND p1.empleado_id = yo
  JOIN public.conversacion_participantes p2 ON p2.conversacion_id = c.id AND p2.empleado_id = otro_empleado_id
  WHERE c.tipo = 'directa'
  LIMIT 1;

  IF conv IS NULL THEN
    INSERT INTO public.conversaciones (tipo, creado_por) VALUES ('directa', yo) RETURNING id INTO conv;
    INSERT INTO public.conversacion_participantes (conversacion_id, empleado_id)
    VALUES (conv, yo), (conv, otro_empleado_id);
  END IF;

  RETURN conv;
END;
$$;

-- Crea un grupo con el usuario actual y los empleados indicados
CREATE OR REPLACE FUNCTION public.crear_grupo(nombre_grupo TEXT, participantes UUID[])
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  yo UUID := public.mi_empleado_id();
  conv UUID;
BEGIN
  IF yo IS NULL THEN
    RAISE EXCEPTION 'No tienes perfil de empleado';
  END IF;
  IF coalesce(trim(nombre_grupo), '') = '' THEN
    RAISE EXCEPTION 'El grupo necesita un nombre';
  END IF;

  INSERT INTO public.conversaciones (tipo, nombre, creado_por)
  VALUES ('grupo', trim(nombre_grupo), yo)
  RETURNING id INTO conv;

  INSERT INTO public.conversacion_participantes (conversacion_id, empleado_id)
  SELECT conv, e.id
  FROM public.empleados e
  WHERE e.activo AND (e.id = yo OR e.id = ANY (participantes));

  RETURN conv;
END;
$$;

-- Conversaciones del usuario con su último mensaje y los no leídos
CREATE OR REPLACE FUNCTION public.mis_conversaciones()
RETURNS TABLE (
  id UUID,
  tipo conversacion_tipo,
  nombre TEXT,
  otro_empleado_id UUID,
  num_participantes INTEGER,
  ultimo_mensaje TEXT,
  ultimo_mensaje_autor_id UUID,
  ultimo_mensaje_at TIMESTAMP WITH TIME ZONE,
  no_leidos INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH yo AS (SELECT public.mi_empleado_id() AS id)
  SELECT
    c.id,
    c.tipo,
    CASE
      WHEN c.tipo = 'grupo' THEN c.nombre::TEXT
      ELSE (SELECT e.nombre || ' ' || e.primer_apellido
            FROM public.conversacion_participantes op
            JOIN public.empleados e ON e.id = op.empleado_id
            WHERE op.conversacion_id = c.id AND op.empleado_id <> yo.id
            LIMIT 1)
    END,
    CASE WHEN c.tipo = 'directa' THEN
      (SELECT op.empleado_id FROM public.conversacion_participantes op
       WHERE op.conversacion_id = c.id AND op.empleado_id <> yo.id LIMIT 1)
    END,
    (SELECT count(*)::INTEGER FROM public.conversacion_participantes cp WHERE cp.conversacion_id = c.id),
    um.contenido,
    um.autor_id,
    coalesce(um.created_at, c.created_at),
    (SELECT count(*)::INTEGER FROM public.mensajes m
     WHERE m.conversacion_id = c.id
       AND m.created_at > p.ultimo_leido_at
       AND m.autor_id IS DISTINCT FROM yo.id)
  FROM yo
  JOIN public.conversacion_participantes p ON p.empleado_id = yo.id
  JOIN public.conversaciones c ON c.id = p.conversacion_id
  LEFT JOIN LATERAL (
    SELECT m.contenido, m.autor_id, m.created_at
    FROM public.mensajes m
    WHERE m.conversacion_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) um ON true
  ORDER BY coalesce(um.created_at, c.created_at) DESC;
$$;

-- Marca la conversación como leída hasta ahora
CREATE OR REPLACE FUNCTION public.marcar_conversacion_leida(conv_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.conversacion_participantes
  SET ultimo_leido_at = now()
  WHERE conversacion_id = conv_id AND empleado_id = public.mi_empleado_id();
$$;

-- Mantiene ordenada la lista de conversaciones por actividad
CREATE OR REPLACE FUNCTION public.actualizar_ultimo_mensaje()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversaciones SET ultimo_mensaje_at = NEW.created_at WHERE id = NEW.conversacion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mensajes_actualizar_conversacion
AFTER INSERT ON public.mensajes
FOR EACH ROW EXECUTE FUNCTION public.actualizar_ultimo_mensaje();

-- Seguridad ----------------------------------------------------------------

ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversacion_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

-- Las conversaciones y participantes se crean mediante las funciones de arriba
CREATE POLICY "Participantes ven sus conversaciones"
ON public.conversaciones FOR SELECT TO authenticated
USING (public.es_participante(id));

CREATE POLICY "Participantes ven a los demás participantes"
ON public.conversacion_participantes FOR SELECT TO authenticated
USING (public.es_participante(conversacion_id));

CREATE POLICY "Participantes leen los mensajes"
ON public.mensajes FOR SELECT TO authenticated
USING (public.es_participante(conversacion_id));

CREATE POLICY "Participantes envían mensajes propios"
ON public.mensajes FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id() AND public.es_participante(conversacion_id));

-- Las funciones del chat solo están disponibles con sesión iniciada
REVOKE EXECUTE ON FUNCTION public.directorio_empleados() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.abrir_conversacion_directa(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_grupo(TEXT, UUID[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mis_conversaciones() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.marcar_conversacion_leida(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directorio_empleados() TO authenticated;
GRANT EXECUTE ON FUNCTION public.abrir_conversacion_directa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_grupo(TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mis_conversaciones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_conversacion_leida(UUID) TO authenticated;

-- Tiempo real: los clientes reciben los mensajes nuevos (respetando RLS)
ALTER PUBLICATION supabase_realtime ADD TABLE public.mensajes;
