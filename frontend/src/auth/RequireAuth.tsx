import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullPageMessage } from '../components/FullPageMessage';
import { homeFor, type AppRole } from '../lib/types';
import { useAuth } from './auth-context';

// Garde d'interface uniquement : l'autorisation réelle est appliquée par l'API et la RLS.
export function RequireAuth({ roles }: { roles?: AppRole[] }) {
  const { session, me, loading, notice, refreshMe } = useAuth();
  const location = useLocation();

  if (loading || (session && !me && !notice)) {
    return <FullPageMessage title="Chargement…" />;
  }
  if (!session) {
    return <Navigate to="/connexion" replace state={{ from: location.pathname }} />;
  }
  if (!me) {
    return (
      <FullPageMessage title="Profil indisponible" message={notice ?? undefined}>
        <button className="btn-primary" onClick={() => void refreshMe()}>
          Réessayer
        </button>
      </FullPageMessage>
    );
  }
  if (me.mustChangePassword && location.pathname !== '/mot-de-passe') {
    return <Navigate to="/mot-de-passe" replace />;
  }
  if (!me.mustChangePassword && me.mfaRequired && location.pathname !== '/mfa') {
    return <Navigate to="/mfa" replace />;
  }
  if (roles && !roles.includes(me.role)) {
    return <Navigate to={homeFor(me.role)} replace />;
  }
  return <Outlet />;
}
