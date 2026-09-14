import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanFollowStudent } from './access.js';
import { recordAudit } from './audit.js';
import { listEmbassySessions } from './embassy.js';
import { getReadiness, getStudentProfile } from './student-profile.js';
import { listSimulations } from './test-engine.js';

export { assertCanFollowStudent };

export async function getTeacherOverview(auth: AuthContext) {
  const { data, error } = await supabaseAdmin.rpc('teacher_overview', { p_teacher_id: auth.role === 'admin' ? null : auth.userId });
  if (error) throw error;
  return data as Record<string, unknown>;
}

const FEEDBACK_COLUMNS = 'id, student_id, target_type, target_id, teacher_id, comment, follow_up_at, status, created_at, updated_at, profiles!teacher_feedback_teacher_id_fkey(full_name)';

function toFeedback(row: Record<string, unknown>, auth: AuthContext) {
  return {
    id: row.id as string,
    studentId: row.student_id as string,
    targetType: row.target_type as 'simulation' | 'embassy_session',
    targetId: row.target_id as string,
    teacherName: (row.profiles as { full_name: string } | null)?.full_name ?? null,
    comment: row.comment as string,
    followUpAt: row.follow_up_at as string | null,
    status: row.status as 'a_revoir' | 'traite',
    createdAt: row.created_at as string,
    canEdit: auth.role === 'admin' || row.teacher_id === auth.userId,
  };
}

export async function getStudentFollowUp(auth: AuthContext, studentId: string) {
  await assertCanFollowStudent(auth, studentId);
  const [account, profile, readiness, path, simulations, embassy, feedback] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name, level, status').eq('id', studentId).single(),
    getStudentProfile(studentId),
    getReadiness(studentId),
    supabaseAdmin.from('learning_paths').select('objective, weekly_goals, recommended_actions, progress_percent, generated_at').eq('student_id', studentId).maybeSingle(),
    listSimulations(studentId),
    listEmbassySessions(studentId),
    supabaseAdmin.from('teacher_feedback').select(FEEDBACK_COLUMNS).eq('student_id', studentId).order('created_at', { ascending: false }),
  ]);
  if (account.error) throw account.error;
  if (path.error) throw path.error;
  if (feedback.error) throw feedback.error;

  return {
    student: { id: account.data.id as string, fullName: account.data.full_name as string, level: account.data.level as string | null, status: account.data.status as string },
    profile,
    readiness,
    learningPath: path.data
      ? {
          objective: path.data.objective,
          weeklyGoals: path.data.weekly_goals,
          actions: path.data.recommended_actions,
          progressPercent: path.data.progress_percent,
          generatedAt: path.data.generated_at,
        }
      : null,
    simulations,
    embassySessions: embassy,
    feedback: (feedback.data as unknown as Record<string, unknown>[]).map((row) => toFeedback(row, auth)),
  };
}

async function assertTargetBelongsToStudent(targetType: 'simulation' | 'embassy_session', targetId: string, studentId: string) {
  const table = targetType === 'simulation' ? 'simulations' : 'embassy_sessions';
  const { data, error } = await supabaseAdmin.from(table).select('id').eq('id', targetId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'target_not_found', 'Simulation ou entretien introuvable pour cet étudiant.');
}

export interface FeedbackInput {
  studentId: string;
  targetType: 'simulation' | 'embassy_session';
  targetId: string;
  comment: string;
  followUpAt?: string | null | undefined;
}

// EF-53 : commentaire privé, séparé du rapport IA, jamais montré à l'étudiant.
export async function createFeedback(auth: AuthContext, input: FeedbackInput) {
  await assertCanFollowStudent(auth, input.studentId);
  await assertTargetBelongsToStudent(input.targetType, input.targetId, input.studentId);
  const { data, error } = await supabaseAdmin
    .from('teacher_feedback')
    .insert({
      student_id: input.studentId,
      target_type: input.targetType,
      target_id: input.targetId,
      teacher_id: auth.userId,
      comment: input.comment,
      follow_up_at: input.followUpAt ?? null,
    })
    .select(FEEDBACK_COLUMNS)
    .single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'teacher_feedback.create', entityType: 'teacher_feedback', entityId: data.id, metadata: { targetType: input.targetType } });
  return toFeedback(data as unknown as Record<string, unknown>, auth);
}

export async function updateFeedback(
  auth: AuthContext,
  id: string,
  patch: { comment?: string | undefined; status?: 'a_revoir' | 'traite' | undefined; followUpAt?: string | null | undefined },
) {
  const { data: current, error } = await supabaseAdmin.from('teacher_feedback').select('teacher_id, student_id').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!current) throw new HttpError(404, 'feedback_not_found', 'Commentaire introuvable.');
  await assertCanFollowStudent(auth, current.student_id as string);
  if (auth.role !== 'admin' && current.teacher_id !== auth.userId) {
    throw new HttpError(403, 'feedback_forbidden', 'Seul l’auteur ou un admin peut modifier ce commentaire.');
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('teacher_feedback')
    .update({
      ...(patch.comment !== undefined && { comment: patch.comment }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.followUpAt !== undefined && { follow_up_at: patch.followUpAt }),
    })
    .eq('id', id)
    .select(FEEDBACK_COLUMNS)
    .single();
  if (updateError) throw updateError;
  await recordAudit({ actorId: auth.userId, action: 'teacher_feedback.update', entityType: 'teacher_feedback', entityId: id });
  return toFeedback(data as unknown as Record<string, unknown>, auth);
}

export async function getAdminOverview() {
  const { data, error } = await supabaseAdmin.rpc('admin_overview');
  if (error) throw error;
  return data as Record<string, unknown>;
}
