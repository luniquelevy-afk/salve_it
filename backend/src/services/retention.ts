// ENF-09 / ENF-11 : conservation limitée des données sensibles.
// Chaque durée est fixée par l'admin ; null = aucune suppression automatique (cadre légal à valider, CDC §22.7).
// Jamais purgés : journal d'audit (ENF-08), coûts IA (sans contenu), comptes et résultats de tests.
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { recordAudit } from './audit.js';
import { DOCUMENT_BUCKET } from './document-files.js';

export const RETENTION_RULES = [
  {
    key: 'embassySessionsMonths',
    column: 'embassy_sessions_months',
    label: 'Entretiens consulaires',
    description: 'Transcripts, rapports et commentaires enseignants des entretiens terminés, comptés depuis le début de l’entretien.',
    unit: 'entretien(s)',
  },
  {
    key: 'suspendedStudentsMonths',
    column: 'suspended_students_months',
    label: 'Comptes étudiants suspendus',
    description: 'Documents déposés, entretiens et profil de projet (financement, villes…) des étudiants suspendus depuis cette durée. Le compte et les résultats de tests sont conservés.',
    unit: 'étudiant(s)',
  },
  {
    key: 'documentVersionsMonths',
    column: 'document_versions_months',
    label: 'Anciennes versions de documents',
    description: 'Fichiers remplacés par une version plus récente, comptés depuis leur dépôt. La version en cours est toujours conservée.',
    unit: 'fichier(s)',
  },
  {
    key: 'leadsMonths',
    column: 'leads_months',
    label: 'Prospects',
    description: 'Prospects sans mise à jour depuis cette durée (avec leur historique) et coordonnées laissées au test de niveau gratuit, dont le score est conservé de façon anonyme.',
    unit: 'prospect(s) ou coordonnée(s)',
  },
  {
    key: 'notificationsMonths',
    column: 'notifications_months',
    label: 'Notifications et emails',
    description: 'Notifications déjà lues et emails déjà traités (envoyés, échoués ou ignorés). Les emails en attente ne sont jamais supprimés.',
    unit: 'notification(s) ou email(s)',
  },
] as const;

export type RetentionKey = (typeof RETENTION_RULES)[number]['key'];
export type RetentionValues = Record<RetentionKey, number | null>;
export type RetentionCounts = Partial<Record<RetentionKey, number>>;

interface SettingsRow {
  embassy_sessions_months: number | null;
  suspended_students_months: number | null;
  document_versions_months: number | null;
  leads_months: number | null;
  notifications_months: number | null;
  updated_at: string;
  last_run_at: string | null;
  last_run_result: RetentionRun | null;
}

export interface RetentionRun {
  ranAt: string;
  trigger: 'manuel' | 'automatique';
  rules: { rule: RetentionKey; deleted: number; error?: string }[];
}

const SETTINGS_COLUMNS = 'embassy_sessions_months, suspended_students_months, document_versions_months, leads_months, notifications_months, updated_at, last_run_at, last_run_result';
const BATCH = 200;
const MAX_BATCHES = 25;

export function cutoffDate(months: number, now = new Date()): string {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

export interface VersionRow {
  id: string;
  version: number;
  storage_path: string;
  student_documents: { current_version: number; storage_path: string } | null;
}

// Une version n'est purgeable que si elle est remplacée et que son fichier n'est pas celui de la version en cours.
export function supersededVersions(rows: VersionRow[]): VersionRow[] {
  return rows.filter((row) => row.student_documents !== null && row.version < row.student_documents.current_version && row.storage_path !== row.student_documents.storage_path);
}

async function loadSettings(): Promise<SettingsRow> {
  const { data, error } = await supabaseAdmin.from('retention_settings').select(SETTINGS_COLUMNS).eq('id', true).single();
  if (error) throw error;
  return data as SettingsRow;
}

function toValues(row: SettingsRow): RetentionValues {
  return Object.fromEntries(RETENTION_RULES.map((rule) => [rule.key, row[rule.column]])) as RetentionValues;
}

async function exactCount(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function removeFiles(paths: string[]) {
  const unique = [...new Set(paths)];
  for (let index = 0; index < unique.length; index += 100) {
    const { error } = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove(unique.slice(index, index + 100));
    if (error) throw error;
  }
}

// ── Entretiens ──────────────────────────────────────────────

async function deleteEmbassySessions(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  // Pas de clé étrangère sur teacher_feedback.target_id : les commentaires liés partent avec l'entretien.
  const { error: feedbackError } = await supabaseAdmin.from('teacher_feedback').delete().eq('target_type', 'embassy_session').in('target_id', ids);
  if (feedbackError) throw feedbackError;
  const { error } = await supabaseAdmin.from('embassy_sessions').delete().in('id', ids);
  if (error) throw error;
  return ids.length;
}

const finishedSessions = (cutoff: string) => supabaseAdmin.from('embassy_sessions').select('id', { count: 'exact' }).lt('started_at', cutoff).not('status', 'in', '(in_progress,report_pending)');

async function purgeEmbassySessions(cutoff: string): Promise<number> {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await finishedSessions(cutoff).limit(BATCH);
    if (error) throw error;
    const ids = (data as { id: string }[]).map((row) => row.id);
    total += await deleteEmbassySessions(ids);
    if (ids.length < BATCH) break;
  }
  return total;
}

// ── Comptes étudiants suspendus ─────────────────────────────

async function suspendedStudentsWithData(cutoff: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('role', 'student').eq('status', 'suspended').lt('suspended_at', cutoff).limit(BATCH);
  if (error) throw error;
  const ids = (data as { id: string }[]).map((row) => row.id);
  if (ids.length === 0) return [];

  // Seuls les étudiants ayant encore des données sensibles sont concernés (purge idempotente).
  const results = await Promise.all(
    (['student_documents', 'embassy_sessions', 'student_profiles'] as const).map((table) => supabaseAdmin.from(table).select('student_id').in('student_id', ids)),
  );
  const withData = new Set<string>();
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data as { student_id: string }[]) withData.add(row.student_id);
  }
  return [...withData];
}

async function purgeSuspendedStudents(cutoff: string): Promise<number> {
  const ids = await suspendedStudentsWithData(cutoff);
  if (ids.length === 0) return 0;

  const { data: documents, error: documentsError } = await supabaseAdmin.from('student_documents').select('id, storage_path').in('student_id', ids);
  if (documentsError) throw documentsError;
  const documentRows = documents as { id: string; storage_path: string }[];
  if (documentRows.length > 0) {
    const documentIds = documentRows.map((row) => row.id);
    const { data: versions, error: versionsError } = await supabaseAdmin.from('student_document_versions').select('storage_path').in('document_id', documentIds);
    if (versionsError) throw versionsError;
    // Fichiers d'abord : jamais de ligne supprimée en laissant son fichier dans le stockage.
    await removeFiles([...documentRows.map((row) => row.storage_path), ...(versions as { storage_path: string }[]).map((row) => row.storage_path)]);
    const { error } = await supabaseAdmin.from('student_documents').delete().in('id', documentIds);
    if (error) throw error;
  }

  const { data: sessions, error: sessionsError } = await supabaseAdmin.from('embassy_sessions').select('id').in('student_id', ids);
  if (sessionsError) throw sessionsError;
  await deleteEmbassySessions((sessions as { id: string }[]).map((row) => row.id));

  const { error: profileError } = await supabaseAdmin.from('student_profiles').delete().in('student_id', ids);
  if (profileError) throw profileError;
  return ids.length;
}

// ── Anciennes versions de documents ─────────────────────────

async function oldVersions(cutoff: string): Promise<VersionRow[]> {
  const { data, error } = await supabaseAdmin
    .from('student_document_versions')
    .select('id, version, storage_path, student_documents!inner(current_version, storage_path)')
    .lt('uploaded_at', cutoff)
    .limit(2000);
  if (error) throw error;
  return supersededVersions(data as unknown as VersionRow[]);
}

async function purgeDocumentVersions(cutoff: string): Promise<number> {
  const versions = await oldVersions(cutoff);
  if (versions.length === 0) return 0;
  await removeFiles(versions.map((row) => row.storage_path));
  const ids = versions.map((row) => row.id);
  for (let index = 0; index < ids.length; index += BATCH) {
    const { error } = await supabaseAdmin.from('student_document_versions').delete().in('id', ids.slice(index, index + BATCH));
    if (error) throw error;
  }
  return versions.length;
}

// ── Prospects et test de niveau ─────────────────────────────

async function purgeLeads(cutoff: string): Promise<number> {
  const { count: leads, error } = await supabaseAdmin.from('leads').delete({ count: 'exact' }).lt('updated_at', cutoff);
  if (error) throw error;
  // Le score reste utile aux statistiques ; les coordonnées disparaissent.
  const { count: attempts, error: attemptsError } = await supabaseAdmin
    .from('level_test_attempts')
    .update({ full_name: null, email: null, phone: null, desired_program: null, contact_consent: false }, { count: 'exact' })
    .eq('contact_consent', true)
    .lt('created_at', cutoff);
  if (attemptsError) throw attemptsError;
  return (leads ?? 0) + (attempts ?? 0);
}

// ── Notifications ───────────────────────────────────────────

async function purgeNotifications(cutoff: string): Promise<number> {
  const { count: notifications, error } = await supabaseAdmin.from('notifications').delete({ count: 'exact' }).not('read_at', 'is', null).lt('created_at', cutoff);
  if (error) throw error;
  const { count: emails, error: emailsError } = await supabaseAdmin.from('email_outbox').delete({ count: 'exact' }).neq('status', 'pending').lt('created_at', cutoff);
  if (emailsError) throw emailsError;
  return (notifications ?? 0) + (emails ?? 0);
}

const PURGES: Record<RetentionKey, (cutoff: string) => Promise<number>> = {
  embassySessionsMonths: purgeEmbassySessions,
  suspendedStudentsMonths: purgeSuspendedStudents,
  documentVersionsMonths: purgeDocumentVersions,
  leadsMonths: purgeLeads,
  notificationsMonths: purgeNotifications,
};

const PREVIEWS: Record<RetentionKey, (cutoff: string) => Promise<number>> = {
  embassySessionsMonths: (cutoff) => exactCount(finishedSessions(cutoff).limit(1)),
  suspendedStudentsMonths: async (cutoff) => (await suspendedStudentsWithData(cutoff)).length,
  documentVersionsMonths: async (cutoff) => (await oldVersions(cutoff)).length,
  leadsMonths: async (cutoff) => {
    const [leads, attempts] = await Promise.all([
      exactCount(supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).lt('updated_at', cutoff)),
      exactCount(supabaseAdmin.from('level_test_attempts').select('id', { count: 'exact', head: true }).eq('contact_consent', true).lt('created_at', cutoff)),
    ]);
    return leads + attempts;
  },
  notificationsMonths: async (cutoff) => {
    const [notifications, emails] = await Promise.all([
      exactCount(supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).not('read_at', 'is', null).lt('created_at', cutoff)),
      exactCount(supabaseAdmin.from('email_outbox').select('id', { count: 'exact', head: true }).neq('status', 'pending').lt('created_at', cutoff)),
    ]);
    return notifications + emails;
  },
};

// ── API du service ──────────────────────────────────────────

// Nombre d'éléments qu'une purge supprimerait aujourd'hui, pour les seules règles activées.
export async function previewRetention(values: RetentionValues, now = new Date()): Promise<RetentionCounts> {
  const entries = await Promise.all(
    RETENTION_RULES.filter((rule) => values[rule.key] !== null).map(async (rule) => [rule.key, await PREVIEWS[rule.key](cutoffDate(values[rule.key]!, now))] as const),
  );
  return Object.fromEntries(entries);
}

export async function getRetentionSettings() {
  const settings = await loadSettings();
  const values = toValues(settings);
  return {
    rules: RETENTION_RULES.map((rule) => ({ key: rule.key, label: rule.label, description: rule.description, unit: rule.unit, months: values[rule.key] })),
    preview: await previewRetention(values),
    updatedAt: settings.updated_at,
    lastRunAt: settings.last_run_at,
    lastRunResult: settings.last_run_result,
  };
}

export async function updateRetentionSettings(actorId: string, values: RetentionValues) {
  const { error } = await supabaseAdmin
    .from('retention_settings')
    .update({
      ...Object.fromEntries(RETENTION_RULES.map((rule) => [rule.column, values[rule.key]])),
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
  await recordAudit({ actorId, action: 'retention.settings_update', entityType: 'retention_settings', metadata: { ...values } });
  return getRetentionSettings();
}

// Durées utiles à l'information des étudiants (ENF-11) : transparence sur ce qui est conservé.
export async function getRetentionPolicy() {
  const values = toValues(await loadSettings());
  return {
    embassySessionsMonths: values.embassySessionsMonths,
    suspendedStudentsMonths: values.suspendedStudentsMonths,
    documentVersionsMonths: values.documentVersionsMonths,
  };
}

export async function runRetention(actorId: string | null, now = new Date()): Promise<RetentionRun | null> {
  const values = toValues(await loadSettings());
  const enabled = RETENTION_RULES.filter((rule) => values[rule.key] !== null);
  if (enabled.length === 0) return null;

  const rules: RetentionRun['rules'] = [];
  // Une règle en échec n'empêche pas les autres ; le détail technique reste dans les journaux serveur.
  for (const rule of enabled) {
    try {
      rules.push({ rule: rule.key, deleted: await PURGES[rule.key](cutoffDate(values[rule.key]!, now)) });
    } catch (err) {
      logger.error({ err, rule: rule.key }, 'retention_purge_failed');
      rules.push({ rule: rule.key, deleted: 0, error: 'Échec de la purge : voir les journaux du serveur.' });
    }
  }

  const run: RetentionRun = { ranAt: now.toISOString(), trigger: actorId ? 'manuel' : 'automatique', rules };
  const { error } = await supabaseAdmin.from('retention_settings').update({ last_run_at: run.ranAt, last_run_result: run }).eq('id', true);
  if (error) logger.error({ err: error }, 'retention_run_record_failed');
  await recordAudit({ actorId, action: 'retention.purge', entityType: 'retention_settings', metadata: { ...run } });
  return run;
}

export function startRetentionWorker(): NodeJS.Timeout {
  const tick = () => void runRetention(null).catch((err: unknown) => logger.error({ err }, 'retention_run_failed'));
  // Premier passage différé : ne ralentit pas le démarrage et laisse le temps de corriger une mauvaise configuration.
  setTimeout(tick, 10 * 60_000).unref();
  return setInterval(tick, 24 * 3_600_000);
}
