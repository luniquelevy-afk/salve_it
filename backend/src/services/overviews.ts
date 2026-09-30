// Tableaux de bord agrégés (anciennes fonctions SQL teacher_overview, admin_overview,
// documents_overview et vue question_success_stats), recalculés à partir de Firestore.
import { db } from '../lib/db/index.js';
import { buildAnalytics, type DashboardPeriod } from './dashboard-analytics.js';

type Row = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();
// current_date (UTC) + n jours, pour les colonnes de type date.
const dateFromToday = (days: number) => isoDaysFromNow(days).slice(0, 10);

async function rows<T = Row>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

// round() Postgres : arrondi au plus proche, demi-valeurs éloignées de zéro.
function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

const percent = (part: number, total: number) => (total > 0 ? round((100 * part) / total) : null);
const average = (values: number[]) => (values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const byName = (a: string, b: string) => a.localeCompare(b, 'fr');

function groupBy<T>(items: T[], key: (item: T) => unknown): Map<unknown, T[]> {
  const groups = new Map<unknown, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}

function latest(values: (string | null | undefined)[]): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Taux de réussite par question (ex-vue question_success_stats) : simulations terminées uniquement
// ─────────────────────────────────────────────────────────────
export interface QuestionSuccessStat {
  question_id: string;
  answers_count: number;
  correct_count: number;
  blank_count: number;
  avg_time_seconds: number | null;
}

async function completedAnswers(answers: Row[]): Promise<Row[]> {
  const simulationIds = [...new Set(answers.map((answer) => answer.simulation_id as string))];
  if (simulationIds.length === 0) return [];
  const completed = await rows<{ id: string }>(db.from('simulations').select('id').in('id', simulationIds).eq('status', 'completed'));
  const completedIds = new Set(completed.map((simulation) => simulation.id));
  return answers.filter((answer) => completedIds.has(answer.simulation_id as string));
}

function successStats(answers: Row[]): QuestionSuccessStat[] {
  return [...groupBy(answers, (answer) => answer.question_id)].map(([questionId, group]) => ({
    question_id: questionId as string,
    answers_count: group.length,
    correct_count: group.filter((answer) => answer.is_correct === true).length,
    blank_count: group.filter((answer) => answer.answer_given === null).length,
    avg_time_seconds: group.length > 0 ? round(average(group.map((answer) => answer.time_spent_seconds as number)) ?? 0) : null,
  }));
}

export async function questionSuccessStats(questionIds?: string[]): Promise<QuestionSuccessStat[]> {
  if (questionIds && questionIds.length === 0) return [];
  const query = db.from('simulation_answers').select('simulation_id, question_id, answer_given, is_correct, time_spent_seconds');
  const answers = await rows(questionIds ? query.in('question_id', questionIds) : query);
  return successStats(await completedAnswers(answers));
}

// ─────────────────────────────────────────────────────────────
// Tableau de bord enseignant (ou admin : toutes les classes actives)
// ─────────────────────────────────────────────────────────────
export async function teacherOverview(teacherId: string | null) {
  const now = new Date().toISOString();
  const since30 = isoDaysFromNow(-30);
  const since14 = isoDaysFromNow(-14);

  let classQuery = db.from('classes').select('id, name').eq('is_active', true);
  if (teacherId) classQuery = classQuery.eq('teacher_id', teacherId);
  const myClasses = await rows<{ id: string; name: string }>(classQuery);
  const classIds = myClasses.map((klass) => klass.id);
  const classNames = new Map(myClasses.map((klass) => [klass.id, klass.name]));

  const memberships = await rows<{ class_id: string; student_id: string }>(db.from('class_students').select('class_id, student_id').in('class_id', classIds));
  const studentIds = [...new Set(memberships.map((membership) => membership.student_id))];

  const [profiles, simulations, exerciseAttempts, embassySessions, feedback, classSessions, assignments] = await Promise.all([
    rows<{ id: string; full_name: string; level: string | null; status: string }>(db.from('profiles').select('id, full_name, level, status').in('id', studentIds)),
    rows<Row>(db.from('simulations').select('id, student_id, mode, status, started_at, completed_at, score').in('student_id', studentIds)),
    rows<{ student_id: string; created_at: string }>(db.from('exercise_attempts').select('student_id, created_at').in('student_id', studentIds)),
    rows<Row>(db.from('embassy_sessions').select('id, student_id, status, visa_type, started_at, completed_at, overall_score').in('student_id', studentIds)),
    rows<Row>(db.from('teacher_feedback').select('id, student_id, target_type, target_id, teacher_id, comment, follow_up_at, status').in('student_id', studentIds)),
    rows<{ id: string; class_id: string; starts_at: string }>(db.from('class_sessions').select('id, class_id, starts_at').in('class_id', classIds).gte('starts_at', since30)),
    rows<Row>(db.from('homework_assignments').select('id, title, class_id, due_at').in('class_id', classIds)),
  ]);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  // Réponses des 30 derniers jours (simulations terminées), avec la catégorie de la question.
  const recentSimulations = simulations.filter((simulation) => simulation.status === 'completed' && (simulation.completed_at as string) >= since30);
  const recentAnswers = await rows<Row>(
    db.from('simulation_answers').select('simulation_id, question_id, is_correct').in('simulation_id', recentSimulations.map((simulation) => simulation.id as string)),
  );
  const questions = await rows<{ id: string; question_text: string; category: string }>(
    db.from('questions').select('id, question_text, category').in('id', [...new Set(recentAnswers.map((answer) => answer.question_id as string))]),
  );
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const studentOfSimulation = new Map(recentSimulations.map((simulation) => [simulation.id, simulation.student_id as string]));
  const answers = recentAnswers.map((answer) => ({
    studentId: studentOfSimulation.get(answer.simulation_id) as string,
    questionId: answer.question_id as string,
    correct: answer.is_correct === true,
    category: questionById.get(answer.question_id as string)?.category ?? null,
  }));

  const [attendance, submissions] = await Promise.all([
    rows<{ session_id: string; student_id: string; status: string }>(db.from('class_attendance').select('session_id, student_id, status').in('session_id', classSessions.map((session) => session.id))),
    rows<{ assignment_id: string; student_id: string; status: string }>(db.from('homework_submissions').select('assignment_id, student_id, status').in('assignment_id', assignments.map((assignment) => assignment.id as string))),
  ]);

  const accuracy = (group: { correct: boolean }[]) => percent(group.filter((answer) => answer.correct).length, group.length);
  const reviewed = new Set(feedback.map((item) => `${item.target_type as string}:${item.target_id as string}`));
  const nameOf = (studentId: string) => profileById.get(studentId)?.full_name ?? null;

  const students = studentIds
    .map((id) => profileById.get(id))
    .filter((profile): profile is NonNullable<typeof profile> => profile?.status === 'active')
    .map((profile) => {
      const mySimulations = simulations.filter((simulation) => simulation.student_id === profile.id);
      const mySessions = embassySessions.filter((session) => session.student_id === profile.id);
      const lastActivityAt = latest([
        ...mySimulations.map((simulation) => simulation.started_at as string),
        ...exerciseAttempts.filter((attempt) => attempt.student_id === profile.id).map((attempt) => attempt.created_at),
        ...mySessions.map((session) => session.started_at as string),
      ]);
      const myAnswers = answers.filter((answer) => answer.studentId === profile.id);
      const myClassIds = memberships.filter((membership) => membership.student_id === profile.id).map((membership) => membership.class_id);
      const myAttendance = attendance.filter((record) => record.student_id === profile.id);
      const accuracy30 = accuracy(myAnswers);
      const attendanceRate30 = percent(
        myAttendance.filter((record) => record.status === 'present' || record.status === 'retard').length,
        myAttendance.filter((record) => record.status !== 'excuse').length,
      );
      const homeworkMissing = assignments.filter(
        (assignment) =>
          myClassIds.includes(assignment.class_id as string) &&
          (assignment.due_at as string) < now &&
          (assignment.due_at as string) >= isoDaysFromNow(-60) &&
          !submissions.some((submission) => submission.assignment_id === assignment.id && submission.student_id === profile.id),
      ).length;
      const completedScores = mySessions.filter((session) => session.status === 'completed' && session.overall_score !== null).map((session) => session.overall_score as number);
      const embassyAverage = average(completedScores);
      const inactive = lastActivityAt === null || lastActivityAt < since14;
      return {
        id: profile.id,
        fullName: profile.full_name,
        level: profile.level,
        classNames: myClassIds.map((id) => classNames.get(id) as string).sort(byName).join(', ') || null,
        lastActivityAt,
        simulations30: mySimulations.filter((simulation) => simulation.status === 'completed' && (simulation.completed_at as string) >= since30).length,
        answers30: myAnswers.length,
        accuracy30,
        embassyAverage: embassyAverage === null ? null : round(embassyAverage),
        attendanceRate30,
        homeworkMissing,
        inactive,
        atRisk: inactive || (myAnswers.length >= 10 && (accuracy30 ?? 100) < 50) || (attendanceRate30 !== null && attendanceRate30 < 70) || homeworkMissing >= 3,
      };
    })
    .sort((a, b) => byName(a.fullName, b.fullName));

  const weakCategories = [...groupBy(answers.filter((answer) => answer.category !== null), (answer) => answer.category)]
    .map(([category, group]) => ({ category: category as string, answers: group.length, accuracy: accuracy(group) as number }))
    .filter((entry) => entry.answers >= 5)
    .sort((a, b) => a.accuracy - b.accuracy || byName(a.category, b.category))
    .slice(0, 5);

  const hardestQuestions = [...groupBy(answers, (answer) => answer.questionId)]
    .map(([questionId, group]) => ({ id: questionId as string, answers: group.length, successRate: accuracy(group) as number }))
    .filter((entry) => entry.answers >= 3 && questionById.has(entry.id))
    .sort((a, b) => a.successRate - b.successRate || b.answers - a.answers)
    .slice(0, 8)
    .map((entry) => ({ id: entry.id, text: questionById.get(entry.id)?.question_text, category: questionById.get(entry.id)?.category, answers: entry.answers, successRate: entry.successRate }));

  const toReview = [
    ...embassySessions
      .filter((session) => session.status === 'completed' && (session.completed_at as string) >= since30 && !reviewed.has(`embassy_session:${session.id as string}`))
      .map((session) => ({ type: 'embassy_session', id: session.id, studentId: session.student_id, studentName: nameOf(session.student_id as string), completedAt: session.completed_at, score: session.overall_score, label: session.visa_type })),
    ...simulations
      .filter((simulation) => simulation.status === 'completed' && simulation.mode === 'examen' && (simulation.completed_at as string) >= since14 && !reviewed.has(`simulation:${simulation.id as string}`))
      .map((simulation) => ({ type: 'simulation', id: simulation.id, studentId: simulation.student_id, studentName: nameOf(simulation.student_id as string), completedAt: simulation.completed_at, score: simulation.score, label: simulation.mode })),
  ]
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)))
    .slice(0, 20);

  const followUpLimit = dateFromToday(7);
  const followUps = feedback
    .filter((item) => item.status === 'a_revoir' && item.follow_up_at !== null && (item.follow_up_at as string) <= followUpLimit && (teacherId === null || item.teacher_id === teacherId))
    .sort((a, b) => String(a.follow_up_at).localeCompare(String(b.follow_up_at)))
    .map((item) => ({ id: item.id, studentId: item.student_id, studentName: nameOf(item.student_id as string), comment: item.comment, followUpAt: item.follow_up_at }));

  const activeStudents = new Set(profiles.filter((profile) => profile.status === 'active').map((profile) => profile.id));
  const homework = assignments
    .filter((assignment) => (assignment.due_at as string) >= since14 && (assignment.due_at as string) <= isoDaysFromNow(7))
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
    .slice(0, 20)
    .map((assignment) => {
      const mySubmissions = submissions.filter((submission) => submission.assignment_id === assignment.id);
      return {
        id: assignment.id,
        title: assignment.title,
        classId: assignment.class_id,
        className: classNames.get(assignment.class_id as string),
        dueAt: assignment.due_at,
        students: memberships.filter((membership) => membership.class_id === assignment.class_id && activeStudents.has(membership.student_id)).length,
        submitted: mySubmissions.length,
        toReview: mySubmissions.filter((submission) => submission.status === 'rendu').length,
      };
    });

  return {
    classes: myClasses
      .map((klass) => ({ id: klass.id, name: klass.name, studentCount: memberships.filter((membership) => membership.class_id === klass.id).length }))
      .sort((a, b) => byName(a.name, b.name)),
    students,
    weakCategories,
    hardestQuestions,
    toReview,
    followUps,
    homework,
  };
}

// ─────────────────────────────────────────────────────────────
// Tableau de bord admin
// ─────────────────────────────────────────────────────────────
export async function adminOverview(days: DashboardPeriod = 30) {
  const since = (days: number) => isoDaysFromNow(-days);
  const nowIso = new Date().toISOString();
  const today = new Date();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString();

  // Fenêtre lue : 90 jours (indicateurs d'activité) ou deux périodes (comparaison avec la précédente).
  const horizon = since(Math.max(90, 2 * days));
  const usageFrom = [monthStart, since(2 * days)].sort()[0] as string;
  const [activeProfiles, simulations, attempts, embassy, usage, leads] = await Promise.all([
    rows<{ id: string; role: string; level: string | null }>(db.from('profiles').select('id, role, level').eq('status', 'active')),
    rows<Row>(db.from('simulations').select('id, student_id, mode, status, started_at, completed_at, score_by_section').gte('started_at', horizon)),
    rows<{ student_id: string; created_at: string }>(db.from('exercise_attempts').select('student_id, created_at').gte('created_at', horizon)),
    rows<Row>(db.from('embassy_sessions').select('student_id, status, input_mode, started_at, ended_at, completed_at, overall_score')),
    rows<{ student_id: string | null; operation: string; estimated_cost: number; created_at: string }>(db.from('ai_usage_logs').select('student_id, operation, estimated_cost, created_at').gte('created_at', usageFrom)),
    rows<Row>(db.from('leads').select('status, source, created_at, next_follow_up_at')),
  ]);

  const monthUsage = usage.filter((entry) => entry.created_at >= monthStart);
  const active = new Set(activeProfiles.map((profile) => profile.id));
  const lastActivity = new Map<string, string>();
  const track = (studentId: unknown, at: unknown) => {
    if (typeof studentId !== 'string' || typeof at !== 'string' || !active.has(studentId)) return;
    if ((lastActivity.get(studentId) ?? '') < at) lastActivity.set(studentId, at);
  };
  for (const simulation of simulations) track(simulation.student_id, simulation.started_at);
  for (const attempt of attempts) track(attempt.student_id, attempt.created_at);
  for (const session of embassy) track(session.student_id, session.started_at);
  const activeSince = (days: number) => [...lastActivity.values()].filter((at) => at >= since(days)).length;

  const completed30 = simulations.filter((simulation) => simulation.status === 'completed' && (simulation.completed_at as string) >= since(30));
  const answers30 = await rows<{ is_correct: boolean }>(db.from('simulation_answers').select('is_correct').in('simulation_id', completed30.map((simulation) => simulation.id as string)));

  const embassy30 = embassy.filter((session) => (session.started_at as string) >= since(30));
  const completedScores = embassy.filter((session) => session.status === 'completed' && session.overall_score !== null).map((session) => session.overall_score as number);
  const durations = embassy30.filter((session) => session.ended_at).map((session) => (Date.parse(session.ended_at as string) - Date.parse(session.started_at as string)) / 60_000);

  const monthCost = monthUsage.reduce((sum, usage) => sum + Number(usage.estimated_cost), 0);
  const monthStudents = new Set(monthUsage.map((usage) => usage.student_id).filter((id) => id !== null)).size;
  const byOperation = [...groupBy(monthUsage, (usage) => usage.operation)]
    .map(([operation, group]) => ({ operation, calls: group.length, cost: round(group.reduce((sum, usage) => sum + Number(usage.estimated_cost), 0), 4) }))
    .sort((a, b) => b.cost - a.cost);

  const hardest = (await questionSuccessStats())
    .filter((stat) => stat.answers_count >= 5)
    .sort((a, b) => a.correct_count / a.answers_count - b.correct_count / b.answers_count || b.answers_count - a.answers_count)
    .slice(0, 10);
  const hardestQuestions = await rows<{ id: string; question_text: string; category: string }>(db.from('questions').select('id, question_text, category').in('id', hardest.map((stat) => stat.question_id)));
  const questionById = new Map(hardestQuestions.map((question) => [question.id, question]));

  return {
    students: {
      total: activeProfiles.filter((profile) => profile.role === 'student').length,
      active7: activeSince(7),
      active30: activeSince(30),
      active90: activeSince(90),
    },
    simulations: {
      completed30: completed30.length,
      accuracy30: percent(answers30.filter((answer) => answer.is_correct).length, answers30.length),
    },
    exercises: { attempts30: attempts.filter((attempt) => attempt.created_at >= since(30)).length },
    embassy: {
      sessions30: embassy30.length,
      completed30: embassy30.filter((session) => session.status === 'completed').length,
      failureRate30: percent(embassy30.filter((session) => session.status === 'failed').length, embassy30.length),
      textModeShare30: percent(embassy30.filter((session) => session.input_mode === 'text').length, embassy30.length),
      averageScore: completedScores.length > 0 ? round(average(completedScores) as number) : null,
      averageDurationMinutes: durations.length > 0 ? round(average(durations) as number) : null,
    },
    ai: {
      monthCost: round(monthCost, 4),
      monthCalls: monthUsage.length,
      costPerStudent: monthStudents > 0 ? round(monthCost / monthStudents, 4) : null,
      byOperation,
    },
    leads: {
      total: leads.length,
      new30: leads.filter((lead) => (lead.created_at as string) >= since(30)).length,
      converted: leads.filter((lead) => lead.status === 'inscrit').length,
      toFollowUp: leads.filter((lead) => lead.next_follow_up_at !== null && (lead.next_follow_up_at as string) <= nowIso && !['inscrit', 'non_interesse'].includes(lead.status as string)).length,
      bySource: [...groupBy(leads, (lead) => lead.source)].map(([source, group]) => ({ source, total: group.length })),
    },
    hardestQuestions: hardest
      .filter((stat) => questionById.has(stat.question_id))
      .map((stat) => ({
        id: stat.question_id,
        text: questionById.get(stat.question_id)?.question_text,
        category: questionById.get(stat.question_id)?.category,
        answers: stat.answers_count,
        successRate: round((100 * stat.correct_count) / stat.answers_count),
      })),
    analytics: buildAnalytics({ days, now: new Date(), profiles: activeProfiles, simulations, attempts, embassy, aiUsage: usage, leads }),
  };
}

// ─────────────────────────────────────────────────────────────
// Documents à vérifier / qui expirent (enseignant : étudiants de ses classes actives)
// ─────────────────────────────────────────────────────────────
export async function documentsOverview(teacherId: string | null) {
  let students = await rows<{ id: string; full_name: string }>(db.from('profiles').select('id, full_name').eq('role', 'student').eq('status', 'active'));
  if (teacherId) {
    const classIds = (await rows<{ id: string }>(db.from('classes').select('id').eq('teacher_id', teacherId).eq('is_active', true))).map((klass) => klass.id);
    const followed = new Set((await rows<{ student_id: string }>(db.from('class_students').select('student_id').in('class_id', classIds))).map((row) => row.student_id));
    students = students.filter((student) => followed.has(student.id));
  }
  const names = new Map(students.map((student) => [student.id, student.full_name]));

  const [documents, types] = await Promise.all([
    rows<Row>(db.from('student_documents').select('id, student_id, document_type, status, current_version, expires_at, updated_at').in('student_id', [...names.keys()])),
    rows<{ code: string; label: string }>(db.from('document_types').select('code, label')),
  ]);
  const labels = new Map(types.map((type) => [type.code, type.label]));
  const expiryLimit = dateFromToday(30);
  const submitted = documents.filter((document) => document.status === 'submitted').sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)));
  const expiring = documents.filter((document) => document.expires_at !== null && (document.expires_at as string) <= expiryLimit).sort((a, b) => String(a.expires_at).localeCompare(String(b.expires_at)));

  return {
    toReviewCount: submitted.length,
    expiringCount: expiring.length,
    toReview: submitted.slice(0, 20).map((document) => ({
      id: document.id,
      studentId: document.student_id,
      studentName: names.get(document.student_id as string),
      documentType: labels.get(document.document_type as string),
      version: document.current_version,
      updatedAt: document.updated_at,
    })),
    expiring: expiring.slice(0, 20).map((document) => ({
      id: document.id,
      studentId: document.student_id,
      studentName: names.get(document.student_id as string),
      documentType: labels.get(document.document_type as string),
      expiresAt: document.expires_at,
    })),
  };
}
