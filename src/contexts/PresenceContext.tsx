import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeProfile } from '@/hooks/useEmployeeProfile';

// Empleados con la app abierta en este momento (Supabase Realtime Presence)
const PresenceContext = createContext<Set<string>>(new Set());

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useEmployeeProfile();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const empleadoId = profile?.id;

  useEffect(() => {
    if (!empleadoId) return;

    const channel = supabase.channel('integra-presencia', {
      config: { presence: { key: empleadoId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empleadoId]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

export function useOnlineEmployees() {
  return useContext(PresenceContext);
}
