// §13 : export du rapport de classe (CSV) — présence, devoirs et résultats par étudiant.
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass } from './access.js';
import { getClassAttendance } from './attendance.js';
import { recordAudit } from './audit.js';
import { fileSlug, toCsv } from './student-export.js';

const DAY_MS = 86_400_000;

export const CLASS_REPORT_HEADER = [
  'Étudiant',
  'Niveau',
  'Compte',
  'Séances enregistrées',
  'Présences',
  'Retards',
  'Absences',
  'Absences excusées',
  'Taux de présence (%)',
  'Devoirs échus',
  'Devoirs rendus',
  'Devoirs validés',
  'Devoirs à reprendre',
  'Devoirs non rendus',
  'Simulations terminées (90 j)',
  'Réussite moyenne en simulation (%)',
  'Entretiens terminés',
  'Score moyen d’entretien',
];

const average = (values: number[]) => (values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

export async function exportClassReport(auth: AuthContext, classId: string, now = new Date()) {
  await assertCanManageClass(auth, classId);
  const [klass, attendance, assignments] = await Promise.all([
    supabaseAdmin.from('classes').select('name').eq('id', classId).single(),
    getClassAttendance(auth, classId, now),
    supabaseAdmin.from('homework_assignments').select('id').eq('class_id', classId).lte('due_at', now.toISOString()),
  ]);
  if (klass.error) throw klass.error;
  if (assignments.error) throw assignments.error;

  const studentIds = attendance.students.map((student) => student.id);
  const dueIds = (assignments.data as { id: string }[]).map((row) => row.id);
  const since = new Date(now.getTime() - 90 * DAY_MS).toISOString();

  const [submissions, simulations, embassy] = await Promise.all([
    dueIds.length > 0 && studentIds.length > 0
      ? supabaseAdmin.from('homework_submissions').select('student_id, status').in('assignment_id', dueIds).in('student_id', studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length > 0
      ? supabaseAdmin
          .from('simulations')
          .select('student_id, total_questions, score_by_section')
          .in('student_id', studentIds)
          .eq('status', 'completed')
          .neq('mode', 'revision')
          .gte('completed_at', since)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length > 0 ? supabaseAdmin.from('embassy_sessions').select('student_id, overall_score').in('student_id', studentIds).eq('status', 'completed') : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [submissions, simulations, embassy]) if (result.error) throw result.error;

  const rows = attendance.students.map((student) => {
    const mySubmissions = (submissions.data as { student_id: string; status: string }[]).filter((row) => row.student_id === student.id);
    const mySimulations = (simulations.data as { student_id: string; total_questions: number; score_by_section: Record<string, { correct: number }> | null }[]).filter(
      (row) => row.student_id === student.id && row.score_by_section && row.total_questions > 0,
    );
    const myEmbassy = (embassy.data as { student_id: string; overall_score: number | null }[]).filter((row) => row.student_id === student.id && row.overall_score !== null);
    return [
      student.fullName,
      student.level,
      student.status === 'active' ? 'Actif' : 'Suspendu',
      student.recorded,
      student.present,
      student.late,
      student.absent,
      student.excused,
      student.ratePercent,
      dueIds.length,
      mySubmissions.length,
      mySubmissions.filter((row) => row.status === 'valide').length,
      mySubmissions.filter((row) => row.status === 'a_reprendre').length,
      dueIds.length - mySubmissions.length,
      mySimulations.length,
      average(mySimulations.map((row) => (100 * Object.values(row.score_by_section!).reduce((sum, section) => sum + section.correct, 0)) / row.total_questions)),
      myEmbassy.length,
      average(myEmbassy.map((row) => row.overall_score!)),
    ];
  });

  const className = (klass.data as { name: string }).name;
  await recordAudit({ actorId: auth.userId, action: 'class.export_report', entityType: 'class', entityId: classId });
  return {
    fileName: `rapport-classe-${fileSlug(className)}-${now.toISOString().slice(0, 10)}.csv`,
    body: toCsv(CLASS_REPORT_HEADER, rows),
  };
}
