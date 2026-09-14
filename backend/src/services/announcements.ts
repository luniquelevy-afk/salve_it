import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { AuthContext } from '../middleware/auth.js';
import { assertCanManageClass, visibleClassIds } from './access.js';
import { recordAudit } from './audit.js';
import { notifySafely } from './notifications.js';

export type AnnouncementTarget = 'all' | 'students' | 'teachers' | 'class';

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  target: AnnouncementTarget;
  target_class_id: string | null;
  published_by: string | null;
  published_at: string;
  profiles: { full_name: string } | null;
  classes: { name: string } | null;
}

// Même règle de visibilité que la policy RLS « announcements: lecture selon la cible ».
export function isVisibleTo(auth: AuthContext, classIds: string[] | 'all', row: Pick<AnnouncementRow, 'target' | 'target_class_id' | 'published_by'>): boolean {
  if (auth.role === 'admin' || row.published_by === auth.userId || row.target === 'all') return true;
  if (row.target === 'students') return auth.role === 'student';
  if (row.target === 'teachers') return auth.role === 'teacher';
  return row.target_class_id !== null && classIds !== 'all' && classIds.includes(row.target_class_id);
}

export async function listAnnouncements(auth: AuthContext) {
  const [classIds, result] = await Promise.all([
    visibleClassIds(auth),
    supabaseAdmin
      .from('announcements')
      .select('id, title, body, target, target_class_id, published_by, published_at, profiles(full_name), classes(name)')
      .order('published_at', { ascending: false })
      .limit(200),
  ]);
  if (result.error) throw result.error;

  return (result.data as unknown as AnnouncementRow[])
    .filter((row) => isVisibleTo(auth, classIds, row))
    .slice(0, 50)
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      target: row.target,
      classId: row.target_class_id,
      className: row.classes?.name ?? null,
      authorName: row.profiles?.full_name ?? null,
      publishedAt: row.published_at,
      canDelete: auth.role === 'admin' || row.published_by === auth.userId,
    }));
}

// EF-29 : l'admin publie à tous ; un enseignant uniquement à ses classes.
export async function createAnnouncement(auth: AuthContext, input: { title: string; body: string; target: AnnouncementTarget; classId?: string | null | undefined }) {
  if (input.target === 'class') {
    if (!input.classId) throw new HttpError(400, 'class_required', 'Choisissez la classe destinataire.');
    await assertCanManageClass(auth, input.classId);
  } else if (auth.role !== 'admin') {
    throw new HttpError(403, 'announcement_forbidden', 'Un enseignant publie uniquement pour ses classes.');
  }

  const { data, error } = await supabaseAdmin
    .from('announcements')
    .insert({
      title: input.title,
      body: input.body,
      target: input.target,
      target_class_id: input.target === 'class' ? input.classId : null,
      published_by: auth.userId,
    })
    .select('id')
    .single();
  if (error) throw error;
  await recordAudit({ actorId: auth.userId, action: 'announcement.create', entityType: 'announcement', entityId: data.id, metadata: { target: input.target } });
  await notifySafely((await announcementRecipients(input.target, input.classId ?? null)).filter((userId) => userId !== auth.userId), {
    type: 'announcement',
    title: `Nouvelle annonce : ${input.title}`,
    link: '/annonces',
    dedupeKey: `announcement:${data.id}`,
    email: true,
  });
  return { id: data.id as string };
}

async function announcementRecipients(target: AnnouncementTarget, classId: string | null): Promise<string[]> {
  if (target === 'class' && classId) {
    const [members, klass] = await Promise.all([
      supabaseAdmin.from('class_students').select('student_id').eq('class_id', classId),
      supabaseAdmin.from('classes').select('teacher_id').eq('id', classId).single(),
    ]);
    if (members.error) throw members.error;
    if (klass.error) throw klass.error;
    return [...(members.data as { student_id: string }[]).map((row) => row.student_id), ...(klass.data.teacher_id ? [klass.data.teacher_id as string] : [])];
  }
  let query = supabaseAdmin.from('profiles').select('id').eq('status', 'active');
  if (target === 'students') query = query.eq('role', 'student');
  if (target === 'teachers') query = query.eq('role', 'teacher');
  const { data, error } = await query;
  if (error) throw error;
  return (data as { id: string }[]).map((row) => row.id);
}

export async function deleteAnnouncement(auth: AuthContext, id: string) {
  const { data, error } = await supabaseAdmin.from('announcements').select('published_by').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'announcement_not_found', 'Annonce introuvable.');
  if (auth.role !== 'admin' && data.published_by !== auth.userId) {
    throw new HttpError(403, 'announcement_forbidden', 'Seul l’auteur ou un admin peut supprimer cette annonce.');
  }
  const { error: deleteError } = await supabaseAdmin.from('announcements').delete().eq('id', id);
  if (deleteError) throw deleteError;
  await recordAudit({ actorId: auth.userId, action: 'announcement.delete', entityType: 'announcement', entityId: id });
}
