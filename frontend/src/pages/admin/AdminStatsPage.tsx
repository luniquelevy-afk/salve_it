import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarList, ChartCard, ColumnChart, Donut, EmptyChart, LineChart, Sparkline, type Series } from '../../components/charts/charts';
import { formatDateLabel } from '../../components/charts/format';
import { ClassOverview, HardestQuestionsTable } from '../../components/ClassOverview';
import { DocumentsOverviewPanel } from '../../components/DocumentsOverviewPanel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { LEAD_STATUS_LABELS, type AdminOverview, type DashboardDays, type DashboardKpi, type LeadStatus, type TeacherOverview } from '../../lib/types';

const PERIODS: { days: DashboardDays; label: string }[] = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 365, label: '1 an' },
];

const OPERATION_LABELS: Record<string, string> = {
  embassy_turn: 'Tours d’entretien',
  embassy_report: 'Rapports d’entretien',
  question_generation: 'Génération de questions',
};
const MODE_LABELS: Record<string, string> = { entrainement: 'Entraînement', examen: 'Examen', revision: 'Révision', defi: 'Défi' };
const EMBASSY_LABELS: Record<string, string> = {
  completed: 'Terminés',
  in_progress: 'En cours',
  report_pending: 'Rapport en préparation',
  failed: 'Incident technique',
  abandoned: 'Abandonnés',
};

const integer = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const formatInt = (value: number) => integer.format(value);
const formatPercent = (value: number) => `${integer.format(value)} %`;
const formatMoney = (value: number) => money.format(value);

const ACTIVITY: Series[] = [
  { key: 'simulations', label: 'Simulations', color: 'var(--viz-1)' },
  { key: 'exercises', label: 'Exercices', color: 'var(--viz-2)' },
  { key: 'interviews', label: 'Entretiens', color: 'var(--viz-3)' },
];
const ACCENT = 'var(--viz-accent)';

// §16.3 : statistiques détaillées par période — tendances, répartitions et suivi opérationnel.
// L'accueil (AdminHomePage) ne garde que l'essentiel.
export function AdminStatsPage() {
  const [days, setDays] = useState<DashboardDays>(30);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [classes, setClasses] = useState<TeacherOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api<AdminOverview>(`/api/admin/learning/dashboard?days=${days}`)
      .then((response) => active && setOverview(response))
      .catch((err: unknown) => active && setError(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  useEffect(() => {
    api<TeacherOverview>('/api/teacher/overview')
      .then(setClasses)
      .catch(() => undefined);
  }, []);

  const periodLabel = PERIODS.find((period) => period.days === days)?.label ?? `${days} jours`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="mt-1 text-sm text-[var(--c-muted)]">Activité des étudiants, préparation, prospects et coûts — comparés à la période précédente.</p>
        </div>
        <div role="group" aria-label="Période" className="flex gap-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-elev)] p-1">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              aria-pressed={period.days === days}
              onClick={() => setDays(period.days)}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
                period.days === days ? 'bg-[var(--c-primary)] text-[var(--c-on-primary)]' : 'text-[var(--c-muted)] hover:bg-[var(--c-subtle)] hover:text-[var(--c-text)]'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </header>

      <ErrorBanner message={error} />

      {!overview ? (
        <DashboardSkeleton />
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
          <Kpis overview={overview} periodLabel={periodLabel} />
          <Charts overview={overview} />
          <Operations overview={overview} />
        </div>
      )}

      {classes && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Suivi des classes</h2>
          <ClassOverview overview={classes} />
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Indicateurs
// ─────────────────────────────────────────────────────────────
function delta(kpi: DashboardKpi, mode: 'relative' | 'points'): { text: string; direction: 'up' | 'down' | 'flat' } | null {
  if (kpi.value === null || kpi.previous === null) return null;
  const difference = kpi.value - kpi.previous;
  if (difference === 0) return { text: '=', direction: 'flat' };
  const direction = difference > 0 ? 'up' : 'down';
  if (mode === 'points') return { text: `${difference > 0 ? '+' : '−'}${integer.format(Math.abs(difference))} pts`, direction };
  if (kpi.previous === 0) return { text: 'nouveau', direction };
  return { text: `${difference > 0 ? '+' : '−'}${integer.format(Math.abs((100 * difference) / kpi.previous))} %`, direction };
}

function KpiTile({
  label,
  kpi,
  format,
  trend,
  mode = 'relative',
  upIsGood = true,
}: {
  label: string;
  kpi: DashboardKpi;
  format: (value: number) => string;
  trend: (number | null)[];
  mode?: 'relative' | 'points';
  upIsGood?: boolean;
}) {
  const change = delta(kpi, mode);
  const good = change && change.direction !== 'flat' ? (change.direction === 'up') === upIsGood : null;
  return (
    <div className="flex flex-col rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-4">
      <p className="text-[11px] font-semibold tracking-wide text-[var(--c-muted)] uppercase">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-3xl font-bold tabular-nums">{kpi.value === null ? '—' : format(kpi.value)}</p>
        {change && (
          <span
            className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              good === null ? 'bg-[var(--c-subtle)] text-[var(--c-muted)]' : good ? 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]' : 'bg-[var(--c-danger-soft)] text-[var(--c-danger)]'
            }`}
          >
            <span aria-hidden="true">{change.direction === 'up' ? '▲ ' : change.direction === 'down' ? '▼ ' : ''}</span>
            {change.text}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-[var(--c-faint)]">{kpi.previous === null ? 'Pas de données sur la période précédente' : `Période précédente : ${format(kpi.previous)}`}</p>
      <div className="mt-3">
        <Sparkline values={trend} color={ACCENT} />
      </div>
    </div>
  );
}

function Kpis({ overview, periodLabel }: { overview: AdminOverview; periodLabel: string }) {
  const { kpis, series } = overview.analytics;
  const trend = (key: keyof (typeof series)[number]) => series.map((point) => point[key] as number | null);
  return (
    <section aria-label={`Indicateurs sur ${periodLabel}`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile label="Étudiants actifs" kpi={kpis.activeStudents} format={formatInt} trend={trend('activeStudents')} />
      <KpiTile label="Simulations terminées" kpi={kpis.simulations} format={formatInt} trend={trend('simulations')} />
      <KpiTile label="Réussite moyenne" kpi={kpis.accuracy} format={formatPercent} trend={trend('accuracy')} mode="points" />
      <KpiTile label="Exercices réalisés" kpi={kpis.exercises} format={formatInt} trend={trend('exercises')} />
      <KpiTile label="Entretiens consulaires" kpi={kpis.interviews} format={formatInt} trend={trend('interviews')} />
      <KpiTile label="Score moyen d’entretien" kpi={kpis.interviewScore} format={(value) => `${formatInt(value)}/100`} trend={[]} mode="points" />
      <KpiTile label="Nouveaux prospects" kpi={kpis.newLeads} format={formatInt} trend={trend('leads')} />
      <KpiTile label="Coût IA" kpi={kpis.aiCost} format={formatMoney} trend={trend('aiCost')} upIsGood={false} />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Graphiques
// ─────────────────────────────────────────────────────────────
function Charts({ overview }: { overview: AdminOverview }) {
  const { series, period, breakdowns } = overview.analytics;
  const xLabel = (date: string) => formatDateLabel(date, period.granularity);
  const bucket = period.granularity === 'week' ? 'par semaine' : 'par jour';
  const hasActivity = series.some((point) => point.simulations + point.exercises + point.interviews > 0);
  const hasAccuracy = series.some((point) => point.accuracy !== null);
  const levelColors = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)', 'var(--viz-accent)', 'var(--c-border-strong)'];
  const levels = breakdowns.studentsByLevel.map((entry, index) => ({ label: entry.level ?? 'Non renseigné', value: entry.count, color: levelColors[index] ?? 'var(--c-faint)' }));
  const leadFunnel = breakdowns.leadsByStatus.map((entry) => ({ label: LEAD_STATUS_LABELS[entry.status as LeadStatus] ?? entry.status, value: entry.count }));
  const embassy = breakdowns.embassyByStatus.filter((entry) => entry.count > 0);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Activité pédagogique"
          subtitle={`Simulations terminées, exercices et entretiens, ${bucket}`}
          legend={ACTIVITY}
          table={{ columns: ['Date', ...ACTIVITY.map((item) => item.label)], rows: series.map((point) => [xLabel(point.date), point.simulations, point.exercises, point.interviews]) }}
        >
          {hasActivity ? <LineChart data={series} series={ACTIVITY} xLabel={xLabel} format={formatInt} ariaLabel="Courbes d’activité pédagogique" height={240} /> : <EmptyChart height={240} />}
        </ChartCard>
        <ChartCard title="Étudiants actifs" subtitle={`Étudiants ayant eu au moins une activité, ${bucket}`} table={{ columns: ['Date', 'Étudiants actifs'], rows: series.map((point) => [xLabel(point.date), point.activeStudents]) }}>
          {series.some((point) => point.activeStudents > 0) ? (
            <LineChart data={series} series={[{ key: 'activeStudents', label: 'Étudiants actifs', color: ACCENT }]} xLabel={xLabel} format={formatInt} area ariaLabel="Courbe des étudiants actifs" height={240} />
          ) : (
            <EmptyChart height={240} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Réussite aux simulations"
          subtitle={`Part de bonnes réponses des simulations terminées, ${bucket}`}
          table={{ columns: ['Date', 'Réussite'], rows: series.filter((point) => point.accuracy !== null).map((point) => [xLabel(point.date), `${point.accuracy} %`]) }}
        >
          {hasAccuracy ? (
            <LineChart data={series} series={[{ key: 'accuracy', label: 'Réussite', color: ACCENT }]} xLabel={xLabel} format={formatPercent} yMax={100} area ariaLabel="Courbe de réussite aux simulations" height={220} />
          ) : (
            <EmptyChart height={220} message="Aucune simulation terminée sur la période." />
          )}
        </ChartCard>
        <ChartCard title="Réussite par compétence" subtitle="Sections des simulations terminées sur la période">
          {breakdowns.categoryAccuracy.length > 0 ? (
            <BarList
              items={breakdowns.categoryAccuracy.slice(0, 8).map((entry) => ({ label: entry.category, value: entry.accuracy ?? 0, hint: `${formatInt(entry.answers)} rép.` }))}
              color="var(--viz-1)"
              format={formatPercent}
              max={100}
            />
          ) : (
            <EmptyChart height={180} message="Aucune réponse sur la période." />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Étudiants par niveau" subtitle="Comptes étudiants actifs">
          <Donut items={levels} centerLabel="étudiants" />
        </ChartCard>
        <ChartCard title="Prospects par statut" subtitle="Ensemble du portefeuille">
          {leadFunnel.some((entry) => entry.value > 0) ? <BarList items={leadFunnel} color="var(--viz-2)" format={formatInt} /> : <EmptyChart height={180} message="Aucun prospect pour le moment." />}
        </ChartCard>
        <ChartCard
          title="Nouveaux prospects"
          subtitle={`Formulaire de contact et test de niveau, ${bucket}`}
          table={{ columns: ['Date', 'Prospects'], rows: series.map((point) => [xLabel(point.date), point.leads]) }}
          className="lg:col-span-2 xl:col-span-1"
        >
          {series.some((point) => point.leads > 0) ? (
            <ColumnChart data={series} series={{ key: 'leads', label: 'Prospects', color: 'var(--viz-2)' }} xLabel={xLabel} format={formatInt} ariaLabel="Histogramme des nouveaux prospects" height={200} />
          ) : (
            <EmptyChart height={200} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ChartCard title="Simulations par mode" subtitle="Terminées sur la période">
          {breakdowns.simulationsByMode.some((entry) => entry.count > 0) ? (
            <BarList items={breakdowns.simulationsByMode.map((entry) => ({ label: MODE_LABELS[entry.mode] ?? entry.mode, value: entry.count }))} color="var(--viz-1)" format={formatInt} />
          ) : (
            <EmptyChart height={180} message="Aucune simulation terminée sur la période." />
          )}
        </ChartCard>
        <ChartCard title="Entretiens consulaires" subtitle="Démarrés sur la période, par issue">
          {embassy.length > 0 ? (
            <Donut
              items={embassy.map((entry, index) => ({ label: EMBASSY_LABELS[entry.status] ?? entry.status, value: entry.count, color: ['var(--viz-3)', 'var(--viz-1)', 'var(--viz-accent)', 'var(--viz-2)', 'var(--c-border-strong)'][index] ?? 'var(--c-faint)' }))}
              centerLabel="entretiens"
            />
          ) : (
            <EmptyChart height={180} message="Aucun entretien sur la période." />
          )}
        </ChartCard>
        <ChartCard
          title="Coût de l’IA"
          subtitle={`Estimation, ${bucket}`}
          table={{ columns: ['Date', 'Coût'], rows: series.map((point) => [xLabel(point.date), formatMoney(point.aiCost)]) }}
          className="lg:col-span-2 xl:col-span-1"
        >
          {series.some((point) => point.aiCost > 0) ? (
            <ColumnChart data={series} series={{ key: 'aiCost', label: 'Coût IA', color: 'var(--viz-3)' }} xLabel={xLabel} format={formatMoney} ariaLabel="Histogramme du coût de l’IA" height={200} />
          ) : (
            <EmptyChart height={200} message="Aucun appel à l’IA sur la période." />
          )}
        </ChartCard>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Suivi opérationnel (données non liées à la période)
// ─────────────────────────────────────────────────────────────
function Operations({ overview }: { overview: AdminOverview }) {
  const { ai, leads, embassy } = overview;
  const alerts = [
    { label: 'Relances de prospects en retard', value: leads.toFollowUp, to: '/admin/prospects' },
    { label: 'Incidents techniques d’entretien (30 j)', value: embassy.failureRate30 === null ? '—' : `${embassy.failureRate30} %`, to: '/admin/ia' },
    { label: 'Appels IA ce mois-ci', value: `${ai.monthCalls} · ${formatMoney(ai.monthCost)}`, to: '/admin/ia' },
  ];
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="À surveiller" subtitle="Hors période sélectionnée">
          <ul className="divide-y divide-[var(--c-border)]">
            {alerts.map((alert) => (
              <li key={alert.label}>
                <Link to={alert.to} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-[var(--c-primary)]">
                  <span className="text-[var(--c-muted)]">{alert.label}</span>
                  <span className="font-semibold tabular-nums">{alert.value}</span>
                </Link>
              </li>
            ))}
          </ul>
          {ai.byOperation.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-[var(--c-faint)] uppercase">Coût IA du mois par opération</p>
              <BarList items={ai.byOperation.map((operation) => ({ label: OPERATION_LABELS[operation.operation] ?? operation.operation, value: operation.cost, hint: `${operation.calls} appels` }))} color="var(--viz-3)" format={formatMoney} />
            </div>
          )}
        </ChartCard>
        <ChartCard title="Documents des étudiants" subtitle="À vérifier et échéances à 30 jours" className="xl:col-span-2">
          <DocumentsOverviewPanel />
        </ChartCard>
      </div>

      <ChartCard title="Questions les plus ratées" subtitle="Toutes simulations confondues (5 réponses minimum)">
        <HardestQuestionsTable questions={overview.hardestQuestions} />
        <Link to="/banque-questions" className="mt-3 inline-block text-xs font-semibold text-[var(--c-primary)] hover:underline">
          Ouvrir la banque de questions →
        </Link>
      </ChartCard>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-80 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] xl:col-span-2" />
        <div className="h-80 animate-pulse rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)]" />
      </div>
    </div>
  );
}
