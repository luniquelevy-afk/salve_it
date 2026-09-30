import { useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { GamificationPanel } from '../../components/GamificationPanel';
import { LearningPathPanel } from '../../components/LearningPathPanel';
import { ReadinessGauges } from '../../components/ReadinessGauges';
import { StudentOverview } from '../../components/StudentOverview';
import { api, ApiError } from '../../lib/api';
import type { Gamification, LearningPath, Readiness, StudentDashboardSummary } from '../../lib/types';

// Progression détaillée : indicateurs, parcours et objectifs de la semaine, préparation, badges.
// L'accueil (StudentDashboard) n'en garde que l'essentiel.
export function StudentProgressPage() {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<LearningPath>('/api/student/learning-path'), api<Readiness>('/api/student/readiness')])
      .then(([pathResponse, readinessResponse]) => {
        setPath(pathResponse);
        setReadiness(readinessResponse);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger votre progression.'));
    api<StudentDashboardSummary>('/api/student/dashboard').then(setSummary).catch(() => undefined);
    api<Gamification>('/api/student/dashboard/gamification').then(setGamification).catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ma progression</h1>
        <p className="mt-1 text-sm text-stone-600">Vos résultats, votre parcours personnalisé et votre préparation au départ.</p>
      </div>
      <ErrorBanner message={error} />
      {summary && <StudentOverview summary={summary} />}
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
        </div>
      </div>
    </div>
  );
}
