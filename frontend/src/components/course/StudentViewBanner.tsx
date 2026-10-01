import { Link } from 'react-router-dom';
import { useStudentView } from '../../lib/student-view';

// Bandeau de la vue étudiant : rappelle au personnel qu'il s'agit d'un aperçu.
export function StudentViewBanner() {
  const { preview } = useStudentView();
  if (!preview) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 text-sm" role="note">
      <p>
        <span aria-hidden="true">👁️ </span>
        <strong>Vue étudiant</strong> — aperçu des cours publiés tels que les élèves les voient. Les réponses sont corrigées mais jamais enregistrées.
      </p>
      <Link to="/gestion/cours" className="font-semibold underline">
        Quitter l’aperçu
      </Link>
    </div>
  );
}
