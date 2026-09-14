import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];

export async function classIdsForStudent(studentId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('class_students')
    .select('class_id, classes!inner(is_active)')
    .eq('student_id', studentId)
    .eq('classes.is_active', true);
  if (error) throw error;
  return (data as { class_id: string }[]).map((row) => row.class_id);
}

export async function classIdsForTeacher(teacherId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('classes').select('id').eq('teacher_id', teacherId).eq('is_active', true);
  if (error) throw error;
  return (data as { id: string }[]).map((row) => row.id);
}

// Classes visibles selon le rôle (même périmètre que la RLS : §3.1, §13).
export async function visibleClassIds(auth: AuthContext): Promise<string[] | 'all'> {
  if (auth.role === 'admin') return 'all';
  return auth.role === 'teacher' ? classIdsForTeacher(auth.userId) : classIdsForStudent(auth.userId);
}

// Un enseignant ne cible que ses propres classes ; l'admin, toute classe existante.
export async function assertCanManageClass(auth: AuthContext, classId: string): Promise<void> {
  if (auth.role === 'admin') {
    const { data, error } = await supabaseAdmin.from('classes').select('id').eq('id', classId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'class_not_found', 'Classe introuvable.');
    return;
  }
  if (auth.role !== 'teacher' || !(await classIdsForTeacher(auth.userId)).includes(classId)) {
    throw new HttpError(403, 'class_forbidden', 'Vous ne pouvez agir que sur vos propres classes.');
  }
}

export async function studentLevel(studentId: string): Promise<CefrLevel | null> {
  const { data, error } = await supabaseAdmin.from('profiles').select('level').eq('id', studentId).single();
  if (error) throw error;
  return (data.level as CefrLevel | null) ?? null;
}

// §3.1 : un enseignant ne consulte que les étudiants de ses classes actives ; l'admin, tous.
export async function assertCanFollowStudent(auth: AuthContext, studentId: string): Promise<void> {
  const { data: student, error } = await supabaseAdmin.from('profiles').select('role').eq('id', studentId).maybeSingle();
  if (error) throw error;
  if (student?.role !== 'student') throw new HttpError(404, 'student_not_found', 'Étudiant introuvable.');
  if (auth.role === 'admin') return;

  const { data: link, error: linkError } = await supabaseAdmin
    .from('class_students')
    .select('class_id, classes!inner(teacher_id, is_active)')
    .eq('student_id', studentId)
    .eq('classes.teacher_id', auth.userId)
    .eq('classes.is_active', true)
    .limit(1);
  if (linkError) throw linkError;
  if (!link || link.length === 0) throw new HttpError(403, 'student_forbidden', 'Cet étudiant ne fait pas partie de vos classes.');
}

// Filtre PostgREST « visible par tous ou par l'une de ces classes ». Les ids viennent de la base.
export function classScopeFilter(classIds: string[]): string {
  return classIds.length > 0 ? `class_id.is.null,class_id.in.(${classIds.join(',')})` : 'class_id.is.null';
}
