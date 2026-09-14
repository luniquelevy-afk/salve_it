import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AnnouncementsPanel } from '../../components/AnnouncementsPanel';
import { ClassOverview } from '../../components/ClassOverview';
import { DocumentsOverviewPanel } from '../../components/DocumentsOverviewPanel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import type { TeacherOverview } from '../../lib/types';

const SHORTCUTS = [
  { to: '/classes', label: 'Mes classes' },
  { to: '/gestion/cours', label: 'Cours' },
  { to: '/gestion/exercices', label: 'Exercices' },
  { to: '/banque-questions', label: 'Banque de questions' },
  { to: '/calendrier', label: 'Calendrier' },
  { to: '/annonces', label: 'Annonces' },
];

export function TeacherDashboard() {
  const { me } = useAuth();
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<TeacherOverview>('/api/teacher/overview')
      .then(setOverview)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Buongiorno {me?.fullName.split(' ')[0]}</h1>
          <p className="text-stone-600">Suivi de vos classes</p>
        </div>
        <nav aria-label="Accès rapides" className="ml-auto flex flex-wrap gap-2">
          {SHORTCUTS.map((shortcut) => (
            <Link key={shortcut.to} to={shortcut.to} className="btn-secondary px-3 py-1.5 text-xs">
              {shortcut.label}
            </Link>
          ))}
        </nav>
      </div>

      <ErrorBanner message={error} />
      {!overview && !error && <p className="text-stone-500">Chargement…</p>}
      <DocumentsOverviewPanel />
      {overview && <ClassOverview overview={overview} />}

      <AnnouncementsPanel />
    </div>
  );
}
