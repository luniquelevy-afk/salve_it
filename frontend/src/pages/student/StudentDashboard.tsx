import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AnnouncementsPanel } from '../../components/AnnouncementsPanel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { GamificationPanel } from '../../components/GamificationPanel';
import { LearningPathPanel } from '../../components/LearningPathPanel';
import { ReadinessGauges } from '../../components/ReadinessGauges';
import { StudentOverview } from '../../components/StudentOverview';
import { api, ApiError } from '../../lib/api';
import type { Gamification, LearningPath, Readiness, StudentDashboardSummary } from '../../lib/types';

const SHORTCUTS = [
  { to: '/etudiant/cours', label: 'Cours' },
  { to: '/etudiant/exercices', label: 'Exercices' },
  { to: '/etudiant/simulations', label: 'Simulations' },
  { to: '/etudiant/entretien', label: 'Entretien consulaire' },
  { to: '/calendrier', label: 'Calendrier' },
];

// §16.1 : indicateurs clés, prochaine action recommandée, compétences, préparation, échéances, annonces.
export function StudentDashboard() {
  const { me } = useAuth();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<LearningPath>('/api/student/learning-path'), api<Readiness>('/api/student/readiness')])
      .then(([pathResponse, readinessResponse]) => {
        setPath(pathResponse);
        setReadiness(readinessResponse);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger votre parcours.'));
    // Indicateurs chargés à part : un échec n'empêche pas l'affichage du parcours.
    api<StudentDashboardSummary>('/api/student/dashboard')
      .then(setSummary)
      .catch((err: unknown) => setSummaryError(err instanceof ApiError ? err.message : 'Impossible de charger vos indicateurs.'));
    // Gamification (§14) : purement indicative, un échec reste silencieux.
    api<Gamification>('/api/student/dashboard/gamification')
      .then(setGamification)
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ciao {me?.fullName.split(' ')[0]} 👋</h1>
          <p className="text-stone-600">
            Votre espace de préparation{me?.level ? <> · niveau <span className="font-semibold">{me.level}</span></> : null}
          </p>
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
      <ErrorBanner message={summaryError} />
      {summary && <StudentOverview summary={summary} />}
      {!path && !error && <p className="text-stone-500">Chargement de votre parcours…</p>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {path && (
          <LearningPathPanel
            objective={path.objective}
            actions={path.actions}
            weeklyGoals={path.weeklyGoals}
            progressPercent={path.progressPercent}
            categories={path.reviews.categories}
            nextReviewAt={path.reviews.nextReviewAt}
          />
        )}
        <div className="space-y-6">
          {readiness && <ReadinessGauges readiness={readiness} />}
          {gamification && <GamificationPanel data={gamification} />}
          <AnnouncementsPanel />
        </div>
      </div>

      <p className="text-xs text-stone-500">Sur un ordinateur partagé, pensez à vous déconnecter en fin de séance.</p>
    </div>
  );
}
