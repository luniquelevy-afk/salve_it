// §13 : présence aux séances — saisie par l'enseignant titulaire de la classe ou l'admin.
import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, type CefrLevel } from './access.js';
import { recordAudit } from './audit.js';

export const ATTENDANCE_STATUSES = ['present', 'retard', 'absent', 'excuse'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const DAY_MS = 86_400_000;

// Taux de présence : présents et retards sur les séances non excusées (une absence excusée ne pénalise pas).
export function summarizeAttendance(statuses: AttendanceStatus[]) {
  const count = (status: AttendanceStatus) => statuses.filter((value) => value === status).length;
  const present = count('present');
  const late = count('retard');
  const absent = count('absent');
  const excused = count('excuse');
  const counted = statuses.length - excused;
  return { recorded: statuses.length, present, late, absent, excused, ratePercent: counted > 0 ? Math.round((100 * (present + late)) / counted) : null };
}

export interface RosterStudent {
  id: string;
  fullName: string;
  level: CefrLevel | null;
  status: string;
}

export async function classRoster(classId: string): Promise<RosterStudent[]> {
  const { data, error } = await supabaseAdmin.from('class_students').select('student_id, profiles(id, full_name, level, status)').eq('class_id', classId);
  if (error) throw error;
  return (data as unknown as { profiles: { id: string; full_name: string; level: CefrLevel | null; status: string } | null }[])
    .map((row) => row.profiles)
    .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
    .map((profile) => ({ id: profile.id, fullName: profile.full_name, level: profile.level, status: profile.status }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));
}

interface SessionRow {
  id: string;
  class_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  classes: { name: string } | null;
}

async function loadSession(sessionId: string): Promise<SessionRow> {
  const { data, error } = await supabaseAdmin.from('class_sessions').select('id, class_id, title, starts_at, ends_at, classes(name)').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'class_session_not_found', 'Séance introuvable.');
  return data as unknown as SessionRow;
}

export async function getSessionAttendance(auth: AuthContext, sessionId: string) {
  const session = await loadSession(sessionId);
  await assertCanManageClass(auth, session.class_id);
  const [roster, records] = await Promise.all([
    classRoster(session.class_id),
    supabaseAdmin.from('class_attendance').select('student_id, status, note, recorded_at').eq('session_id', sessionId),
  ]);
  if (records.error) throw records.error;
  const byStudent = new Map((records.data as { student_id: string; status: AttendanceStatus; note: string | null; recorded_at: string }[]).map((row) => [row.student_id, row]));

  return {
    session: { id: session.id, classId: session.class_id, className: session.classes?.name ?? null, title: session.title, startsAt: session.starts_at, endsAt: session.ends_at },
    students: roster.map((student) => {
      const record = byStudent.get(student.id);
      return { ...student, attendance: record?.status ?? null, note: record?.note ?? null, recordedAt: record?.recorded_at ?? null };
    }),
  };
}

export async function saveSessionAttendance(auth: AuthContext, sessionId: string, entries: { studentId: string; status: AttendanceStatus; note?: string | null | undefined }[]) {
  const session = await loadSession(sessionId);
  await assertCanManageClass(auth, session.class_id);

  const members = new Set((await classRoster(session.class_id)).map((student) => student.id));
  if (entries.some((entry) => !members.has(entry.studentId))) {
    throw new HttpError(400, 'student_not_in_class', 'Un des étudiants ne fait pas partie de cette classe.');
  }
  // Seule une absence excusée peut être anticipée ; le reste se constate à partir du jour de la séance.
  if (Date.parse(session.starts_at) > Date.now() + DAY_MS && entries.some((entry) => entry.status !== 'excuse')) {
    throw new HttpError(400, 'session_not_started', 'Pour une séance à venir, seules les absences excusées peuvent être saisies.');
  }

  if (entries.length > 0) {
    const recordedAt = new Date().toISOString();
    const { error } = await supabaseAdmin.from('class_attendance').upsert(
      entries.map((entry) => ({
        session_id: sessionId,
        student_id: entry.studentId,
        status: entry.status,
        note: entry.note?.trim() || null,
        recorded_by: auth.userId,
        recorded_at: recordedAt,
      })),
      { onConflict: 'session_id,student_id' },
    );
    if (error) throw error;
    await recordAudit({ actorId: auth.userId, action: 'attendance.record', entityType: 'class_session', entityId: sessionId, metadata: { entries: entries.length } });
  }
  return getSessionAttendance(auth, sessionId);
}

// Taux par étudiant sur les séances passées de la classe.
export async function getClassAttendance(auth: AuthContext, classId: string, now = new Date()) {
  await assertCanManageClass(auth, classId);
  const [roster, sessions] = await Promise.all([
    classRoster(classId),
    supabaseAdmin.from('class_sessions').select('id').eq('class_id', classId).lte('starts_at', now.toISOString()).order('starts_at', { ascending: false }).limit(200),
  ]);
  if (sessions.error) throw sessions.error;
  const sessionIds = (sessions.data as { id: string }[]).map((row) => row.id);

  const statusesByStudent = new Map<string, AttendanceStatus[]>();
  if (sessionIds.length > 0) {
    const { data, error } = await supabaseAdmin.from('class_attendance').select('student_id, status').in('session_id', sessionIds);
    if (error) throw error;
    for (const row of data as { student_id: string; status: AttendanceStatus }[]) {
      statusesByStudent.set(row.student_id, [...(statusesByStudent.get(row.student_id) ?? []), row.status]);
    }
  }

  return {
    pastSessions: sessionIds.length,
    students: roster.map((student) => ({ ...student, ...summarizeAttendance(statusesByStudent.get(student.id) ?? []) })),
  };
}

export async function getMyAttendance(studentId: string, now = new Date()) {
  const since = new Date(now.getTime() - 90 * DAY_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('class_attendance')
    .select('status, note, class_sessions!inner(title, starts_at, classes(name))')
    .eq('student_id', studentId)
    .gte('class_sessions.starts_at', since);
  if (error) throw error;
  const records = (data as unknown as { status: AttendanceStatus; note: string | null; class_sessions: { title: string; starts_at: string; classes: { name: string } | null } }[])
    .map((row) => ({ title: row.class_sessions.title, startsAt: row.class_sessions.starts_at, className: row.class_sessions.classes?.name ?? null, attendance: row.status, note: row.note }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  return { summary: summarizeAttendance(records.map((record) => record.attendance)), records: records.slice(0, 30) };
}
