import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { classIdsForStudent, classScopeFilter, studentLevel, type CefrLevel } from './access.js';
import { recordAudit } from './audit.js';
import { compileExercise, gradeExercise, toExerciseInput, type ExerciseInput, type ExerciseType } from './exercise-grading.js';

interface ExerciseRow {
  id: string;
  course_id: string | null;
  title: string;
  level: CefrLevel;
  category: string;
  exercise_type: ExerciseType;
  instructions: string | null;
  content: Record<string, unknown>;
  solution: Record<string, unknown>;
  is_published: boolean;
  created_by: string | null;
  updated_at: string;
}

const PUBLIC_COLUMNS = 'id, course_id, title, level, category, exercise_type, instructions, content, is_published, updated_at';
const ALL_COLUMNS = `${PUBLIC_COLUMNS}, solution, created_by`;

// Jamais de solution dans ce format : c'est tout ce que voit un étudiant.
function toPublicExercise(row: Omit<ExerciseRow, 'solution' | 'created_by'>) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    level: row.level,
    category: row.category,
    exerciseType: row.exercise_type,
    instructions: row.instructions,
    content: row.content,
    updatedAt: row.updated_at,
  };
}

export interface ExerciseMeta {
  title: string;
  level: CefrLevel;
  category: string;
  instructions?: string | null | undefined;
  courseId?: string | null | undefined;
  isPublished: boolean;
}

// Un exercice rattaché à un cours de classe hérite de sa visibilité.
async function assertStudentCanAccess(studentId: string, row: Pick<ExerciseRow, 'course_id' | 'is_published'>) {
  if (!row.is_published) throw new HttpError(404, 'exercise_not_found', 'Exercice introuvable.');
  if (!row.course_id) return;
  const classIds = await classIdsForStudent(studentId);
  const { data, error } = await db
    .from('courses')
    .select('id')
    .eq('id', row.course_id)
    .eq('is_published', true)
    .or(classScopeFilter(classIds))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'exercise_not_found', 'Exercice introuvable.');
}

// ── Étudiant ────────────────────────────────────────────────

export async function listStudentExercises(studentId: string, filters: { level?: CefrLevel | 'all' | undefined }) {
  const level = await studentLevel(studentId);
  const effectiveLevel = filters.level === 'all' ? null : (filters.level ?? level);

  let query = db.from('exercises').select('id, course_id, title, level, category, exercise_type').eq('is_published', true);
  if (effectiveLevel) query = query.eq('level', effectiveLevel);
  const { data, error } = await query.order('level').order('title');
  if (error) throw error;

  const [classIds, attempts] = await Promise.all([
    classIdsForStudent(studentId),
    db.from('exercise_attempts').select('exercise_id, score, max_score, created_at').eq('student_id', studentId).order('created_at', { ascending: false }),
  ]);
  if (attempts.error) throw attempts.error;

  // Exclut les exercices liés à un cours réservé à une autre classe.
  const courseIds = [...new Set((data as { course_id: string | null }[]).map((row) => row.course_id).filter((id): id is string => Boolean(id)))];
  let visibleCourses = new Set<string>();
  if (courseIds.length > 0) {
    const { data: courses, error: coursesError } = await db
      .from('courses')
      .select('id')
      .in('id', courseIds)
      .eq('is_published', true)
      .or(classScopeFilter(classIds));
    if (coursesError) throw coursesError;
    visibleCourses = new Set((courses as { id: string }[]).map((course) => course.id));
  }

  const bestScores = new Map<string, { score: number; maxScore: number }>();
  for (const attempt of attempts.data as { exercise_id: string; score: number; max_score: number }[]) {
    const best = bestScores.get(attempt.exercise_id);
    if (!best || attempt.score / attempt.max_score > best.score / best.maxScore) {
      bestScores.set(attempt.exercise_id, { score: attempt.score, maxScore: attempt.max_score });
    }
  }

  return {
    studentLevel: level,
    exercises: (data as { id: string; course_id: string | null; title: string; level: CefrLevel; category: string; exercise_type: ExerciseType }[])
      .filter((row) => !row.course_id || visibleCourses.has(row.course_id))
      .map((row) => ({
        id: row.id,
        courseId: row.course_id,
        title: row.title,
        level: row.level,
        category: row.category,
        exerciseType: row.exercise_type,
        bestScore: bestScores.get(row.id) ?? null,
      })),
  };
}

export async function getStudentExercise(studentId: string, exerciseId: string) {
  const { data, error } = await db.from('exercises').select(PUBLIC_COLUMNS).eq('id', exerciseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'exercise_not_found', 'Exercice introuvable.');
  await assertStudentCanAccess(studentId, data as ExerciseRow);
  return toPublicExercise(data as ExerciseRow);
}

export async function submitExerciseAttempt(studentId: string, exerciseId: string, answers: Record<string, string>) {
  const { data, error } = await db.from('exercises').select(ALL_COLUMNS).eq('id', exerciseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'exercise_not_found', 'Exercice introuvable.');
  const row = data as ExerciseRow;
  await assertStudentCanAccess(studentId, row);

  const result = gradeExercise(row.exercise_type, row.content, row.solution, answers);
  if (result.maxScore === 0) throw new HttpError(422, 'exercise_empty', 'Cet exercice ne contient aucun élément à corriger.');

  const { error: insertError } = await db.from('exercise_attempts').insert({
    exercise_id: row.id,
    student_id: studentId,
    answers,
    score: result.score,
    max_score: result.maxScore,
  });
  if (insertError) throw insertError;

  return result;
}

// ── Enseignant / admin ──────────────────────────────────────

function canEdit(auth: AuthContext, row: Pick<ExerciseRow, 'created_by'>): boolean {
  return auth.role === 'admin' || row.created_by === auth.userId;
}

export async function listManagedExercises(auth: AuthContext) {
  const { data, error } = await db.from('exercises').select(ALL_COLUMNS).order('updated_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as ExerciseRow[]).map((row) => ({
    ...toPublicExercise(row),
    isPublished: row.is_published,
    input: toExerciseInput(row.exercise_type, row.content, row.solution),
    canEdit: canEdit(auth, row),
  }));
}

async function assertCourseExists(courseId: string | null | undefined) {
  if (!courseId) return;
  const { data, error } = await db.from('courses').select('id').eq('id', courseId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(400, 'course_not_found', 'Cours de rattachement introuvable.');
}

function toRow(meta: ExerciseMeta, input: ExerciseInput) {
  const compiled = compileExercise(input);
  return {
    title: meta.title,
    level: meta.level,
    category: meta.category.trim().toLowerCase(),
    instructions: meta.instructions || null,
    course_id: meta.courseId ?? null,
    is_published: meta.isPublished,
    exercise_type: compiled.exerciseType,
    content: compiled.content,
    solution: compiled.solution,
  };
}

export async function createExercise(auth: AuthContext, meta: ExerciseMeta, input: ExerciseInput) {
  await assertCourseExists(meta.courseId);
  const { data, error } = await db
    .from('exercises')
    .insert({ ...toRow(meta, input), created_by: auth.userId })
    .select('id')
    .single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'exercise.create', entityType: 'exercise', entityId: data.id });
  return { id: data.id as string };
}

async function getEditableExercise(auth: AuthContext, id: string) {
  const { data, error } = await db.from('exercises').select('id, created_by').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'exercise_not_found', 'Exercice introuvable.');
  if (!canEdit(auth, data as ExerciseRow)) throw new HttpError(403, 'exercise_forbidden', 'Seul l’auteur ou un admin peut modifier cet exercice.');
}

export async function updateExercise(auth: AuthContext, id: string, meta: ExerciseMeta, input: ExerciseInput) {
  await getEditableExercise(auth, id);
  await assertCourseExists(meta.courseId);
  const { error } = await db.from('exercises').update(toRow(meta, input)).eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'exercise.update', entityType: 'exercise', entityId: id });
  return { id };
}

export async function deleteExercise(auth: AuthContext, id: string) {
  await getEditableExercise(auth, id);
  const { error } = await db.from('exercises').delete().eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'exercise.delete', entityType: 'exercise', entityId: id });
}
