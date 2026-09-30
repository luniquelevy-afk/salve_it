// §16.1 : indicateurs du tableau de bord étudiant — scores, entretiens, documents, prochaines échéances.
import { db } from '../lib/db/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { listClassSessions } from './calendar.js';
import { getStudentDocumentsSpace } from './documents.js';

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 14;
const EXPIRY_HORIZON_DAYS = 30;

export interface SimulationPoint {
  completedAt: string;
  accuracy: number;
  templateName: string | null;
}

// Taux de bonnes réponses : comparable d'un modèle de test à l'autre, contrairement au score brut (barèmes différents).
export function summarizeSimulations(points: SimulationPoint[]) {
  const sorted = [...points].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  if (sorted.length === 0) return { count: 0, latest: null, averagePercent: null, firstPercent: null, progressionPoints: null };
  const percent = (value: number) => Math.round(value * 100);
  const first = sorted[0]!;
  const latest = sorted.at(-1)!;
  return {
    count: sorted.length,
    latest: { percent: percent(latest.accuracy), templateName: latest.templateName, completedAt: latest.completedAt },
    averagePercent: percent(sorted.reduce((sum, point) => sum + point.accuracy, 0) / sorted.length),
    firstPercent: percent(first.accuracy),
    progressionPoints: sorted.length > 1 ? percent(latest.accuracy) - percent(first.accuracy) : null,
  };
}

export interface EmbassyPoint {
  completedAt: string;
  overallScore: number;
  coherence: number | null;
  inconsistencies: number;
}

export function summarizeEmbassy(points: EmbassyPoint[]) {
  const recentFirst = [...points].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const average = (values: number[]) => (values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);
  return {
    count: recentFirst.length,
    averageScore: average(recentFirst.map((point) => point.overallScore)),
    // « Score moyen de cohérence » (§16.1) : dimension cohérence du projet des rapports d'entretien.
    averageCoherence: average(recentFirst.map((point) => point.coherence).filter((value): value is number => value !== null)),
    latestInconsistencies: recentFirst[0]?.inconsistencies ?? null,
  };
}

export interface UpcomingItem {
  kind: 'class_session' | 'document_expiry';
  date: string;
  title: string;
  detail: string | null;
  link: string;
}

export function buildUpcoming(
  sessions: { title: string; className: string | null; startsAt: string; location: string | null }[],
  expiries: { label: string; expiresAt: string; expired: boolean }[],
  limit = 6,
): UpcomingItem[] {
  const items: UpcomingItem[] = [
    ...sessions.map((session) => ({
      kind: 'class_session' as const,
      date: session.startsAt,
      title: session.title,
      detail: [session.className, session.location].filter(Boolean).join(' · ') || null,
      link: '/calendrier',
    })),
    ...expiries.map((expiry) => ({
      kind: 'document_expiry' as const,
      // Date seule (AAAA-MM-JJ) ramenée à minuit UTC pour être triée avec les séances.
      date: `${expiry.expiresAt}T00:00:00.000Z`,
      title: expiry.expired ? `${expiry.label} : document expiré` : `${expiry.label} : expiration`,
      detail: expiry.expired ? 'À renouveler' : null,
      link: '/etudiant/documents',
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

interface SimulationRow {
  completed_at: string;
  total_questions: number;
  score_by_section: Record<string, { correct: number }> | null;
  test_templates: { name: string } | null;
}

interface EmbassyRow {
  completed_at: string;
  overall_score: number | null;
  ai_report: { dimensions?: { coherence_project?: number }; inconsistencies?: unknown[] } | null;
}

export async function getStudentDashboard(auth: AuthContext, now = new Date()) {
  const studentId = auth.userId;
  const [simulations, embassy, documents, sessions] = await Promise.all([
    db
      .from('simulations')
      .select('completed_at, total_questions, score_by_section, test_templates(name)')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .neq('mode', 'revision')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100),
    db
      .from('embassy_sessions')
      .select('completed_at, overall_score, ai_report')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(50),
    getStudentDocumentsSpace(studentId),
    listClassSessions(auth, { from: now.toISOString(), to: new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString() }),
  ]);
  if (simulations.error) throw simulations.error;
  if (embassy.error) throw embassy.error;

  const simulationPoints = (simulations.data as unknown as SimulationRow[])
    .filter((row) => row.score_by_section && row.total_questions > 0)
    .map((row) => ({
      completedAt: row.completed_at,
      accuracy: Object.values(row.score_by_section!).reduce((sum, section) => sum + section.correct, 0) / row.total_questions,
      templateName: row.test_templates?.name ?? null,
    }));

  const embassyPoints = (embassy.data as unknown as EmbassyRow[])
    .filter((row) => row.overall_score !== null && row.completed_at)
    .map((row) => ({
      completedAt: row.completed_at,
      overallScore: row.overall_score!,
      coherence: typeof row.ai_report?.dimensions?.coherence_project === 'number' ? row.ai_report.dimensions.coherence_project : null,
      inconsistencies: Array.isArray(row.ai_report?.inconsistencies) ? row.ai_report.inconsistencies.length : 0,
    }));

  const items = documents.checklist.items;
  const horizon = new Date(now.getTime() + EXPIRY_HORIZON_DAYS * DAY_MS).toISOString().slice(0, 10);
  const expiries = items
    .filter((item) => item.document?.expiresAt && (item.status === 'expired' || item.document.expiresAt <= horizon))
    .map((item) => ({ label: item.label, expiresAt: item.document!.expiresAt!, expired: item.status === 'expired' }));

  return {
    simulations: summarizeSimulations(simulationPoints),
    embassy: summarizeEmbassy(embassyPoints),
    documents: {
      total: items.length,
      validated: items.filter((item) => item.status === 'validated').length,
      missing: items.filter((item) => item.status === 'missing' && item.documentType).length,
      needsCorrection: items.filter((item) => item.status === 'needs_correction').length,
      expired: items.filter((item) => item.status === 'expired').length,
      expiringSoon: items.filter((item) => item.expiringSoon).length,
    },
    upcoming: buildUpcoming(sessions, expiries),
    generatedAt: now.toISOString(),
  };
}
