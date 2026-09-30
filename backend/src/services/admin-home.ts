// Accueil administrateur : uniquement ce qui demande une intervention, quatre indicateurs,
// l'activité récente et une tendance simple. Les statistiques détaillées restent sur
// la page Statistiques (adminOverview / dashboard-analytics).
import { db } from '../lib/db/index.js';

type Row = Record<string, unknown>;

const DAY_MS = 86_400_000;
const INACTIVE_DAYS = 7;
const PENDING_LEAD_STATUSES = ['nouveau', 'contacte', 'test_realise', 'interesse', 'a_relancer'];

async function rows<T = Row>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

const accuracyOf = (simulation: Row): number | null => {
  const sections = Object.values((simulation.score_by_section ?? {}) as Record<string, { correct?: number; total?: number }>);
  const total = sections.reduce((sum, section) => sum + (section.total ?? 0), 0);
  return total > 0 ? Math.round((100 * sections.reduce((sum, section) => sum + (section.correct ?? 0), 0)) / total) : null;
};

// ─────────────────────────────────────────────────────────────
// Activité récente : journal d'audit + événements sans acteur (simulations, prospects)
// ─────────────────────────────────────────────────────────────
export interface ActivityItem {
  kind: string;
  text: string;
  at: string;
  link: string | null;
}

type Describer = (actor: string, target: string | null, metadata: Row) => { text: string; link?: string | null } | null;

const ROLE_NOUNS: Record<string, string> = { student: 'l’étudiant', teacher: 'l’enseignant', admin: 'l’administrateur' };

// Seules les actions « importantes » (spec d'accueil) sont racontées ; le reste reste dans l'audit.
const DESCRIBE: Record<string, Describer> = {
  'account.create': (actor, target, metadata) => ({ text: `${actor} a créé le compte de ${ROLE_NOUNS[metadata.role as string] ?? ''} ${target ?? ''}`.replace(/\s+/g, ' ').trim(), link: '/admin/comptes' }),
  'account.suspend': (actor, target) => ({ text: `${actor} a suspendu le compte de ${target ?? 'un utilisateur'}`, link: '/admin/comptes' }),
  'account.reactivate': (actor, target) => ({ text: `${actor} a réactivé le compte de ${target ?? 'un utilisateur'}`, link: '/admin/comptes' }),
  'document.upload': (actor) => ({ text: `${actor} a déposé un document` }),
  'document.validate': (actor) => ({ text: `${actor} a validé un document` }),
  'document.request_correction': (actor) => ({ text: `${actor} a demandé la correction d’un document` }),
  'announcement.create': (actor) => ({ text: `${actor} a publié une annonce`, link: '/annonces' }),
  'course.create': (actor) => ({ text: `${actor} a créé un cours`, link: '/gestion/cours' }),
  'exercise.create': (actor) => ({ text: `${actor} a créé un exercice`, link: '/gestion/exercices' }),
  'program.create': (actor) => ({ text: `${actor} a ajouté un programme`, link: '/admin/programmes' }),
  'class.create': (actor) => ({ text: `${actor} a créé une classe`, link: '/classes' }),
  'homework.create': (actor) => ({ text: `${actor} a donné un devoir`, link: '/classes' }),
};

export async function recentActivity(limit = 8): Promise<ActivityItem[]> {
  const [audit, simulations, leads] = await Promise.all([
    rows<Row>(db.from('audit_logs').select('actor_id, action, entity_type, entity_id, metadata, created_at').gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())),
    rows<Row>(db.from('simulations').select('student_id, completed_at, score_by_section').eq('status', 'completed').gte('completed_at', new Date(Date.now() - 30 * DAY_MS).toISOString())),
    rows<Row>(db.from('leads').select('full_name, source, created_at').gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())),
  ]);
  const relevantAudit = audit.filter((entry) => DESCRIBE[entry.action as string]).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
  const latestSimulations = simulations.sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at))).slice(0, limit);

  const peopleIds = [
    ...new Set(
      [
        ...relevantAudit.flatMap((entry) => [entry.actor_id, entry.entity_type === 'profile' ? entry.entity_id : null]),
        ...latestSimulations.map((simulation) => simulation.student_id),
      ].filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const people = new Map((await rows<{ id: string; full_name: string }>(db.from('profiles').select('id, full_name').in('id', peopleIds))).map((person) => [person.id, person.full_name]));
  const nameOf = (id: unknown) => (typeof id === 'string' ? (people.get(id) ?? 'Un utilisateur') : 'Le système');

  const items: ActivityItem[] = [
    ...relevantAudit.flatMap((entry) => {
      const described = DESCRIBE[entry.action as string]!(nameOf(entry.actor_id), entry.entity_type === 'profile' ? nameOf(entry.entity_id) : null, (entry.metadata ?? {}) as Row);
      return described ? [{ kind: String(entry.action), text: described.text, at: String(entry.created_at), link: described.link ?? null }] : [];
    }),
    ...latestSimulations.map((simulation) => {
      const accuracy = accuracyOf(simulation);
      return {
        kind: 'simulation.completed',
        text: `${nameOf(simulation.student_id)} a terminé une simulation${accuracy === null ? '' : ` (${accuracy} %)`}`,
        at: String(simulation.completed_at),
        link: `/suivi/etudiants/${simulation.student_id as string}`,
      };
    }),
    ...leads.map((lead) => ({
      kind: 'lead.created',
      text: `Nouveau prospect : ${String(lead.full_name)} (${lead.source === 'level_test' ? 'test de niveau' : 'formulaire de contact'})`,
      at: String(lead.created_at),
      link: '/admin/prospects',
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Étudiants nécessitant un suivi
// ─────────────────────────────────────────────────────────────
export type FollowUpReason = 'inactive' | 'score_drop' | 'struggling' | 'document_to_review' | 'document_correction' | 'report_to_review';

export interface FollowUp {
  studentId: string;
  name: string;
  reason: FollowUpReason;
  detail: string;
  link: string;
}

// Une ligne par étudiant : motif le plus prioritaire, les autres en complément.
export function groupFollowUps(followUps: FollowUp[]): (FollowUp & { others: string[] })[] {
  const byStudent = new Map<string, FollowUp & { others: string[] }>();
  for (const item of followUps) {
    const existing = byStudent.get(item.studentId);
    if (existing) existing.others.push(item.detail);
    else byStudent.set(item.studentId, { ...item, others: [] });
  }
  return [...byStudent.values()];
}

export interface FollowUpInput {
  now: Date;
  students: { id: string; full_name: string; created_at: string }[];
  simulations: Row[];
  attempts: { student_id: string; created_at: string }[];
  embassy: Row[];
  documents: Row[];
  feedbackTargets: Set<string>;
}

export function buildFollowUps(input: FollowUpInput): FollowUp[] {
  const { now } = input;
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();
  const out: FollowUp[] = [];

  for (const student of input.students) {
    const link = `/suivi/etudiants/${student.id}`;
    const mine = (items: Row[]) => items.filter((item) => item.student_id === student.id);
    const activity = [
      ...mine(input.simulations).map((item) => item.started_at as string),
      ...input.attempts.filter((item) => item.student_id === student.id).map((item) => item.created_at),
      ...mine(input.embassy).map((item) => item.started_at as string),
    ].sort();
    const last = activity.at(-1) ?? null;
    if ((last ?? student.created_at) < since(INACTIVE_DAYS)) {
      const days = Math.floor((now.getTime() - Date.parse(last ?? student.created_at)) / DAY_MS);
      out.push({ studentId: student.id, name: student.full_name, reason: 'inactive', detail: last ? `Inactif depuis ${days} jours` : `Aucune activité depuis la création du compte (${days} j)`, link });
    }

    const completed = mine(input.simulations)
      .filter((item) => item.status === 'completed' && item.completed_at)
      .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
      .map(accuracyOf)
      .filter((value): value is number => value !== null);
    if (completed.length >= 2 && (completed[0] as number) <= (completed[1] as number) - 10) {
      out.push({ studentId: student.id, name: student.full_name, reason: 'score_drop', detail: `Score en baisse : ${completed[1]} % → ${completed[0]} %`, link });
    } else if (completed.length >= 3 && completed.slice(0, 3).every((value) => value < 50)) {
      out.push({ studentId: student.id, name: student.full_name, reason: 'struggling', detail: 'En difficulté : 3 dernières simulations sous 50 %', link });
    }

    const documents = mine(input.documents);
    const toReview = documents.filter((document) => document.status === 'submitted').length;
    if (toReview > 0) out.push({ studentId: student.id, name: student.full_name, reason: 'document_to_review', detail: `${toReview} document${toReview > 1 ? 's' : ''} à vérifier`, link });
    const corrections = documents.filter((document) => document.status === 'needs_correction').length;
    if (corrections > 0) out.push({ studentId: student.id, name: student.full_name, reason: 'document_correction', detail: `${corrections} document${corrections > 1 ? 's' : ''} à corriger par l’étudiant`, link });

    const reports = mine(input.embassy).filter((session) => session.status === 'completed' && (session.completed_at as string) >= since(14) && !input.feedbackTargets.has(session.id as string));
    if (reports.length > 0) out.push({ studentId: student.id, name: student.full_name, reason: 'report_to_review', detail: `Rapport d’entretien IA à consulter`, link: `/suivi/etudiants/${student.id}/entretiens/${reports[0]!.id as string}` });
  }

  const priority: FollowUpReason[] = ['document_to_review', 'report_to_review', 'score_drop', 'struggling', 'inactive', 'document_correction'];
  return out.sort((a, b) => priority.indexOf(a.reason) - priority.indexOf(b.reason) || a.name.localeCompare(b.name, 'fr'));
}

// Tendance hebdomadaire (12 semaines) : score moyen et nombre de simulations terminées.
export function weeklyTrend(simulations: Row[], now: Date, weeks = 12) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + DAY_MS;
  return Array.from({ length: weeks }, (_, index) => {
    const from = new Date(end - (weeks - index) * 7 * DAY_MS).toISOString();
    const to = new Date(end - (weeks - index - 1) * 7 * DAY_MS).toISOString();
    const inWeek = simulations.filter((item) => item.status === 'completed' && typeof item.completed_at === 'string' && item.completed_at >= from && item.completed_at < to);
    const scores = inWeek.map(accuracyOf).filter((value): value is number => value !== null);
    return {
      date: from.slice(0, 10),
      simulations: inWeek.length,
      averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
    };
  });
}

export async function adminHome(now = new Date()) {
  const horizon = new Date(now.getTime() - 90 * DAY_MS).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [profiles, simulations, attempts, embassy, documents, feedback, leads, activity] = await Promise.all([
    rows<{ id: string; role: string; full_name: string; created_at: string }>(db.from('profiles').select('id, role, full_name, created_at').eq('status', 'active')),
    rows<Row>(db.from('simulations').select('id, student_id, status, started_at, completed_at, score_by_section').gte('started_at', horizon)),
    rows<{ student_id: string; created_at: string }>(db.from('exercise_attempts').select('student_id, created_at').gte('created_at', horizon)),
    rows<Row>(db.from('embassy_sessions').select('id, student_id, status, started_at, completed_at').gte('started_at', horizon)),
    rows<Row>(db.from('student_documents').select('student_id, status')),
    rows<{ target_id: string }>(db.from('teacher_feedback').select('target_id').eq('target_type', 'embassy_session')),
    rows<{ status: string }>(db.from('leads').select('status')),
    recentActivity(),
  ]);

  const students = profiles.filter((profile) => profile.role === 'student');
  const studentIds = new Set(students.map((student) => student.id));
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const active30 = new Set(
    [
      ...simulations.filter((item) => (item.started_at as string) >= since30).map((item) => item.student_id),
      ...attempts.filter((item) => item.created_at >= since30).map((item) => item.student_id),
      ...embassy.filter((item) => (item.started_at as string) >= since30).map((item) => item.student_id),
    ].filter((id) => studentIds.has(id as string)),
  );

  const followUps = buildFollowUps({ now, students, simulations, attempts, embassy, documents, feedbackTargets: new Set(feedback.map((item) => item.target_id)) });
  const count = (reason: FollowUpReason) => followUps.filter((item) => item.reason === reason).length;

  return {
    kpis: {
      activeStudents: active30.size,
      enrolledStudents: students.length,
      teachers: profiles.filter((profile) => profile.role === 'teacher').length,
      simulationsThisMonth: simulations.filter((item) => item.status === 'completed' && typeof item.completed_at === 'string' && item.completed_at >= monthStart).length,
      pendingLeads: leads.filter((lead) => PENDING_LEAD_STATUSES.includes(lead.status)).length,
    },
    attention: {
      inactive: count('inactive'),
      documentsToReview: documents.filter((document) => document.status === 'submitted' && studentIds.has(document.student_id as string)).length,
      scoreDrops: count('score_drop') + count('struggling'),
      reportsToReview: count('report_to_review'),
    },
    followUps: groupFollowUps(followUps).slice(0, 8),
    followUpsTotal: groupFollowUps(followUps).length,
    activity,
    trend: weeklyTrend(simulations, now),
  };
}
