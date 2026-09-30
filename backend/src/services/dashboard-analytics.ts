// Analyses du tableau de bord admin sur une période choisie : indicateurs comparés à la période
// précédente, séries temporelles (jour ou semaine) et répartitions. Fonctions pures, testées
// sans base (test/dashboard-analytics.test.ts).

type Row = Record<string, unknown>;

export const DASHBOARD_PERIODS = [7, 30, 90, 365] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const LEAD_FUNNEL = ['nouveau', 'contacte', 'test_realise', 'interesse', 'a_relancer', 'inscrit', 'non_interesse'];
const LEVELS = ['A1', 'A2', 'B1', 'B2'];

export interface AnalyticsInput {
  days: DashboardPeriod;
  now: Date;
  profiles: { id: string; role: string; level: string | null }[];
  simulations: Row[];
  attempts: { student_id: string; created_at: string }[];
  embassy: Row[];
  aiUsage: { estimated_cost: number; created_at: string }[];
  leads: Row[];
}

interface Kpi {
  value: number | null;
  previous: number | null;
}

const utcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Seaux jour par jour jusqu'à 90 jours, par semaine au-delà (lisibilité des courbes sur un an).
export function buckets(days: DashboardPeriod, now: Date): { start: string; end: string }[] {
  const step = days > 90 ? 7 : 1;
  const count = Math.ceil(days / step);
  const lastStart = utcDay(now);
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(lastStart.getTime() - (count - 1 - index) * step * DAY_MS);
    return { start: start.toISOString(), end: new Date(start.getTime() + step * DAY_MS).toISOString() };
  });
}

function tally(simulation: Row): { correct: number; total: number } {
  const sections = Object.values((simulation.score_by_section ?? {}) as Record<string, { correct?: number; total?: number }>);
  return {
    correct: sections.reduce((sum, section) => sum + (section.correct ?? 0), 0),
    total: sections.reduce((sum, section) => sum + (section.total ?? 0), 0),
  };
}

const percent = (part: number, total: number) => (total > 0 ? Math.round((100 * part) / total) : null);
const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildAnalytics(input: AnalyticsInput) {
  const { days, now } = input;
  const end = now.toISOString();
  const start = new Date(now.getTime() - days * DAY_MS).toISOString();
  const previousStart = new Date(now.getTime() - 2 * days * DAY_MS).toISOString();
  const within = (at: unknown, from: string, to: string) => typeof at === 'string' && at >= from && at < to;
  const current = (at: unknown) => within(at, start, end);
  const previous = (at: unknown) => within(at, previousStart, start);

  const studentIds = new Set(input.profiles.filter((profile) => profile.role === 'student').map((profile) => profile.id));
  const completed = input.simulations.filter((simulation) => simulation.status === 'completed');

  const activeIn = (inRange: (at: unknown) => boolean) => {
    const ids = new Set<string>();
    for (const simulation of input.simulations) if (inRange(simulation.started_at)) ids.add(simulation.student_id as string);
    for (const attempt of input.attempts) if (inRange(attempt.created_at)) ids.add(attempt.student_id);
    for (const session of input.embassy) if (inRange(session.started_at)) ids.add(session.student_id as string);
    return [...ids].filter((id) => studentIds.has(id)).length;
  };
  const accuracyIn = (inRange: (at: unknown) => boolean) => {
    const totals = completed.filter((simulation) => inRange(simulation.completed_at)).map(tally);
    return percent(totals.reduce((sum, t) => sum + t.correct, 0), totals.reduce((sum, t) => sum + t.total, 0));
  };
  const averageScoreIn = (inRange: (at: unknown) => boolean) => {
    const scores = input.embassy.filter((session) => session.status === 'completed' && inRange(session.completed_at) && typeof session.overall_score === 'number').map((session) => session.overall_score as number);
    return scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  };
  const count = <T>(items: T[], at: (item: T) => unknown, inRange: (value: unknown) => boolean) => items.filter((item) => inRange(at(item))).length;
  const cost = (inRange: (at: unknown) => boolean) => round2(input.aiUsage.filter((usage) => inRange(usage.created_at)).reduce((sum, usage) => sum + Number(usage.estimated_cost), 0));
  const kpi = (compute: (inRange: (at: unknown) => boolean) => number | null): Kpi => ({ value: compute(current), previous: compute(previous) });

  const kpis = {
    activeStudents: kpi(activeIn),
    simulations: kpi((inRange) => count(completed, (simulation) => simulation.completed_at, inRange)),
    accuracy: kpi(accuracyIn),
    exercises: kpi((inRange) => count(input.attempts, (attempt) => attempt.created_at, inRange)),
    interviews: kpi((inRange) => count(input.embassy, (session) => session.started_at, inRange)),
    interviewScore: kpi(averageScoreIn),
    newLeads: kpi((inRange) => count(input.leads, (lead) => lead.created_at, inRange)),
    aiCost: kpi(cost),
  };

  const series = buckets(days, now).map(({ start: from, end: to }) => {
    const inBucket = (at: unknown) => within(at, from, to);
    return {
      date: from.slice(0, 10),
      simulations: count(completed, (simulation) => simulation.completed_at, inBucket),
      exercises: count(input.attempts, (attempt) => attempt.created_at, inBucket),
      interviews: count(input.embassy, (session) => session.started_at, inBucket),
      activeStudents: activeIn(inBucket),
      accuracy: accuracyIn(inBucket),
      leads: count(input.leads, (lead) => lead.created_at, inBucket),
      aiCost: cost(inBucket),
    };
  });

  const categories = new Map<string, { correct: number; total: number }>();
  for (const simulation of completed.filter((item) => current(item.completed_at))) {
    for (const section of Object.values((simulation.score_by_section ?? {}) as Record<string, { name?: string; correct?: number; total?: number }>)) {
      const name = section.name ?? 'Autre';
      const entry = categories.get(name) ?? { correct: 0, total: 0 };
      entry.correct += section.correct ?? 0;
      entry.total += section.total ?? 0;
      categories.set(name, entry);
    }
  }

  const activeStudents = input.profiles.filter((profile) => profile.role === 'student');
  const embassyInPeriod = input.embassy.filter((session) => current(session.started_at));

  return {
    period: { days, start, end, granularity: days > 90 ? ('week' as const) : ('day' as const) },
    kpis,
    series,
    breakdowns: {
      studentsByLevel: [...LEVELS, null].map((level) => ({ level, count: activeStudents.filter((profile) => (profile.level ?? null) === level).length })),
      leadsByStatus: LEAD_FUNNEL.map((status) => ({ status, count: input.leads.filter((lead) => lead.status === status).length })),
      simulationsByMode: ['entrainement', 'examen', 'revision', 'defi'].map((mode) => ({
        mode,
        count: completed.filter((simulation) => simulation.mode === mode && current(simulation.completed_at)).length,
      })),
      embassyByStatus: ['completed', 'in_progress', 'report_pending', 'failed', 'abandoned'].map((status) => ({
        status,
        count: embassyInPeriod.filter((session) => session.status === status).length,
      })),
      categoryAccuracy: [...categories]
        .map(([category, entry]) => ({ category, answers: entry.total, accuracy: percent(entry.correct, entry.total) }))
        .filter((entry) => entry.answers > 0)
        .sort((a, b) => b.answers - a.answers),
    },
  };
}

export type DashboardAnalytics = ReturnType<typeof buildAnalytics>;
