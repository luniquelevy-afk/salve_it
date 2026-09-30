import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatRelative } from '../../lib/format';
import type { Announcement, LearningPath, PathAction, Readiness, StudentDashboardSummary } from '../../lib/types';

// Accueil étudiant, par priorité : ce que je dois faire maintenant, ma progression,
// mes derniers résultats, mes modules, mes annonces. Le détail est sur /etudiant/progression.

const FALLBACK_ACTION: PathAction = {
  id: 'first-simulation',
  priority: 1,
  title: 'Passer une simulation de test',
  description: 'Elle sert de point de départ pour mesurer votre niveau et personnaliser votre parcours.',
  link: '/etudiant/simulations',
};

function encouragement(progress: number | null): string {
  if (progress === null) return 'Faites une première simulation pour mesurer votre progression.';
  if (progress < 40) return 'Vous démarrez : un peu d’entraînement chaque jour fera la différence.';
  if (progress < 70) return 'Vous êtes sur la bonne voie. Continuez votre entraînement cette semaine.';
  return 'Excellent rythme ! Gardez cette régularité jusqu’au départ.';
}

const ACTIVITY_ICONS = { simulation: '⏱️', embassy: '🎙️', exercise: '✍️' } as const;

export function StudentDashboard() {
  const { me } = useAuth();
  const [path, setPath] = useState<LearningPath | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<StudentDashboardSummary | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LearningPath>('/api/student/learning-path')
      .then(setPath)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger votre parcours.'));
    api<Readiness>('/api/student/readiness').then(setReadiness).catch(() => undefined);
    api<StudentDashboardSummary>('/api/student/dashboard').then(setSummary).catch(() => undefined);
    api<{ announcements: Announcement[] }>('/api/announcements')
      .then((response) => setAnnouncements(response.announcements))
      .catch(() => undefined);
  }, []);

  const firstName = me?.fullName.split(' ')[0] ?? '';
  const nextAction = path ? (path.actions[0] ?? FALLBACK_ACTION) : null;
  const progress = readiness?.overall ?? null;

  // Annonces importantes : prochaine séance de cours puis annonces récentes, trois au plus.
  const notices = [
    ...(summary?.upcoming ?? [])
      .filter((item) => item.kind === 'class_session')
      .slice(0, 1)
      .map((item) => ({ id: `session-${item.date}`, title: `Prochaine séance : ${item.title}`, detail: formatDateTime(item.date), link: item.link })),
    ...announcements.map((announcement) => ({ id: announcement.id, title: announcement.title, detail: announcement.body, link: '/annonces' })),
  ].slice(0, 3);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* 1. En-tête */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bonjour {firstName} 👋</h1>
          <p className="mt-1 text-sm text-[var(--c-muted)]">
            {me?.level ? (
              <>
                Niveau actuel : <span className="font-semibold text-[var(--c-text)]">{me.level}</span>
              </>
            ) : (
              'Votre espace de préparation'
            )}
            {nextAction && <span className="hidden sm:inline"> · Prochaine étape : {nextAction.title.charAt(0).toLowerCase() + nextAction.title.slice(1)}</span>}
          </p>
        </div>
        {nextAction && (
          <Link to={nextAction.link} className="btn-primary">
            Continuer mon parcours
          </Link>
        )}
      </header>

      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        {/* 2. Progression générale */}
        <Card className="flex flex-col justify-between">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--c-muted)] uppercase">Progression globale</p>
          <div className="mt-3 flex items-center gap-4">
            <ProgressRing value={progress} />
            <p className="text-sm text-[var(--c-muted)]">{encouragement(progress)}</p>
          </div>
          <Link to="/etudiant/progression" className="mt-4 text-xs font-semibold text-[var(--c-primary)] hover:underline">
            Voir ma progression détaillée →
          </Link>
        </Card>

        {/* 3. Prochaine action — la carte la plus importante */}
        <section
          aria-labelledby="next-action"
          className="flex flex-col justify-between rounded-[14px] border border-[color-mix(in_srgb,var(--c-primary)_45%,transparent)] bg-[var(--c-primary-soft)] p-5"
        >
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--c-primary)] uppercase">Prochaine action</p>
            {nextAction ? (
              <>
                <h2 id="next-action" className="mt-2 text-lg font-bold">
                  {nextAction.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--c-muted)]">{nextAction.description}</p>
              </>
            ) : (
              <div className="mt-3 h-12 animate-pulse rounded-lg bg-[var(--c-subtle)]" />
            )}
          </div>
          {nextAction && (
            <Link to={nextAction.link} className="btn-primary mt-4 self-start">
              Commencer maintenant
            </Link>
          )}
        </section>
      </div>

      {/* 4. Modules principaux */}
      <section aria-label="Modules" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ModuleCard
          icon="⏱️"
          title="Tests"
          label="Dernier score"
          value={summary?.simulations.latest ? `${summary.simulations.latest.percent} %` : '—'}
          action="S’entraîner"
          to="/etudiant/simulations"
        />
        <ModuleCard
          icon="🎙️"
          title="Entretien IA"
          label="Dernière session"
          value={summary?.embassy.latestScore !== null && summary?.embassy.latestScore !== undefined ? `${summary.embassy.latestScore}/100` : '—'}
          action="Simuler"
          to="/etudiant/entretien"
        />
        <ModuleCard
          icon="🗣️"
          title="Italien"
          label={summary?.lastExercise ? 'Dernier exercice' : 'Cours'}
          value={summary?.lastExercise ? summary.lastExercise.title : 'À découvrir'}
          small
          action="Continuer"
          to="/etudiant/cours"
        />
        <ModuleCard
          icon="📄"
          title="Documents"
          label="Manquants"
          value={summary ? String(summary.documents.missing + summary.documents.needsCorrection) : '—'}
          hint={summary && summary.documents.needsCorrection > 0 ? `dont ${summary.documents.needsCorrection} à corriger` : undefined}
          action="Déposer"
          to="/etudiant/documents"
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 5. Résultats récents */}
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Résultats récents</h2>
          {summary && summary.recent.length === 0 && <p className="py-4 text-sm text-[var(--c-faint)]">Vos résultats apparaîtront ici après votre première activité.</p>}
          <ul className="divide-y divide-[var(--c-border)]">
            {(summary?.recent ?? []).map((item) => (
              <li key={`${item.kind}-${item.at}`}>
                <Link to={item.link} className="flex items-center gap-3 py-2.5 text-sm hover:text-[var(--c-primary)]">
                  <span aria-hidden="true">{ACTIVITY_ICONS[item.kind]}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="font-semibold tabular-nums">{item.result}</span>
                  <span className="w-28 shrink-0 text-right text-xs text-[var(--c-faint)]">{formatRelative(item.at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* 6. Annonces importantes */}
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Annonces</h2>
            <Link to="/annonces" className="text-xs font-semibold text-[var(--c-primary)] hover:underline">
              Tout voir
            </Link>
          </div>
          {notices.length === 0 && <p className="py-4 text-sm text-[var(--c-faint)]">Aucune annonce pour le moment.</p>}
          <ul className="divide-y divide-[var(--c-border)]">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link to={notice.link} className="block py-2.5 hover:text-[var(--c-primary)]">
                  <p className="text-sm font-medium">{notice.title}</p>
                  <p className="line-clamp-1 text-xs text-[var(--c-muted)]">{notice.detail}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-[var(--c-faint)]">Sur un ordinateur partagé, pensez à vous déconnecter en fin de séance.</p>
    </div>
  );
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-5 ${className}`}>{children}</section>;
}

function ModuleCard({ icon, title, label, value, hint, action, to, small = false }: { icon: string; title: string; label: string; value: string; hint?: string; action: string; to: string; small?: boolean }) {
  return (
    <Link to={to} className="group flex flex-col rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-4 transition hover:border-[var(--c-primary)]">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span aria-hidden="true">{icon}</span>
        {title}
      </p>
      <p className="mt-3 text-[11px] text-[var(--c-faint)]">{label}</p>
      <p className={`${small ? 'line-clamp-2 text-sm font-semibold' : 'text-2xl font-bold tabular-nums'} mt-0.5`}>{value}</p>
      {hint && <p className="text-[11px] text-[var(--c-muted)]">{hint}</p>}
      <span className="mt-auto pt-3 text-xs font-semibold text-[var(--c-primary)] group-hover:underline">{action} →</span>
    </Link>
  );
}

// Anneau de progression (0–100) ; la valeur est portée par le texte central.
function ProgressRing({ value }: { value: number | null }) {
  const size = 96;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={value === null ? 'Progression non mesurée' : `Progression globale : ${value} %`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-subtle)" strokeWidth={9} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--viz-accent)"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--c-text)">
        {value === null ? '—' : `${value} %`}
      </text>
    </svg>
  );
}
