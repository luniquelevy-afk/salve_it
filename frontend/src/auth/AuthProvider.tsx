import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { auth } from '../lib/firebase';
import type { Me } from '../lib/types';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<User | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback(async (message?: string) => {
    await firebaseSignOut(auth);
    setMe(null);
    setNotice(message ?? null);
  }, []);

  const loadMe = useCallback(
    async (current: User | null) => {
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
    // Premier appel : session restaurée (ou absente) ; ensuite à chaque connexion / déconnexion.
    return onAuthStateChanged(auth, (user) => {
      setSession(user);
      void loadMe(user).finally(() => setLoading(false));
    });
  }, [loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      me,
      loading,
      notice,
      refreshMe: () => loadMe(auth.currentUser),
      signOut,
      clearNotice: () => setNotice(null),
    }),
    [session, me, loading, notice, loadMe, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
