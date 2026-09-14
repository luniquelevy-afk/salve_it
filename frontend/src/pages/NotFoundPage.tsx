import { Link } from 'react-router-dom';
import { FullPageMessage } from '../components/FullPageMessage';

export function NotFoundPage() {
  return (
    <FullPageMessage title="Page introuvable" message="Cette page n’existe pas ou a été déplacée.">
      <Link to="/" className="btn-primary">Retour à l’accueil</Link>
    </FullPageMessage>
  );
}
