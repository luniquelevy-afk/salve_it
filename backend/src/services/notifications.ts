// Notifications in-app et file d'emails (§15). Les emails ne contiennent jamais le contenu d'un document
// ni de données sensibles : un titre générique et un lien vers la plateforme.
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { formatBrazzavilleDateTime } from '../lib/dates.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';

export type NotificationType =
  | 'document_submitted'
  | 'document_validated'
  | 'document_needs_correction'
  | 'document_expiring'
  | 'embassy_report_ready'
  | 'announcement'
  | 'lead_follow_up'
  | 'class_session_scheduled'
  | 'class_session_reminder'
  | 'simulation_recommended'
  | 'homework_assigned'
  | 'homework_due_soon'
  | 'homework_reviewed';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body?: string | undefined;
  link?: string | undefined;
  dedupeKey?: string | undefined;
  email?: boolean | undefined;
}

const MAX_EMAIL_ATTEMPTS = 5;

export async function notify(userIds: string[], payload: NotificationPayload): Promise<number> {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return 0;

  const rows = recipients.map((userId) => ({
    user_id: userId,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    link: payload.link ?? null,
    dedupe_key: payload.dedupeKey ?? null,
  }));
  // Doublons ignorés : seules les notifications réellement créées sont renvoyées (et envoyées par email).
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    .select('id, user_id');
  if (error) throw error;
  const created = data as { id: string; user_id: string }[];

  if (payload.email && created.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .in('id', created.map((row) => row.user_id))
      .eq('status', 'active')
      .eq('email_notifications', true);
    if (profileError) throw profileError;
    const emails = new Map((profiles as { id: string; email: string }[]).map((profile) => [profile.id, profile.email]));
    const outbox = created
      .filter((row) => emails.has(row.user_id))
      .map((row) => ({
        notification_id: row.id,
        to_email: emails.get(row.user_id)!,
        subject: `Salve Italia — ${payload.title}`,
        body_text: [payload.body, payload.link ? `Ouvrir sur la plateforme : ${new URL(payload.link, env.APP_URL).toString()}` : null, '', 'Vous pouvez désactiver ces emails depuis votre espace.']
          .filter((line) => line !== null && line !== undefined)
          .join('\n\n'),
      }));
    if (outbox.length > 0) {
      const { error: outboxError } = await supabaseAdmin.from('email_outbox').insert(outbox);
      if (outboxError) throw outboxError;
    }
  }
  return created.length;
}

// Échec d'une notification : journalisé, sans jamais faire échouer l'action métier qui l'a déclenchée.
export async function notifySafely(userIds: string[], payload: NotificationPayload): Promise<void> {
  try {
    await notify(userIds, payload);
  } catch (err) {
    logger.error({ err, type: payload.type }, 'notification_failed');
  }
}

export async function listNotifications(userId: string) {
  const [list, unread] = await Promise.all([
    supabaseAdmin.from('notifications').select('id, type, title, body, link, read_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null),
  ]);
  if (list.error) throw list.error;
  if (unread.error) throw unread.error;
  return {
    unreadCount: unread.count ?? 0,
    notifications: (list.data as Record<string, unknown>[]).map((row) => ({
      id: row.id as string,
      type: row.type as NotificationType,
      title: row.title as string,
      body: row.body as string | null,
      link: row.link as string | null,
      readAt: row.read_at as string | null,
      createdAt: row.created_at as string,
    })),
  };
}

export async function markNotificationsRead(userId: string, ids: string[] | undefined) {
  let query = supabaseAdmin.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null);
  if (ids) query = query.in('id', ids);
  const { error } = await query;
  if (error) throw error;
}

export async function getEmailPreference(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('profiles').select('email_notifications').eq('id', userId).single();
  if (error) throw error;
  return data.email_notifications as boolean;
}

export async function setEmailPreference(userId: string, enabled: boolean): Promise<boolean> {
  const { error } = await supabaseAdmin.from('profiles').update({ email_notifications: enabled }).eq('id', userId);
  if (error) throw error;
  return enabled;
}

// ─────────────────────────────────────────────────────────────
// Envoi des emails
// ─────────────────────────────────────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_URL) return null;
  transporter ??= nodemailer.createTransport(env.SMTP_URL);
  return transporter;
}

export async function processEmailOutbox(limit = 20): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  const { data, error } = await supabaseAdmin
    .from('email_outbox')
    .select('id, to_email, subject, body_text, attempts')
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at')
    .limit(limit);
  if (error) throw error;

  const mailer = getTransporter();
  for (const row of data as { id: string; to_email: string; subject: string; body_text: string; attempts: number }[]) {
    if (!mailer) {
      await supabaseAdmin.from('email_outbox').update({ status: 'skipped', last_error: 'SMTP non configuré' }).eq('id', row.id).eq('status', 'pending');
      result.skipped += 1;
      continue;
    }

    // Réservation : une seule instance envoie un email donné.
    const { data: claimed } = await supabaseAdmin
      .from('email_outbox')
      .update({ attempts: row.attempts + 1, next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .eq('attempts', row.attempts)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    try {
      await mailer.sendMail({ from: env.EMAIL_FROM, to: row.to_email, subject: row.subject, text: row.body_text });
      await supabaseAdmin.from('email_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
      result.sent += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      const finalFailure = attempts >= MAX_EMAIL_ATTEMPTS;
      await supabaseAdmin
        .from('email_outbox')
        .update({
          status: finalFailure ? 'failed' : 'pending',
          last_error: err instanceof Error ? err.message.slice(0, 300) : 'erreur inconnue',
          next_attempt_at: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
        })
        .eq('id', row.id);
      if (finalFailure) result.failed += 1;
      logger.warn({ outboxId: row.id, attempts }, 'email_send_failed');
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Rappels planifiés
// ─────────────────────────────────────────────────────────────

// Rappel d'expiration (§11.1) : une seule notification par document et par date d'échéance.
export async function sweepExpiringDocuments(today = new Date()): Promise<number> {
  const horizon = new Date(today.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from('student_documents')
    .select('id, student_id, expires_at, document_types(label)')
    .not('expires_at', 'is', null)
    .lte('expires_at', horizon)
    .is('expiry_notified_at', null)
    .limit(200);
  if (error) throw error;

  let count = 0;
  for (const row of data as unknown as { id: string; student_id: string; expires_at: string; document_types: { label: string } | null }[]) {
    const expired = row.expires_at < today.toISOString().slice(0, 10);
    const label = row.document_types?.label ?? 'Un document';
    await notify([row.student_id], {
      type: 'document_expiring',
      title: expired ? `${label} : document expiré` : `${label} : expiration prochaine`,
      body: expired
        ? `Votre document « ${label} » est expiré depuis le ${new Date(row.expires_at).toLocaleDateString('fr-FR')}. Déposez une version à jour.`
        : `Votre document « ${label} » expire le ${new Date(row.expires_at).toLocaleDateString('fr-FR')}. Pensez à le renouveler.`,
      link: '/etudiant/documents',
      dedupeKey: `document_expiring:${row.id}:${row.expires_at}`,
      email: true,
    });
    await supabaseAdmin.from('student_documents').update({ expiry_notified_at: new Date().toISOString() }).eq('id', row.id);
    count += 1;
  }
  return count;
}

// Relances prospects arrivées à échéance (EF-62) : au responsable, sinon à tous les admins.
export async function sweepLeadFollowUps(now = new Date()): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id, full_name, next_follow_up_at, assigned_to')
    .lte('next_follow_up_at', now.toISOString())
    .not('status', 'in', '(inscrit,non_interesse)')
    .limit(200);
  if (error) throw error;
  const leads = data as { id: string; full_name: string; next_follow_up_at: string; assigned_to: string | null }[];
  if (leads.length === 0) return 0;

  const { data: admins, error: adminError } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin').eq('status', 'active');
  if (adminError) throw adminError;
  const adminIds = (admins as { id: string }[]).map((admin) => admin.id);

  let count = 0;
  for (const lead of leads) {
    count += await notify(lead.assigned_to ? [lead.assigned_to] : adminIds, {
      type: 'lead_follow_up',
      title: 'Relance prospect à effectuer',
      body: `La relance prévue pour ${lead.full_name} est arrivée à échéance.`,
      link: '/admin/prospects',
      dedupeKey: `lead_follow_up:${lead.id}:${lead.next_follow_up_at}`,
      email: true,
    });
  }
  return count;
}

const DAY_MS = 86_400_000;

// Lundi (UTC) de la semaine en cours : clé de déduplication hebdomadaire.
export function weekStartKey(now: Date): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

// §15 « rappel de cours » : séances des classes actives qui commencent dans les 24 heures, une fois par horaire.
export async function sweepClassSessionReminders(now = new Date()): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('class_sessions')
    .select('id, class_id, title, starts_at, location, classes!inner(is_active)')
    .eq('classes.is_active', true)
    .gt('starts_at', now.toISOString())
    .lte('starts_at', new Date(now.getTime() + DAY_MS).toISOString())
    .limit(200);
  if (error) throw error;
  const sessions = data as unknown as { id: string; class_id: string; title: string; starts_at: string; location: string | null }[];
  if (sessions.length === 0) return 0;

  const { data: members, error: membersError } = await supabaseAdmin
    .from('class_students')
    .select('class_id, student_id, profiles!inner(status)')
    .in('class_id', [...new Set(sessions.map((session) => session.class_id))])
    .eq('profiles.status', 'active');
  if (membersError) throw membersError;
  const studentsByClass = new Map<string, string[]>();
  for (const row of members as unknown as { class_id: string; student_id: string }[]) {
    studentsByClass.set(row.class_id, [...(studentsByClass.get(row.class_id) ?? []), row.student_id]);
  }

  let count = 0;
  for (const session of sessions) {
    const startsAt = new Date(session.starts_at).toISOString();
    count += await notify(studentsByClass.get(session.class_id) ?? [], {
      type: 'class_session_reminder',
      title: `Rappel : ${session.title}`,
      body: `Séance ${formatBrazzavilleDateTime(startsAt)}${session.location ? ` — ${session.location}` : ''}.`,
      link: '/calendrier',
      dedupeKey: `class_session_reminder:${session.id}:${startsAt}`,
      email: true,
    });
  }
  return count;
}

// §15 « simulation recommandée » : au plus une fois par semaine, aux étudiants sans simulation terminée depuis 7 jours.
export async function sweepSimulationRecommendations(now = new Date()): Promise<number> {
  const { count: activeTemplates, error: templateError } = await supabaseAdmin.from('test_templates').select('id', { count: 'exact', head: true }).eq('is_active', true);
  if (templateError) throw templateError;
  if (!activeTemplates) return 0;

  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const [students, recent] = await Promise.all([
    // Comptes récents exclus : laisser une semaine avant la première recommandation.
    supabaseAdmin.from('profiles').select('id').eq('role', 'student').eq('status', 'active').eq('must_change_password', false).lt('created_at', since).limit(2000),
    supabaseAdmin.from('simulations').select('student_id').eq('status', 'completed').gte('completed_at', since).limit(5000),
  ]);
  if (students.error) throw students.error;
  if (recent.error) throw recent.error;
  const practiced = new Set((recent.data as { student_id: string }[]).map((row) => row.student_id));
  const recipients = (students.data as { id: string }[]).map((row) => row.id).filter((id) => !practiced.has(id));

  return notify(recipients, {
    type: 'simulation_recommended',
    title: 'Une simulation cette semaine ?',
    body: 'Vous n’avez pas terminé de simulation depuis 7 jours. Une simulation en mode entraînement aide à garder le rythme avant le test.',
    link: '/etudiant/simulations',
    dedupeKey: `simulation_recommended:${weekStartKey(now)}`,
    // In-app uniquement : une recommandation ne justifie pas un email.
    email: false,
  });
}

export function startNotificationWorker(): NodeJS.Timeout[] {
  const runOutbox = () => void processEmailOutbox().catch((err: unknown) => logger.error({ err }, 'email_outbox_failed'));
  // Balayages indépendants : l'échec de l'un n'empêche pas les autres.
  const sweeps = { sweepExpiringDocuments, sweepLeadFollowUps, sweepClassSessionReminders, sweepSimulationRecommendations };
  const runSweeps = () =>
    void Promise.allSettled(Object.values(sweeps).map((sweep) => sweep())).then((results) =>
      results.forEach((result, index) => {
        if (result.status === 'rejected') logger.error({ err: result.reason, sweep: Object.keys(sweeps)[index] }, 'notification_sweep_failed');
      }),
    );
  runSweeps();
  runOutbox();
  return [setInterval(runOutbox, 30_000), setInterval(runSweeps, 60 * 60_000)];
}
