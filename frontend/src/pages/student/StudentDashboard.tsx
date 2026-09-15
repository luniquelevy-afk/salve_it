import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { AnnouncementsPanel } from '../../components/AnnouncementsPanel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { GamificationPanel } from '../../components/GamificationPanel';
import { LearningPathPanel } from '../../components/LearningPathPanel';
import { ReadinessGauges } from '../../components/ReadinessGauges';
import { StudentOverview } from '../../components/StudentOverview';
import { api, ApiError } from '../../lib/api';
import type { Gamification, LearningPath, Readiness, StudentDashboardSummary } from '../../lib/types';

const SHORTCUTS = [
  { to: '/etudiant/cours', label: 'Cours', desc: 'Leçons et contenus' },
  { to: '/etudiant/exercices', label: 'Exercices', desc: 'Correction immédiate' },
  { to: '/etudiant/simulations', label: 'Simulations', desc: 'Tests type TOLC' },
  { to: '/etudiant/entretien', label: 'Entretien', desc: 'Agent consulaire IA' },
  { to: '/calendrier', label: 'Calendrier', desc: 'Séances à venir' },
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
      <div>
        <h1 className="text-2xl font-bold">Ciao {me?.fullName.split(' ')[0]} 👋</h1>
        <p className="text-stone-600">
          Votre espace de préparation{me?.level ? <> · niveau <span className="font-semibold">{me.level}</span></> : null}
        </p>
      </div>

      <nav aria-label="Accès rapides" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SHORTCUTS.map((shortcut) => (
          <Link
            key={shortcut.to}
            to={shortcut.to}
            className="card group flex flex-col gap-0.5 transition hover:-translate-y-0.5 hover:border-verde/40 hover:shadow-md"
          >
            <span className="flex items-center justify-between text-sm font-semibold text-notte">
              {shortcut.label}
              <span aria-hidden className="text-verde transition-transform group-hover:translate-x-0.5">→</span>
            </span>
            <span className="text-xs text-stone-500">{shortcut.desc}</span>
          </Link>
        ))}
      </nav>

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
