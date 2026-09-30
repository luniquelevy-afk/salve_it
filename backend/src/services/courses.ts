import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, classIdsForStudent, classScopeFilter, studentLevel, type CefrLevel } from './access.js';
import { recordAudit } from './audit.js';

export type CourseContentType = 'text' | 'pdf' | 'video' | 'audio' | 'link';

interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  category: string;
  content_type: CourseContentType;
  body: string | null;
  content_url: string | null;
  class_id: string | null;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const COURSE_COLUMNS =
  'id, title, description, level, category, content_type, body, content_url, class_id, is_published, published_at, created_by, created_at, updated_at';

function toCourse(row: CourseRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    level: row.level,
    category: row.category,
    contentType: row.content_type,
    body: row.body,
    contentUrl: row.content_url,
    classId: row.class_id,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export interface CourseInput {
  title: string;
  description?: string | null | undefined;
  level: CefrLevel;
  category: string;
  contentType: CourseContentType;
  body?: string | null | undefined;
  contentUrl?: string | null | undefined;
  classId?: string | null | undefined;
  isPublished: boolean;
}

// ── Étudiant (EF-26) ────────────────────────────────────────

export async function listStudentCourses(studentId: string, filters: { level?: CefrLevel | 'all' | undefined; category?: string | undefined }) {
  const [level, classIds] = await Promise.all([studentLevel(studentId), classIdsForStudent(studentId)]);
  // Par défaut : cours du niveau de l'étudiant ; « all » affiche tous les niveaux.
  const effectiveLevel = filters.level === 'all' ? null : (filters.level ?? level);

  let query = db.from('courses').select(COURSE_COLUMNS).eq('is_published', true).or(classScopeFilter(classIds));
  if (effectiveLevel) query = query.eq('level', effectiveLevel);
  if (filters.category) query = query.eq('category', filters.category);
  const { data, error } = await query.order('level').order('title');
  if (error) throw error;

  return { studentLevel: level, courses: (data as CourseRow[]).map(toCourse) };
}

export async function getStudentCourse(studentId: string, courseId: string) {
  const classIds = await classIdsForStudent(studentId);
  const { data, error } = await db
    .from('courses')
    .select(COURSE_COLUMNS)
    .eq('id', courseId)
    .eq('is_published', true)
    .or(classScopeFilter(classIds))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'course_not_found', 'Cours introuvable.');

  const { data: exercises, error: exercisesError } = await db
    .from('exercises')
    .select('id, title, exercise_type')
    .eq('course_id', courseId)
    .eq('is_published', true)
    .order('title');
  if (exercisesError) throw exercisesError;

  return {
    course: toCourse(data as CourseRow),
    exercises: (exercises as { id: string; title: string; exercise_type: string }[]).map((exercise) => ({
      id: exercise.id,
      title: exercise.title,
      exerciseType: exercise.exercise_type,
    })),
  };
}

// ── Enseignant / admin (EF-24) ──────────────────────────────

function canEdit(auth: AuthContext, row: Pick<CourseRow, 'created_by'>): boolean {
  return auth.role === 'admin' || row.created_by === auth.userId;
}

export async function listManagedCourses(auth: AuthContext) {
  const { data, error } = await db.from('courses').select(COURSE_COLUMNS).order('updated_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data as CourseRow[]).map((row) => ({ ...toCourse(row), canEdit: canEdit(auth, row) }));
}

async function getEditableCourse(auth: AuthContext, id: string): Promise<CourseRow> {
  const { data, error } = await db.from('courses').select(COURSE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'course_not_found', 'Cours introuvable.');
  if (!canEdit(auth, data as CourseRow)) throw new HttpError(403, 'course_forbidden', 'Seul l’auteur ou un admin peut modifier ce cours.');
  return data as CourseRow;
}

function toRow(input: CourseInput, current?: CourseRow) {
  return {
    title: input.title,
    description: input.description || null,
    level: input.level,
    category: input.category.trim().toLowerCase(),
    content_type: input.contentType,
    body: input.contentType === 'text' ? (input.body ?? null) : null,
    content_url: input.contentType === 'text' ? null : (input.contentUrl ?? null),
    class_id: input.classId ?? null,
    is_published: input.isPublished,
    published_at: input.isPublished ? (current?.published_at ?? new Date().toISOString()) : null,
  };
}

export async function createCourse(auth: AuthContext, input: CourseInput) {
  if (input.classId) await assertCanManageClass(auth, input.classId);
  const { data, error } = await db
    .from('courses')
    .insert({ ...toRow(input), created_by: auth.userId })
    .select(COURSE_COLUMNS)
    .single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'course.create', entityType: 'course', entityId: data.id });
  return { ...toCourse(data as CourseRow), canEdit: true };
}

export async function updateCourse(auth: AuthContext, id: string, input: CourseInput) {
  const current = await getEditableCourse(auth, id);
  if (input.classId && input.classId !== current.class_id) await assertCanManageClass(auth, input.classId);
  const { data, error } = await db.from('courses').update(toRow(input, current)).eq('id', id).select(COURSE_COLUMNS).single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'course.update', entityType: 'course', entityId: id });
  return { ...toCourse(data as CourseRow), canEdit: true };
}

export async function deleteCourse(auth: AuthContext, id: string) {
  await getEditableCourse(auth, id);
  const { error } = await db.from('courses').delete().eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'course.delete', entityType: 'course', entityId: id });
}
