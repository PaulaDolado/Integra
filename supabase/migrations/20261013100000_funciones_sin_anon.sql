-- Permisos de ejecución de cuatro funciones de las primeras migraciones, que
-- se crearon sin REVOKE y quedaron abiertas a PUBLIC (y, por tanto, a anon).
-- Lo señalaba el analizador de seguridad de Supabase
-- (anon_security_definer_function_executable). Sin sesión no exponían nada,
-- pero ninguna lo necesita.

-- Las usan las políticas RLS, todas para authenticated
REVOKE EXECUTE ON FUNCTION public.mi_empleado_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_empleado_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.es_participante(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_participante(UUID) TO authenticated;

-- Triggers: se disparan solos (no comprueban el permiso de quien escribe) y
-- nadie debe llamarlos directamente
REVOKE EXECUTE ON FUNCTION public.actualizar_ultimo_mensaje() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
