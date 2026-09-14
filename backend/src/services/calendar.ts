import { formatBrazzavilleDateTime } from '../lib/dates.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, visibleClassIds } from './access.js';
import { recordAudit } from './audit.js';
import { notifySafely } from './notifications.js';

interface SessionRow {
  id: string;
  class_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  classes: { name: string } | null;
}

const DAY_MS = 24 * 3_600_000;

// EF-28 : calendrier des cours des classes de l'utilisateur.
export async function listClassSessions(auth: AuthContext, range: { from?: string | undefined; to?: string | undefined }) {
  const scope = await visibleClassIds(auth);
  if (scope !== 'all' && scope.length === 0) return [];

  const from = range.from ?? new Date(Date.now() - DAY_MS).toISOString();
  const to = range.to ?? new Date(Date.now() + 60 * DAY_MS).toISOString();

  let query = supabaseAdmin
    .from('class_sessions')
    .select('id, class_id, title, starts_at, ends_at, location, notes, classes(name)')
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at')
    .limit(500);
  if (scope !== 'all') query = query.in('class_id', scope);
  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as SessionRow[]).map((row) => ({
    id: row.id,
    classId: row.class_id,
    className: row.classes?.name ?? null,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    notes: row.notes,
    canManage: auth.role !== 'student',
  }));
}

export interface ClassSessionInput {
  classId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null | undefined;
  notes?: string | null | undefined;
}

function assertDuration(input: Pick<ClassSessionInput, 'startsAt' | 'endsAt'>) {
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
    throw new HttpError(400, 'invalid_duration', 'La fin doit être postérieure au début.');
  }
}

// Étudiants actifs d'une classe : destinataires des notifications de séance.
export async function activeClassStudentIds(classId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('class_students').select('student_id, profiles!inner(status)').eq('class_id', classId).eq('profiles.status', 'active');
  if (error) throw error;
  return (data as unknown as { student_id: string }[]).map((row) => row.student_id);
}

// §15 « session programmée » : séance future créée ou déplacée ; une seule notification par horaire.
async function notifyClassSession(classId: string, session: { id: string; title: string; startsAt: string; location: string | null }, change: 'created' | 'rescheduled') {
  const startsAt = new Date(session.startsAt).toISOString();
  if (Date.parse(startsAt) <= Date.now()) return;
  try {
    await notifySafely(await activeClassStudentIds(classId), {
      type: 'class_session_scheduled',
      title: change === 'created' ? `Nouvelle séance : ${session.title}` : `Séance déplacée : ${session.title}`,
      body: `${formatBrazzavilleDateTime(startsAt)}${session.location ? ` — ${session.location}` : ''}.`,
      link: '/calendrier',
      dedupeKey: `class_session:${session.id}:${startsAt}`,
      email: true,
    });
  } catch (err) {
    logger.error({ err, sessionId: session.id }, 'class_session_notification_failed');
  }
}

export async function createClassSession(auth: AuthContext, input: ClassSessionInput) {
  assertDuration(input);
  await assertCanManageClass(auth, input.classId);
  const { data, error } = await supabaseAdmin
    .from('class_sessions')
    .insert({
      class_id: input.classId,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location ?? null,
      notes: input.notes ?? null,
      created_by: auth.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'class_session.create', entityType: 'class_session', entityId: data.id });
  await notifyClassSession(input.classId, { id: data.id as string, title: input.title, startsAt: input.startsAt, location: input.location ?? null }, 'created');
  return { id: data.id as string };
}

async function loadManageableSession(auth: AuthContext, id: string) {
  const { data, error } = await supabaseAdmin.from('class_sessions').select('id, class_id, starts_at').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'class_session_not_found', 'Séance introuvable.');
  await assertCanManageClass(auth, data.class_id as string);
  return data as { id: string; class_id: string; starts_at: string };
}

export async function updateClassSession(auth: AuthContext, id: string, input: ClassSessionInput) {
  assertDuration(input);
  const current = await loadManageableSession(auth, id);
  if (input.classId !== current.class_id) await assertCanManageClass(auth, input.classId);
  const { error } = await supabaseAdmin
    .from('class_sessions')
    .update({ class_id: input.classId, title: input.title, starts_at: input.startsAt, ends_at: input.endsAt, location: input.location ?? null, notes: input.notes ?? null })
    .eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'class_session.update', entityType: 'class_session', entityId: id });

  const session = { id, title: input.title, startsAt: input.startsAt, location: input.location ?? null };
  if (input.classId !== current.class_id) await notifyClassSession(input.classId, session, 'created');
  else if (Date.parse(input.startsAt) !== Date.parse(current.starts_at)) await notifyClassSession(input.classId, session, 'rescheduled');
}

export async function deleteClassSession(auth: AuthContext, id: string) {
  await loadManageableSession(auth, id);
  const { error } = await supabaseAdmin.from('class_sessions').delete().eq('id', id);
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'class_session.delete', entityType: 'class_session', entityId: id });
}
