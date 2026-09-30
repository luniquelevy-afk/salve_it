import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, visibleClassIds, type CefrLevel } from './access.js';
import { recordAudit } from './audit.js';

interface ClassRow {
  id: string;
  name: string;
  is_active: boolean;
  program_id: string | null;
  teacher_id: string | null;
  programs: { name: string; level: CefrLevel | null } | null;
  profiles: { full_name: string } | null;
  class_students: { count: number }[];
}

// classes → profiles est ambigu (enseignant via teacher_id, étudiants via class_students) : clé étrangère explicite.
const CLASS_COLUMNS =
  'id, name, is_active, program_id, teacher_id, programs(name, level), profiles!classes_teacher_id_fkey(full_name), class_students(count)';

function toClass(row: ClassRow) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    programId: row.program_id,
    programName: row.programs?.name ?? null,
    teacherId: row.teacher_id,
    teacherName: row.profiles?.full_name ?? null,
    studentCount: row.class_students[0]?.count ?? 0,
  };
}

export async function listClasses(auth: AuthContext) {
  const scope = await visibleClassIds(auth);
  if (scope !== 'all' && scope.length === 0) return [];
  let query = db.from('classes').select(CLASS_COLUMNS).order('name');
  if (scope !== 'all') query = query.in('id', scope);
  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as ClassRow[]).map(toClass);
}

// Détail d'une classe et de ses étudiants : enseignant titulaire ou admin (§3.1).
export async function getClassDetail(auth: AuthContext, classId: string) {
  await assertCanManageClass(auth, classId);
  const [classResult, studentsResult] = await Promise.all([
    db.from('classes').select(CLASS_COLUMNS).eq('id', classId).single(),
    db.from('class_students').select('student_id, profiles(id, full_name, level, status)').eq('class_id', classId),
  ]);
  if (classResult.error) throw classResult.error;
  if (studentsResult.error) throw studentsResult.error;

  const students = (studentsResult.data as unknown as { profiles: { id: string; full_name: string; level: CefrLevel | null; status: string } | null }[])
    .map((row) => row.profiles)
    .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
    .map((profile) => ({ id: profile.id, fullName: profile.full_name, level: profile.level, status: profile.status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));

  return { class: toClass(classResult.data as unknown as ClassRow), students };
}

async function assertRole(profileId: string, role: 'teacher' | 'student') {
  const { data, error } = await db.from('profiles').select('role').eq('id', profileId).maybeSingle();
  if (error) throw error;
  if (data?.role !== role) {
    throw new HttpError(400, `${role}_not_found`, role === 'teacher' ? 'Enseignant introuvable.' : 'Étudiant introuvable.');
  }
}

export interface ClassInput {
  name: string;
  programId?: string | null | undefined;
  teacherId?: string | null | undefined;
  isActive?: boolean | undefined;
}

export async function createClass(actorId: string, input: ClassInput) {
  if (input.teacherId) await assertRole(input.teacherId, 'teacher');
  const { data, error } = await db
    .from('classes')
    .insert({ name: input.name, program_id: input.programId ?? null, teacher_id: input.teacherId ?? null, is_active: input.isActive ?? true })
    .select('id')
    .single();
  if (error) throw error;
  await recordAudit({ actorId, action: 'class.create', entityType: 'class', entityId: data.id });
  return { id: data.id as string };
}

export async function updateClass(actorId: string, classId: string, input: Partial<ClassInput>) {
  if (input.teacherId) await assertRole(input.teacherId, 'teacher');
  const { data, error } = await db
    .from('classes')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.programId !== undefined && { program_id: input.programId }),
      ...(input.teacherId !== undefined && { teacher_id: input.teacherId }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
    })
    .eq('id', classId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'class_not_found', 'Classe introuvable.');
  await recordAudit({ actorId, action: 'class.update', entityType: 'class', entityId: classId, metadata: { fields: Object.keys(input) } });
}

export async function addStudentToClass(actorId: string, classId: string, studentId: string) {
  await assertRole(studentId, 'student');
  const { data: klass, error: classError } = await db.from('classes').select('id, program_id').eq('id', classId).maybeSingle();
  if (classError) throw classError;
  if (!klass) throw new HttpError(404, 'class_not_found', 'Classe introuvable.');

  const { error } = await db
    .from('class_students')
    .upsert({ class_id: classId, student_id: studentId }, { onConflict: 'class_id,student_id', ignoreDuplicates: true });
  if (error) throw error;

  // Affectation à une classe = inscription active au programme de la classe (EF-36).
  if (klass.program_id) {
    const { error: enrollError } = await db
      .from('enrollments')
      .upsert({ student_id: studentId, program_id: klass.program_id, status: 'active' }, { onConflict: 'student_id,program_id', ignoreDuplicates: true });
    if (enrollError) throw enrollError;
  }
  await recordAudit({ actorId, action: 'class.add_student', entityType: 'class', entityId: classId, metadata: { studentId } });
}

export async function removeStudentFromClass(actorId: string, classId: string, studentId: string) {
  const { error } = await db.from('class_students').delete().eq('class_id', classId).eq('student_id', studentId);
  if (error) throw error;
  await recordAudit({ actorId, action: 'class.remove_student', entityType: 'class', entityId: classId, metadata: { studentId } });
}

// ── Programmes et inscriptions (EF-36) ──────────────────────

export async function listPrograms() {
  const { data, error } = await db.from('programs').select('id, name, level, description, is_active, enrollments(count)').order('name');
  if (error) throw error;
  return (data as unknown as { id: string; name: string; level: CefrLevel | null; description: string | null; is_active: boolean; enrollments: { count: number }[] }[]).map(
    (row) => ({
      id: row.id,
      name: row.name,
      level: row.level,
      description: row.description,
      isActive: row.is_active,
      enrollmentCount: row.enrollments[0]?.count ?? 0,
    }),
  );
}

export interface ProgramInput {
  name: string;
  level?: CefrLevel | null | undefined;
  description?: string | null | undefined;
  isActive?: boolean | undefined;
}

export async function createProgram(actorId: string, input: ProgramInput) {
  const { data, error } = await db
    .from('programs')
    .insert({ name: input.name, level: input.level ?? null, description: input.description ?? null, is_active: input.isActive ?? true })
    .select('id')
    .single();
  if (error) throw error;
  await recordAudit({ actorId, action: 'program.create', entityType: 'program', entityId: data.id });
  return { id: data.id as string };
}

export async function updateProgram(actorId: string, programId: string, input: Partial<ProgramInput>) {
  const { data, error } = await db
    .from('programs')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.level !== undefined && { level: input.level }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
    })
    .eq('id', programId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'program_not_found', 'Programme introuvable.');
  await recordAudit({ actorId, action: 'program.update', entityType: 'program', entityId: programId });
}

export async function listEnrollments(programId: string) {
  const { data, error } = await db
    .from('enrollments')
    .select('id, status, enrolled_at, profiles(id, full_name, level)')
    .eq('program_id', programId)
    .order('enrolled_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as { id: string; status: string; enrolled_at: string; profiles: { id: string; full_name: string; level: CefrLevel | null } | null }[]).map((row) => ({
    id: row.id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    studentId: row.profiles?.id ?? null,
    studentName: row.profiles?.full_name ?? null,
    studentLevel: row.profiles?.level ?? null,
  }));
}

export async function setEnrollment(actorId: string, input: { studentId: string; programId: string; status: 'active' | 'completed' | 'suspended' }) {
  await assertRole(input.studentId, 'student');
  const { data, error } = await db
    .from('enrollments')
    .upsert({ student_id: input.studentId, program_id: input.programId, status: input.status }, { onConflict: 'student_id,program_id' })
    .select('id')
    .single();
  if (error?.code === '23503') throw new HttpError(404, 'program_not_found', 'Programme introuvable.');
  if (error) throw error;
  await recordAudit({ actorId, action: 'enrollment.set', entityType: 'enrollment', entityId: data.id, metadata: { status: input.status } });
  return { id: data.id as string };
}
