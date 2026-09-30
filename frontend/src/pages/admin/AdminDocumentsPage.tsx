import { Link } from 'react-router-dom';
import { DocumentsOverviewPanel } from '../../components/DocumentsOverviewPanel';

// Documents des étudiants : dépôts à vérifier et échéances (le détail se fait par étudiant).
export function AdminDocumentsPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="mt-1 text-sm text-stone-600">Dépôts à vérifier et documents qui expirent dans les 30 prochains jours.</p>
        </div>
        <Link to="/admin/checklist" className="btn-secondary">
          Checklist visa
        </Link>
      </header>
      <section className="card">
        <DocumentsOverviewPanel />
      </section>
    </div>
  );
}
