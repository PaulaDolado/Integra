import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeProfile {
  id: string;
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  correo_electronico: string;
  numero_telefono?: string;
  cargo_nombre?: string;
  departamento_nombre?: string;
}

export function useEmployeeProfile() {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchEmployeeProfile() {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('empleados')
          .select(`
            id,
            nombre,
            primer_apellido,
            segundo_apellido,
            correo_electronico,
            numero_telefono,
            cargo_id,
            departamento_id
          `)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching employee profile:', error);
          setProfile(null);
        } else if (data) {
          // Fetch cargo and departamento names separately
          let cargoNombre = undefined;
          let departamentoNombre = undefined;

          if (data.cargo_id) {
            const { data: cargoData } = await supabase
              .from('cargos')
              .select('nombre')
              .eq('id', data.cargo_id)
              .single();
            cargoNombre = cargoData?.nombre;
          }

          if (data.departamento_id) {
            const { data: deptoData } = await supabase
              .from('departamentos')
              .select('nombre')
              .eq('id', data.departamento_id)
              .single();
            departamentoNombre = deptoData?.nombre;
          }

          setProfile({
            ...data,
            cargo_nombre: cargoNombre,
            departamento_nombre: departamentoNombre,
          });
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error fetching employee profile:', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }

    fetchEmployeeProfile();
  }, [user]);

  const getDisplayName = () => {
    if (profile) {
      return `${profile.nombre} ${profile.primer_apellido}`;
    }
    return user?.email?.split('@')[0] || 'Usuario';
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
    getFullName,
  };
}