import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { comprobar, queryClient } from '@/lib/query-client';

interface EmployeeProfile {
  id: string;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  correo_electronico: string;
  numero_telefono: string | null;
  cargo_nombre?: string;
  departamento_nombre?: string;
}

const CLAVE_PERFIL = 'perfil';

// Avisa a todos los componentes que usan el perfil de que deben recargarlo
export function notifyEmployeeProfileUpdated() {
  queryClient.invalidateQueries({ queryKey: [CLAVE_PERFIL] });
}

async function cargarPerfil(userId: string): Promise<EmployeeProfile | null> {
  const data = comprobar(
    await supabase
      .from('empleados')
      // El departamento se indica por su clave: departamentos también apunta a
      // empleados (el jefe) y, sin ella, la API rechaza la consulta por ambigua
      .select(`
        id,
        nombre,
        primer_apellido,
        segundo_apellido,
        correo_electronico,
        numero_telefono,
        cargo:cargos(nombre),
        departamento:departamentos!empleados_departamento_id_fkey(nombre)
      `)
      .eq('user_id', userId)
      .maybeSingle()
  );
  if (!data) return null;

  const { cargo, departamento, ...empleado } = data;
  return {
    ...empleado,
    cargo_nombre: cargo?.nombre,
    departamento_nombre: departamento?.nombre,
  };
}

export function useEmployeeProfile() {
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: [CLAVE_PERFIL, user?.id],
    queryFn: () => cargarPerfil(user!.id),
    enabled: !!user,
  });
  useEffect(() => {
    if (error) console.error('Error fetching employee profile:', error);
  }, [error]);

  const profile = data ?? null;
  const loading = !!user && isPending;

  const getDisplayName = () => {
    if (profile) {
      return `${profile.nombre} ${profile.primer_apellido}`;
    }
    return user?.email?.split('@')[0] || 'Usuario';
  };

  const getFirstName = () => {
    if (profile) {
      return profile.nombre;
    }
    return getDisplayName();
  };

  const getFullName = () => {
    if (profile) {
      return `${profile.nombre} ${profile.primer_apellido} ${profile.segundo_apellido}`;
    }
    return getDisplayName();
  };

  return {
    profile,
    loading,
    getDisplayName,
    getFirstName,
    getFullName,
  };
}
