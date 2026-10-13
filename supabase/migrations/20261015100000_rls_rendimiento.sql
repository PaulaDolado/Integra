-- Rendimiento de las políticas RLS, sin cambiar quién ve o modifica qué.
-- Lo señalaba el analizador de rendimiento de Supabase:
--
--   auth_rls_initplan: auth.uid() dentro de la política se calculaba una vez
--   por fila. Envuelto en (SELECT ...), Postgres lo calcula una vez por consulta.
--   Igual con tengo_permiso(), que no depende de la fila.
--
--   multiple_permissive_policies: varias políticas permisivas para la misma
--   acción se evalúan todas en cada fila. Se juntan en una por acción con OR,
--   que es como Postgres ya las combinaba.
--
-- Las políticas restrictivas de doble factor no se tocan. Las que eran TO public
-- pasan a TO authenticated: sin sesión auth.uid() es NULL y nunca se cumplían.

-- Solo envolver auth.uid() -----------------------------------------------------------

DROP POLICY IF EXISTS "Cada usuario gestiona su bóveda" ON public.boveda_claves;
CREATE POLICY "Cada usuario gestiona su bóveda"
ON public.boveda_claves FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Cada usuario gestiona sus contraseñas" ON public.boveda_entradas;
CREATE POLICY "Cada usuario gestiona sus contraseñas"
ON public.boveda_entradas FOR ALL TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users manage their own payment data" ON public.datos_pago;
CREATE POLICY "Users manage their own payment data"
ON public.datos_pago FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = datos_pago.empleado_id AND empleados.user_id = (SELECT auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = datos_pago.empleado_id AND empleados.user_id = (SELECT auth.uid())
));

DROP POLICY IF EXISTS "Users can only view their own employee profile" ON public.empleados;
CREATE POLICY "Users can only view their own employee profile"
ON public.empleados FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Empleados editan su propio perfil" ON public.empleados;
CREATE POLICY "Empleados editan su propio perfil"
ON public.empleados FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own fichajes" ON public.fichajes;
CREATE POLICY "Users can create their own fichajes"
ON public.fichajes FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.empleados
  WHERE empleados.id = fichajes.empleado_id AND empleados.user_id = (SELECT auth.uid())
));

-- Fichajes: ver los propios o, con permiso, los de toda la plantilla --------------------

DROP POLICY IF EXISTS "Users can view their own fichajes" ON public.fichajes;
DROP POLICY IF EXISTS "Revisores ven los fichajes de la plantilla" ON public.fichajes;
DROP POLICY IF EXISTS "Ven los fichajes su empleado y los revisores" ON public.fichajes;
CREATE POLICY "Ven los fichajes su empleado y los revisores"
ON public.fichajes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = fichajes.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('fichajes.ver_todos'))
);

-- Ausencias: ver las propias o, con permiso, todas -----------------------------------------

DROP POLICY IF EXISTS "Users can only view their own vacation requests" ON public.solicitudes_vacacion;
DROP POLICY IF EXISTS "Revisores de ausencias ven todas las solicitudes" ON public.solicitudes_vacacion;
DROP POLICY IF EXISTS "Ven las solicitudes su empleado y los revisores" ON public.solicitudes_vacacion;
CREATE POLICY "Ven las solicitudes su empleado y los revisores"
ON public.solicitudes_vacacion FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = solicitudes_vacacion.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('ausencias.aprobar'))
);

-- Contactos de emergencia: los propios o, con permiso, los de cualquier empleado -------------

DROP POLICY IF EXISTS "Users manage their own emergency contacts" ON public.contactos_emergencia;
DROP POLICY IF EXISTS "RRHH consulta los contactos de emergencia" ON public.contactos_emergencia;
DROP POLICY IF EXISTS "RRHH añade contactos de emergencia" ON public.contactos_emergencia;
DROP POLICY IF EXISTS "RRHH modifica contactos de emergencia" ON public.contactos_emergencia;
DROP POLICY IF EXISTS "RRHH borra contactos de emergencia" ON public.contactos_emergencia;

DROP POLICY IF EXISTS "Contactos de emergencia: consultar" ON public.contactos_emergencia;
CREATE POLICY "Contactos de emergencia: consultar"
ON public.contactos_emergencia FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = contactos_emergencia.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('contactos_emergencia.ver'))
  OR (SELECT public.tengo_permiso('contactos_emergencia.editar'))
);

DROP POLICY IF EXISTS "Contactos de emergencia: añadir" ON public.contactos_emergencia;
CREATE POLICY "Contactos de emergencia: añadir"
ON public.contactos_emergencia FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = contactos_emergencia.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('contactos_emergencia.editar'))
);

DROP POLICY IF EXISTS "Contactos de emergencia: modificar" ON public.contactos_emergencia;
CREATE POLICY "Contactos de emergencia: modificar"
ON public.contactos_emergencia FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = contactos_emergencia.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('contactos_emergencia.editar'))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = contactos_emergencia.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('contactos_emergencia.editar'))
);

DROP POLICY IF EXISTS "Contactos de emergencia: borrar" ON public.contactos_emergencia;
CREATE POLICY "Contactos de emergencia: borrar"
ON public.contactos_emergencia FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.empleados
    WHERE empleados.id = contactos_emergencia.empleado_id AND empleados.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.tengo_permiso('contactos_emergencia.editar'))
);

-- Participantes de eventos: los ve quien ve el evento; los gestiona su creador ----------------

DROP POLICY IF EXISTS "El creador gestiona los participantes" ON public.evento_participantes;
DROP POLICY IF EXISTS "Participantes visibles si el evento es visible" ON public.evento_participantes;

-- puede_ver_evento() ya incluye al creador del evento
DROP POLICY IF EXISTS "Participantes: ver" ON public.evento_participantes;
CREATE POLICY "Participantes: ver"
ON public.evento_participantes FOR SELECT TO authenticated
USING (public.puede_ver_evento(evento_id));

DROP POLICY IF EXISTS "Participantes: añadir el creador" ON public.evento_participantes;
CREATE POLICY "Participantes: añadir el creador"
ON public.evento_participantes FOR INSERT TO authenticated
WITH CHECK (public.es_creador_evento(evento_id));

DROP POLICY IF EXISTS "Participantes: modificar el creador" ON public.evento_participantes;
CREATE POLICY "Participantes: modificar el creador"
ON public.evento_participantes FOR UPDATE TO authenticated
USING (public.es_creador_evento(evento_id))
WITH CHECK (public.es_creador_evento(evento_id));

DROP POLICY IF EXISTS "Participantes: quitar el creador" ON public.evento_participantes;
CREATE POLICY "Participantes: quitar el creador"
ON public.evento_participantes FOR DELETE TO authenticated
USING (public.es_creador_evento(evento_id));
