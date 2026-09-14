import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Me } from '../lib/types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback(async (message?: string) => {
    await supabase.auth.signOut();
    setMe(null);
    setNotice(message ?? null);
  }, []);

  const loadMe = useCallback(
    async (current: Session | null) => {
      if (!current) {
        setMe(null);
        return;
      }
      try {
        setMe(await api<Me>('/api/me'));
        setNotice(null);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'account_suspended') {
          await signOut('Votre compte est suspendu. Contactez le centre.');
        } else if (err instanceof ApiError && err.status === 401) {
          await signOut('Votre session a expiré. Reconnectez-vous.');
        } else {
          setMe(null);
          setNotice(err instanceof Error ? err.message : 'Impossible de charger votre profil.');
        }
      }
    },
    [signOut],
  );

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadMe(data.session);
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED') {
        // Différé : appeler Supabase dans ce callback peut bloquer le client.
        setTimeout(() => void loadMe(next), 0);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      me,
      loading,
      notice,
      refreshMe: async () => {
        const { data } = await supabase.auth.getSession();
        await loadMe(data.session);
      },
      signOut,
      clearNotice: () => setNotice(null),
    }),
    [session, me, loading, notice, loadMe, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
