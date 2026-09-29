-- Endurece los permisos de la base de datos.
-- Hasta ahora casi todas las tablas permitían a cualquier usuario autenticado
-- crear, modificar y borrar cualquier fila ("FOR ALL ... USING (true)").

-- Funciones auxiliares ------------------------------------------------------

-- Evita que un search_path manipulado cambie el comportamiento del trigger
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- true si la sesión cumple el doble factor: o el usuario no lo tiene activado,
-- o ya ha verificado el código (nivel aal2)
CREATE OR REPLACE FUNCTION public.cumple_doble_factor()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors
      WHERE user_id = auth.uid() AND status = 'verified'
    );
$$;

REVOKE EXECUTE ON FUNCTION public.cumple_doble_factor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cumple_doble_factor() TO authenticated;

-- Catálogos de solo lectura (se gestionan desde el panel de Supabase) --------

DROP POLICY IF EXISTS "Cargos are manageable by authenticated users" ON public.cargos;
DROP POLICY IF EXISTS "Departamentos are manageable by authenticated users" ON public.departamentos;
DROP POLICY IF EXISTS "Proyectos are manageable by authenticated users" ON public.proyectos;
DROP POLICY IF EXISTS "Proyecto miembros are manageable by authenticated users" ON public.proyecto_miembros;

-- Empleados: cada uno solo edita sus datos personales -------------------------

-- El perfil lo crea RR. HH.; un usuario no puede darse de alta ni cambiar su
-- cargo, departamento, estado, correo corporativo o fecha de ingreso
DROP POLICY IF EXISTS "Empleados can insert their own profile" ON public.empleados;
DROP POLICY IF EXISTS "Empleados can update their own profile" ON public.empleados;

DROP POLICY IF EXISTS "Empleados editan su propio perfil" ON public.empleados;
CREATE POLICY "Empleados editan su propio perfil"
ON public.empleados FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.empleados FROM anon, authenticated;
GRANT UPDATE (
  nombre, primer_apellido, segundo_apellido, numero_telefono,
  direccion, complemento_direccion, codigo_postal, ciudad, pais, idioma,
  mostrar_telefono_directorio, mostrar_email_directorio
) ON public.empleados TO authenticated;

-- Solicitudes de ausencia: nadie puede aprobarse sus propias solicitudes ------

DROP POLICY IF EXISTS "Users can manage their own vacation requests" ON public.solicitudes_vacacion;

DROP POLICY IF EXISTS "Empleados crean sus solicitudes pendientes" ON public.solicitudes_vacacion;
CREATE POLICY "Empleados crean sus solicitudes pendientes"
ON public.solicitudes_vacacion FOR INSERT TO authenticated
WITH CHECK (empleado_id = public.mi_empleado_id() AND estado = 'pendiente');

DROP POLICY IF EXISTS "Empleados cancelan sus solicitudes pendientes" ON public.solicitudes_vacacion;
CREATE POLICY "Empleados cancelan sus solicitudes pendientes"
ON public.solicitudes_vacacion FOR DELETE TO authenticated
USING (empleado_id = public.mi_empleado_id() AND estado = 'pendiente');

REVOKE UPDATE ON public.solicitudes_vacacion FROM anon, authenticated;

-- Fichajes: la hora la pone el servidor, no el navegador ----------------------

CREATE OR REPLACE FUNCTION public.fijar_hora_fichaje()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.fecha_hora := now();
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fijar_hora_fichaje ON public.fichajes;
CREATE TRIGGER fijar_hora_fichaje
BEFORE INSERT ON public.fichajes
FOR EACH ROW EXECUTE FUNCTION public.fijar_hora_fichaje();

REVOKE UPDATE, DELETE ON public.fichajes FROM anon, authenticated;

-- Tareas: solo las ve y gestiona la persona asignada -------------------------

DROP POLICY IF EXISTS "Tareas are viewable by authenticated users" ON public.tareas;
DROP POLICY IF EXISTS "Tareas are manageable by authenticated users" ON public.tareas;

DROP POLICY IF EXISTS "Empleados ven sus tareas" ON public.tareas;
CREATE POLICY "Empleados ven sus tareas"
ON public.tareas FOR SELECT TO authenticated
USING (asignado_a_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Empleados crean sus tareas" ON public.tareas;
CREATE POLICY "Empleados crean sus tareas"
ON public.tareas FOR INSERT TO authenticated
WITH CHECK (asignado_a_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Empleados editan sus tareas" ON public.tareas;
CREATE POLICY "Empleados editan sus tareas"
ON public.tareas FOR UPDATE TO authenticated
USING (asignado_a_id = public.mi_empleado_id())
WITH CHECK (asignado_a_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Empleados borran sus tareas" ON public.tareas;
CREATE POLICY "Empleados borran sus tareas"
ON public.tareas FOR DELETE TO authenticated
USING (asignado_a_id = public.mi_empleado_id());

-- Las imágenes de tareas pasan a ser visibles solo para quien las subió
DROP POLICY IF EXISTS "Authenticated users can view task images" ON storage.objects;

DROP POLICY IF EXISTS "Users can view their own task images" ON storage.objects;
CREATE POLICY "Users can view their own task images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tareas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Tickets: los ven y gestionan el autor y la persona asignada -----------------

DROP POLICY IF EXISTS "Tickets are viewable by authenticated users" ON public.tickets;
DROP POLICY IF EXISTS "Tickets are manageable by authenticated users" ON public.tickets;

DROP POLICY IF EXISTS "Autor y asignado ven el ticket" ON public.tickets;
CREATE POLICY "Autor y asignado ven el ticket"
ON public.tickets FOR SELECT TO authenticated
USING (autor_id = public.mi_empleado_id() OR asignado_a_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Empleados abren tickets propios" ON public.tickets;
CREATE POLICY "Empleados abren tickets propios"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Autor y asignado actualizan el ticket" ON public.tickets;
CREATE POLICY "Autor y asignado actualizan el ticket"
ON public.tickets FOR UPDATE TO authenticated
USING (autor_id = public.mi_empleado_id() OR asignado_a_id = public.mi_empleado_id())
WITH CHECK (autor_id = public.mi_empleado_id() OR asignado_a_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "El autor borra el ticket" ON public.tickets;
CREATE POLICY "El autor borra el ticket"
ON public.tickets FOR DELETE TO authenticated
USING (autor_id = public.mi_empleado_id());

-- Eventos: los privados solo los ven su creador y sus participantes -----------

-- Las políticas de eventos y participantes se consultan entre sí; estas
-- funciones evitan la recursión infinita en RLS
CREATE OR REPLACE FUNCTION public.participa_en_evento(ev UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.evento_participantes
    WHERE evento_id = ev AND empleado_id = public.mi_empleado_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.es_creador_evento(ev UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.eventos
    WHERE id = ev AND creador_id = public.mi_empleado_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_evento(ev UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.eventos
    WHERE id = ev
      AND (NOT es_privado OR creador_id = public.mi_empleado_id() OR public.participa_en_evento(ev))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.participa_en_evento(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_creador_evento(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_ver_evento(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.participa_en_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_creador_evento(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_evento(UUID) TO authenticated;

DROP POLICY IF EXISTS "Eventos are viewable by authenticated users" ON public.eventos;
DROP POLICY IF EXISTS "Eventos are manageable by authenticated users" ON public.eventos;

DROP POLICY IF EXISTS "Eventos públicos, propios o en los que participo" ON public.eventos;
CREATE POLICY "Eventos públicos, propios o en los que participo"
ON public.eventos FOR SELECT TO authenticated
USING (
  NOT es_privado
  OR creador_id = public.mi_empleado_id()
  OR public.participa_en_evento(id)
);

DROP POLICY IF EXISTS "Empleados crean sus eventos" ON public.eventos;
CREATE POLICY "Empleados crean sus eventos"
ON public.eventos FOR INSERT TO authenticated
WITH CHECK (creador_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "El creador edita el evento" ON public.eventos;
CREATE POLICY "El creador edita el evento"
ON public.eventos FOR UPDATE TO authenticated
USING (creador_id = public.mi_empleado_id())
WITH CHECK (creador_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "El creador borra el evento" ON public.eventos;
CREATE POLICY "El creador borra el evento"
ON public.eventos FOR DELETE TO authenticated
USING (creador_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "Evento participantes are viewable by authenticated users" ON public.evento_participantes;
DROP POLICY IF EXISTS "Evento participantes are manageable by authenticated users" ON public.evento_participantes;

DROP POLICY IF EXISTS "Participantes visibles si el evento es visible" ON public.evento_participantes;
CREATE POLICY "Participantes visibles si el evento es visible"
ON public.evento_participantes FOR SELECT TO authenticated
USING (public.puede_ver_evento(evento_id));

DROP POLICY IF EXISTS "El creador gestiona los participantes" ON public.evento_participantes;
CREATE POLICY "El creador gestiona los participantes"
ON public.evento_participantes FOR ALL TO authenticated
USING (public.es_creador_evento(evento_id))
WITH CHECK (public.es_creador_evento(evento_id));

-- Noticias: todos las leen; cada autor gestiona las suyas ---------------------

DROP POLICY IF EXISTS "Anuncios are manageable by authenticated users" ON public.anuncios;

DROP POLICY IF EXISTS "Empleados publican noticias propias" ON public.anuncios;
CREATE POLICY "Empleados publican noticias propias"
ON public.anuncios FOR INSERT TO authenticated
WITH CHECK (autor_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "El autor edita su noticia" ON public.anuncios;
CREATE POLICY "El autor edita su noticia"
ON public.anuncios FOR UPDATE TO authenticated
USING (autor_id = public.mi_empleado_id())
WITH CHECK (autor_id = public.mi_empleado_id());

DROP POLICY IF EXISTS "El autor borra su noticia" ON public.anuncios;
CREATE POLICY "El autor borra su noticia"
ON public.anuncios FOR DELETE TO authenticated
USING (autor_id = public.mi_empleado_id());

-- Doble factor obligatorio en la base de datos -------------------------------

-- Si un usuario tiene el 2FA activado, una sesión que solo ha puesto la
-- contraseña no puede leer ni escribir nada hasta verificar el código
DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOR tabla IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Exige doble factor si está activado" ON public.%I', tabla);
    EXECUTE format(
      'CREATE POLICY "Exige doble factor si está activado" ON public.%I '
      'AS RESTRICTIVE FOR ALL TO authenticated '
      'USING ((SELECT public.cumple_doble_factor())) '
      'WITH CHECK ((SELECT public.cumple_doble_factor()))',
      tabla
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Exige doble factor si está activado" ON storage.objects;
CREATE POLICY "Exige doble factor si está activado"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT public.cumple_doble_factor()))
WITH CHECK ((SELECT public.cumple_doble_factor()));
