import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useIdleLogout } from '../hooks/useIdleLogout';
import { api } from '../lib/api';

// Repli avant le chargement du réglage serveur, ou si l'API est indisponible (ENF-03).
const FALLBACK_IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 30);

export function SessionLayout() {
  const { signOut } = useAuth();
  // EF-05 / §22 #5 : la durée d'inactivité est administrable, chargée à la connexion.
  const [timeoutMinutes, setTimeoutMinutes] = useState(FALLBACK_IDLE_MINUTES);

  useEffect(() => {
    let active = true;
    api<{ idleTimeoutMinutes: number }>('/api/me/session-settings')
      .then((settings) => {
        if (active && Number.isFinite(settings.idleTimeoutMinutes)) setTimeoutMinutes(settings.idleTimeoutMinutes);
      })
      .catch(() => undefined); // le repli reste en vigueur
    return () => {
      active = false;
    };
  }, []);

  useIdleLogout(timeoutMinutes, () => {
    void signOut('Vous avez été déconnecté après une période d’inactivité.');
  });
  return <Outlet />;
}
