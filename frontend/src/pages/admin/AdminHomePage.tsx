import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { ColumnChart, EmptyChart, LineChart } from '../../components/charts/charts';
import { formatDateLabel } from '../../components/charts/format';
import { ErrorBanner } from '../../components/ErrorBanner';
import { useScrollToHash } from '../../hooks/useScrollToHash';
import { api, ApiError } from '../../lib/api';
import { formatRelative } from '../../lib/format';
import type { AdminHome, FollowUpReason } from '../../lib/types';

const REASON_LABELS: Record<FollowUpReason, { label: string; tone: 'danger' | 'warning' | 'info' }> = {
  document_to_review: { label: 'Document', tone: 'info' },
  report_to_review: { label: 'Rapport IA', tone: 'info' },
  score_drop: { label: 'Score', tone: 'danger' },
  struggling: { label: 'Difficulté', tone: 'danger' },
  inactive: { label: 'Inactif', tone: 'warning' },
  document_correction: { label: 'Document', tone: 'warning' },
};

const QUICK_ACTIONS = [
  { to: '/admin/comptes?nouveau=student', label: 'Créer un étudiant', icon: '🎓' },
  { to: '/admin/comptes?nouveau=teacher', label: 'Créer un enseignant', icon: '🧑‍🏫' },
  { to: '/classes#programmes', label: 'Ajouter un programme', icon: '📘' },
  { to: '/annonces#publier', label: 'Publier une annonce', icon: '📣' },
];

// Accueil administrateur : d'abord ce qui demande une intervention, puis les indicateurs
// essentiels, les actions rapides, l'activité récente et une tendance simple.
// Les statistiques détaillées sont sur /admin/statistiques.
export function AdminHomePage() {
  const { me } = useAuth();
  const [home, setHome] = useState<AdminHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<'score' | 'simulations'>('score');
  useScrollToHash(home !== null);

  useEffect(() => {
    api<AdminHome>('/api/admin/learning/home')
      .then(setHome)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger l’accueil.'));
  }, []);

  const firstName = me?.fullName.split(' ')[0] ?? '';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bonjour {firstName} 👋</h1>
          <p className="mt-1 text-sm text-[var(--c-muted)]">Vue globale du centre</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/annonces#publier" className="btn-secondary">
            Ajouter une annonce
          </Link>
          <Link to="/admin/comptes?nouveau=student" className="btn-primary">
            Créer un compte
          </Link>
        </div>
      </header>

      <ErrorBanner message={error} />
      {!home && !error && <HomeSkeleton />}

      {home && (
        <>
          {/* 1. Ce qui nécessite une intervention */}
          <Attention home={home} />

          {/* 2. Indicateurs essentiels */}
          <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Étudiants actifs" value={home.kpis.activeStudents} hint={`sur ${home.kpis.enrolledStudents} inscrit${home.kpis.enrolledStudents > 1 ? 's' : ''} · 30 derniers jours`} to="/admin/comptes?role=student" />
            <Kpi label="Enseignants" value={home.kpis.teachers} hint="comptes actifs" to="/admin/comptes?role=teacher" />
            <Kpi label="Simulations ce mois" value={home.kpis.simulationsThisMonth} hint="terminées depuis le 1er" to="/admin/statistiques" />
            <Kpi label="Prospects en attente" value={home.kpis.pendingLeads} hint="à contacter ou relancer" to="/admin/prospects" />
          </section>

          {/* 3. Actions rapides */}
          <section aria-labelledby="quick-actions">
            <h2 id="quick-actions" className="mb-3 text-sm font-semibold">
              Actions rapides
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex min-h-14 items-center gap-3 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] px-4 text-sm font-medium transition hover:border-[var(--c-primary)] hover:text-[var(--c-primary)]"
                >
                  <span aria-hidden="true" className="text-lg">
                    {action.icon}
                  </span>
                  {action.label}
                </Link>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* 4. Activité récente */}
            <Panel title="Activité récente">
              {home.activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--c-faint)]">Aucune activité ces 30 derniers jours.</p>
              ) : (
                <ol className="divide-y divide-[var(--c-border)]">
                  {home.activity.map((item, index) => (
                    <li key={`${item.kind}-${item.at}-${index}`} className="flex items-start gap-3 py-2.5">
                      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--c-primary)]" />
                      <div className="min-w-0 flex-1">
                        {item.link ? (
                          <Link to={item.link} className="text-sm hover:text-[var(--c-primary)]">
                            {item.text}
                          </Link>
                        ) : (
                          <p className="text-sm">{item.text}</p>
                        )}
                        <p className="text-xs text-[var(--c-faint)]">{formatRelative(item.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            {/* 5. Étudiants à suivre */}
            <Panel id="a-suivre" title="Étudiants nécessitant un suivi" aside={home.followUpsTotal > home.followUps.length ? `${home.followUps.length} sur ${home.followUpsTotal}` : undefined}>
              {home.followUps.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--c-faint)]">Aucune situation à traiter. 🎉</p>
              ) : (
                <ul className="divide-y divide-[var(--c-border)]">
                  {home.followUps.map((item) => {
                    const reason = REASON_LABELS[item.reason];
                    return (
                      <li key={`${item.studentId}-${item.reason}`} className="flex items-center gap-3 py-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.name}</span>
                          <span className="block truncate text-xs text-[var(--c-muted)]">
                            {item.detail}
                            {item.others.length > 0 && <span className="text-[var(--c-faint)]"> · +{item.others.length} autre{item.others.length > 1 ? 's' : ''}</span>}
                          </span>
                        </span>
                        <Tag tone={reason.tone}>{reason.label}</Tag>
                        <Link to={item.link} className="shrink-0 text-xs font-semibold text-[var(--c-primary)] hover:underline">
                          Voir
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          {/* 6. Résumé des performances */}
          <Panel
            title="Progression générale"
            subtitle="12 dernières semaines"
            aside={
              <div role="group" aria-label="Mesure affichée" className="flex gap-1 rounded-lg border border-[var(--c-border)] p-0.5">
                {(
                  [
                    ['score', 'Score moyen'],
                    ['simulations', 'Simulations'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={trendView === key}
                    onClick={() => setTrendView(key)}
                    className={`min-h-8 rounded-md px-2.5 text-xs font-semibold ${trendView === key ? 'bg-[var(--c-primary)] text-[var(--c-on-primary)]' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            {home.trend.every((week) => week.simulations === 0) ? (
              <EmptyChart height={200} message="Aucune simulation terminée ces 12 dernières semaines." />
            ) : trendView === 'score' ? (
              <LineChart
                data={home.trend}
                series={[{ key: 'averageScore', label: 'Score moyen', color: 'var(--viz-accent)' }]}
                xLabel={(date) => formatDateLabel(date, 'week')}
                format={(value) => `${Math.round(value)} %`}
                yMax={100}
                area
                height={200}
                ariaLabel="Évolution du score moyen aux simulations"
              />
            ) : (
              <ColumnChart
                data={home.trend}
                series={{ key: 'simulations', label: 'Simulations terminées', color: 'var(--viz-1)' }}
                xLabel={(date) => formatDateLabel(date, 'week')}
                format={(value) => String(Math.round(value))}
                height={200}
                ariaLabel="Nombre de simulations terminées par semaine"
              />
            )}
            <Link to="/admin/statistiques" className="mt-4 inline-flex text-sm font-semibold text-[var(--c-primary)] hover:underline">
              Voir les statistiques détaillées →
            </Link>
          </Panel>
        </>
      )}
    </div>
  );
}

function Attention({ home }: { home: AdminHome }) {
  const items = [
    { value: home.attention.documentsToReview, label: 'document', plural: 'documents', suffix: 'à vérifier', to: '/admin/documents' },
    { value: home.attention.reportsToReview, label: 'rapport IA', plural: 'rapports IA', suffix: 'à consulter', to: '#a-suivre' },
    { value: home.attention.scoreDrops, label: 'résultat', plural: 'résultats', suffix: 'en baisse', to: '#a-suivre' },
    { value: home.attention.inactive, label: 'étudiant inactif', plural: 'étudiants inactifs', suffix: 'depuis 7 jours', to: '/admin/comptes?role=student' },
  ].filter((item) => item.value > 0);

  if (items.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] px-4 py-3 text-sm">
        <span aria-hidden="true">✅</span>
        <span className="text-[var(--c-muted)]">Rien ne nécessite votre intervention pour le moment.</span>
      </section>
    );
  }
  return (
    <section aria-labelledby="attention" className="rounded-[14px] border border-[color-mix(in_srgb,var(--c-primary)_35%,transparent)] bg-[var(--c-primary-soft)] p-4">
      <h2 id="attention" className="mb-3 text-sm font-semibold">
        À traiter
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-elev)] px-3 text-sm transition hover:border-[var(--c-primary)]"
          >
            <span className="font-bold tabular-nums">{item.value}</span>
            <span className="text-[var(--c-muted)]">
              {item.value > 1 ? item.plural : item.label} {item.suffix}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Kpi({ label, value, hint, to }: { label: string; value: number; hint: string; to: string }) {
  return (
    <Link to={to} className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-4 transition hover:border-[var(--c-border-strong)]">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--c-muted)] uppercase">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{new Intl.NumberFormat('fr-FR').format(value)}</p>
      <p className="mt-1 text-xs text-[var(--c-faint)]">{hint}</p>
    </Link>
  );
}

function Panel({ id, title, subtitle, aside, children }: { id?: string; title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--c-faint)]">{subtitle}</p>}
        </div>
        {typeof aside === 'string' ? <span className="text-xs text-[var(--c-faint)]">{aside}</span> : aside}
      </div>
      {children}
    </section>
  );
}

function Tag({ tone, children }: { tone: 'danger' | 'warning' | 'info'; children: React.ReactNode }) {
  const styles = {
    danger: 'bg-[var(--c-danger-soft)] text-[var(--c-danger)]',
    warning: 'bg-[color-mix(in_srgb,#f59e0b_16%,transparent)] text-[#d97706]',
    info: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]',
  };
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${styles[tone]}`}>{children}</span>;
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-72 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)]" />
        <div className="h-72 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)]" />
      </div>
    </div>
  );
}
