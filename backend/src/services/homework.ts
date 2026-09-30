// §13 : devoirs de classe — l'enseignant publie, l'étudiant rend, l'enseignant valide ou demande une reprise.
import { formatBrazzavilleDateTime } from '../lib/dates.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { db } from '../lib/db/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, classIdsForStudent } from './access.js';
import { classRoster } from './attendance.js';
import { recordAudit } from './audit.js';
import { activeClassStudentIds } from './calendar.js';
import { notify, notifySafely } from './notifications.js';

const DAY_MS = 86_400_000;

export type SubmissionStatus = 'rendu' | 'valide' | 'a_reprendre';
export type HomeworkState = 'a_faire' | 'en_retard' | SubmissionStatus;

export function homeworkState(dueAt: string, submission: { status: SubmissionStatus } | null, now = new Date()): HomeworkState {
  if (submission) return submission.status;
  return Date.parse(dueAt) < now.getTime() ? 'en_retard' : 'a_faire';
}

export const isLateSubmission = (dueAt: string, submittedAt: string) => Date.parse(submittedAt) > Date.parse(dueAt);

const ASSIGNMENT_COLUMNS = 'id, class_id, title, instructions, due_at, course_id, exercise_id, created_at, classes(name, is_active), courses(title), exercises(title)';

interface AssignmentRow {
  id: string;
  class_id: string;
  title: string;
  instructions: string | null;
  due_at: string;
  course_id: string | null;
  exercise_id: string | null;
  created_at: string;
  classes: { name: string; is_active: boolean } | null;
  courses: { title: string } | null;
  exercises: { title: string } | null;
}

interface SubmissionRow {
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  answer: string | null;
  submitted_at: string;
  teacher_comment: string | null;
  reviewed_at: string | null;
}

const SUBMISSION_COLUMNS = 'assignment_id, student_id, status, answer, submitted_at, teacher_comment, reviewed_at';

function toAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.classes?.name ?? null,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at,
    course: row.course_id ? { id: row.course_id, title: row.courses?.title ?? null } : null,
    exercise: row.exercise_id ? { id: row.exercise_id, title: row.exercises?.title ?? null } : null,
    createdAt: row.created_at,
  };
}

async function loadAssignment(id: string): Promise<AssignmentRow> {
  const { data, error } = await db.from('homework_assignments').select(ASSIGNMENT_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'homework_not_found', 'Devoir introuvable.');
  return data as unknown as AssignmentRow;
}

export interface HomeworkInput {
  title: string;
  instructions?: string | null | undefined;
  dueAt: string;
  courseId?: string | null | undefined;
  exerciseId?: string | null | undefined;
}

async function assertResources(input: HomeworkInput) {
  for (const [table, id] of [
    ['courses', input.courseId],
    ['exercises', input.exerciseId],
  ] as const) {
    if (!id) continue;
    const { data, error } = await db.from(table).select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(400, 'resource_not_found', table === 'courses' ? 'Cours introuvable.' : 'Exercice introuvable.');
  }
}

const toRow = (input: HomeworkInput) => ({
  title: input.title,
  instructions: input.instructions?.trim() || null,
  due_at: input.dueAt,
  course_id: input.courseId ?? null,
  exercise_id: input.exerciseId ?? null,
});

// ── Enseignant ──────────────────────────────────────────────

export async function listClassHomework(auth: AuthContext, classId: string) {
  await assertCanManageClass(auth, classId);
  const [assignments, roster] = await Promise.all([
    db.from('homework_assignments').select(ASSIGNMENT_COLUMNS).eq('class_id', classId).order('due_at', { ascending: false }).limit(100),
    classRoster(classId),
  ]);
  if (assignments.error) throw assignments.error;
  const rows = assignments.data as unknown as AssignmentRow[];

  const submissions: { assignment_id: string; status: SubmissionStatus }[] = [];
  if (rows.length > 0) {
    const { data, error } = await db.from('homework_submissions').select('assignment_id, status').in('assignment_id', rows.map((row) => row.id));
    if (error) throw error;
    submissions.push(...(data as { assignment_id: string; status: SubmissionStatus }[]));
  }
  const activeStudents = roster.filter((student) => student.status === 'active').length;

  return rows.map((row) => {
    const mine = submissions.filter((submission) => submission.assignment_id === row.id);
    return {
      ...toAssignment(row),
      counts: {
        students: activeStudents,
        submitted: mine.length,
        toReview: mine.filter((submission) => submission.status === 'rendu').length,
        validated: mine.filter((submission) => submission.status === 'valide').length,
        toRework: mine.filter((submission) => submission.status === 'a_reprendre').length,
      },
    };
  });
}

export async function getHomeworkDetail(auth: AuthContext, id: string, now = new Date()) {
  const row = await loadAssignment(id);
  await assertCanManageClass(auth, row.class_id);
  const [roster, submissions] = await Promise.all([classRoster(row.class_id), db.from('homework_submissions').select(SUBMISSION_COLUMNS).eq('assignment_id', id)]);
  if (submissions.error) throw submissions.error;
  const byStudent = new Map((submissions.data as SubmissionRow[]).map((submission) => [submission.student_id, submission]));

  return {
    assignment: toAssignment(row),
    students: roster.map((student) => {
      const submission = byStudent.get(student.id) ?? null;
      return {
        ...student,
        state: homeworkState(row.due_at, submission, now),
        answer: submission?.answer ?? null,
        submittedAt: submission?.submitted_at ?? null,
        late: submission ? isLateSubmission(row.due_at, submission.submitted_at) : false,
        teacherComment: submission?.teacher_comment ?? null,
        reviewedAt: submission?.reviewed_at ?? null,
      };
    }),
  };
}

export async function createHomework(auth: AuthContext, classId: string, input: HomeworkInput) {
  await assertCanManageClass(auth, classId);
  await assertResources(input);
  const { data, error } = await db
    .from('homework_assignments')
    .insert({ ...toRow(input), class_id: classId, created_by: auth.userId })
    .select(ASSIGNMENT_COLUMNS)
    .single();
  if (error) throw error;
  const row = data as unknown as AssignmentRow;
  await recordAudit({ actorId: auth.userId, action: 'homework.create', entityType: 'homework_assignment', entityId: row.id });

  // §15 « devoir à réaliser ».
  try {
    await notifySafely(await activeClassStudentIds(classId), {
      type: 'homework_assigned',
      title: `Nouveau devoir : ${row.title}`,
      body: `À rendre avant le ${formatBrazzavilleDateTime(row.due_at)}.`,
      link: '/etudiant/devoirs',
      dedupeKey: `homework:${row.id}`,
      email: true,
    });
  } catch (err) {
    logger.error({ err, homeworkId: row.id }, 'homework_notification_failed');
  }
  return toAssignment(row);
}

export async function updateHomework(auth: AuthContext, id: string, input: HomeworkInput) {
  const current = await loadAssignment(id);
  await assertCanManageClass(auth, current.class_id);
  await assertResources(input);
  const { data, error } = await db.from('homework_assignments').update(toRow(input)).eq('id', id).select(ASSIGNMENT_COLUMNS).single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'homework.update', entityType: 'homework_assignment', entityId: id });
  return toAssignment(data as unknown as AssignmentRow);
}

export async function deleteHomework(auth: AuthContext, id: string) {
  const current = await loadAssignment(id);
  await assertCanManageClass(auth, current.class_id);
  const { error } = await db.from('homework_assignments').delete().eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'homework.delete', entityType: 'homework_assignment', entityId: id, metadata: { title: current.title } });
}

export async function reviewSubmission(auth: AuthContext, assignmentId: string, studentId: string, input: { status: 'valide' | 'a_reprendre'; comment?: string | null | undefined }) {
  const row = await loadAssignment(assignmentId);
  await assertCanManageClass(auth, row.class_id);
  const comment = input.comment?.trim() || null;
  if (input.status === 'a_reprendre' && !comment) throw new HttpError(400, 'comment_required', 'Indiquez à l’étudiant ce qu’il doit reprendre.');

  const reviewedAt = new Date().toISOString();
  const { data, error } = await db
    .from('homework_submissions')
    .update({ status: input.status, teacher_comment: comment, reviewed_by: auth.userId, reviewed_at: reviewedAt })
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .select('student_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'submission_not_found', 'Ce devoir n’a pas encore été rendu par cet étudiant.');
  await recordAudit({ actorId: auth.userId, action: 'homework.review', entityType: 'homework_assignment', entityId: assignmentId, metadata: { studentId, status: input.status } });

  await notifySafely([studentId], {
    type: 'homework_reviewed',
    title: input.status === 'valide' ? `Devoir validé : ${row.title}` : `Devoir à reprendre : ${row.title}`,
    body: comment ?? undefined,
    link: '/etudiant/devoirs',
    dedupeKey: `homework_review:${assignmentId}:${studentId}:${reviewedAt}`,
    // Une reprise demandée appelle une action de l'étudiant : email ; une validation reste in-app.
    email: input.status === 'a_reprendre',
  });
  return getHomeworkDetail(auth, assignmentId);
}

// ── Étudiant ────────────────────────────────────────────────

export async function listMyHomework(studentId: string, now = new Date()) {
  const classIds = await classIdsForStudent(studentId);
  if (classIds.length === 0) return [];
  const since = new Date(now.getTime() - 60 * DAY_MS).toISOString();
  const { data, error } = await db
    .from('homework_assignments')
    .select(ASSIGNMENT_COLUMNS)
    .in('class_id', classIds)
    .gte('due_at', since)
    .order('due_at')
    .limit(200);
  if (error) throw error;
  const rows = data as unknown as AssignmentRow[];
  if (rows.length === 0) return [];

  const { data: submissions, error: submissionsError } = await db
    .from('homework_submissions')
    .select(SUBMISSION_COLUMNS)
    .eq('student_id', studentId)
    .in('assignment_id', rows.map((row) => row.id));
  if (submissionsError) throw submissionsError;
  const byAssignment = new Map((submissions as SubmissionRow[]).map((submission) => [submission.assignment_id, submission]));

  return rows.map((row) => {
    const submission = byAssignment.get(row.id) ?? null;
    return {
      ...toAssignment(row),
      state: homeworkState(row.due_at, submission, now),
      submission: submission
        ? {
            answer: submission.answer,
            submittedAt: submission.submitted_at,
            late: isLateSubmission(row.due_at, submission.submitted_at),
            teacherComment: submission.teacher_comment,
            reviewedAt: submission.reviewed_at,
          }
        : null,
    };
  });
}

export async function submitHomework(studentId: string, assignmentId: string, answer: string | null | undefined) {
  const row = await loadAssignment(assignmentId);
  // Devoir d'une autre classe : même réponse qu'un devoir inexistant.
  if (!(await classIdsForStudent(studentId)).includes(row.class_id)) throw new HttpError(404, 'homework_not_found', 'Devoir introuvable.');

  const { data: existing, error: existingError } = await db.from('homework_submissions').select('status').eq('assignment_id', assignmentId).eq('student_id', studentId).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === 'valide') throw new HttpError(409, 'homework_validated', 'Ce devoir a déjà été validé par votre enseignant.');

  const { error } = await db.from('homework_submissions').upsert(
    { assignment_id: assignmentId, student_id: studentId, status: 'rendu', answer: answer?.trim() || null, submitted_at: new Date().toISOString(), reviewed_by: null, reviewed_at: null },
    { onConflict: 'assignment_id,student_id' },
  );
  if (error) throw error;
  return (await listMyHomework(studentId)).find((item) => item.id === assignmentId) ?? null;
}

// ── Rappel d'échéance (§15) ─────────────────────────────────

export async function sweepHomeworkDueSoon(now = new Date()): Promise<number> {
  const { data, error } = await db
    .from('homework_assignments')
    .select('id, class_id, title, due_at, classes!inner(is_active)')
    .eq('classes.is_active', true)
    .gt('due_at', now.toISOString())
    .lte('due_at', new Date(now.getTime() + DAY_MS).toISOString())
    .limit(200);
  if (error) throw error;

  let count = 0;
  for (const assignment of data as unknown as { id: string; class_id: string; title: string; due_at: string }[]) {
    const [students, submitted] = await Promise.all([
      activeClassStudentIds(assignment.class_id),
      db.from('homework_submissions').select('student_id').eq('assignment_id', assignment.id),
    ]);
    if (submitted.error) throw submitted.error;
    const done = new Set((submitted.data as { student_id: string }[]).map((row) => row.student_id));
    count += await notify(
      students.filter((id) => !done.has(id)),
      {
        type: 'homework_due_soon',
        title: `Devoir à rendre bientôt : ${assignment.title}`,
        body: `À rendre avant le ${formatBrazzavilleDateTime(assignment.due_at)}.`,
        link: '/etudiant/devoirs',
        dedupeKey: `homework_due:${assignment.id}:${new Date(assignment.due_at).toISOString()}`,
        email: true,
      },
    );
  }
  return count;
}

export function startHomeworkWorker(): NodeJS.Timeout {
  const tick = () => void sweepHomeworkDueSoon().catch((err: unknown) => logger.error({ err }, 'homework_sweep_failed'));
  tick();
  return setInterval(tick, 60 * 60_000);
}
