import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export function useActivityTracker(feature: string, action: string = 'visit') {
  const { user } = useAuth();
  const logged = useRef(false);

  useEffect(() => {
    if (!user || logged.current) return;
    logged.current = true;

    supabase
      .from('activity_logs')
      .insert({ user_id: user.id, feature, action } as any)
      .then(({ error }) => {
        if (error) console.error('Activity log error:', error);
      });
  }, [user, feature, action]);
}
