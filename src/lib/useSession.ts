import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Tracks the Supabase auth session and whether the signed-in user is an admin.
 * `loading` covers the initial session lookup + admin check so the app can show
 * a spinner instead of flashing the login screen on refresh.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function resolveAdmin(s: Session | null) {
      if (!s) {
        if (active) setIsAdmin(false);
        return;
      }
      // is_admin() is a SECURITY DEFINER RPC — returns true only for admins.
      const { data, error } = await supabase.rpc('is_admin');
      if (active) setIsAdmin(!error && data === true);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await resolveAdmin(data.session);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!active) return;
      setSession(s);
      await resolveAdmin(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, isAdmin, loading };
}
