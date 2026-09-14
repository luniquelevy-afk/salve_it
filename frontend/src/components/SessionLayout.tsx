import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useIdleLogout } from '../hooks/useIdleLogout';

const IDLE_TIMEOUT_MINUTES = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 30);

export function SessionLayout() {
  const { signOut } = useAuth();
  useIdleLogout(IDLE_TIMEOUT_MINUTES, () => {
    void signOut('Vous avez été déconnecté après une période d’inactivité.');
  });
  return <Outlet />;
}
