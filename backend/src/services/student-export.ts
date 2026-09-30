// EF-38 : export des données d'un étudiant pour l'admin — CSV des résultats (tableur) et JSON complet.
// Format à valider avec le client (CDC §22.6) ; aucun fichier déposé n'est inclus, seulement leurs métadonnées.
import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import { recordAudit } from './audit.js';
import { getStudentProfile } from './student-profile.js';

export const EXPORT_FORMAT_VERSION = 'export-v1-2026-09-14';
export type ExportFormat = 'csv' | 'json';

// ── CSV ─────────────────────────────────────────────────────

// Une cellule texte commençant par = + - @ serait interprétée comme formule par un tableur (injection CSV).
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Tableur français : virgule décimale ; un nombre n'est jamais une formule.
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// BOM UTF-8 et point-virgule : ouverture directe et correcte dans Excel en français.
export function toCsv(header: string[], rows: unknown[][]): string {
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Brazzaville' });
export const formatExportDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : '');

const MODE_LABELS: Record<string, string> = { entrainement: 'Entraînement', examen: 'Examen', revision: 'Révision', defi: 'Défi' };
const SIMULATION_STATUS_LABELS: Record<string, string> = { in_progress: 'En cours', completed: 'Terminée', abandoned: 'Abandonnée' };
const VISA_LABELS: Record<string, string> = { etudes: 'Visa études', tourisme: 'Visa touristique', travail: 'Visa travail' };
const EMBASSY_STATUS_LABELS: Record<string, string> = {
  in_progress: 'En cours',
  report_pending: 'Rapport en préparation',
  completed: 'Terminé',
  failed: 'Interrompu',
  abandoned: 'Trop court pour un rapport',
};
const LEVEL_LABELS: Record<string, string> = { faible: 'Préparation insuffisante', intermediaire: 'Préparation intermédiaire', satisfaisante: 'Préparation satisfaisante' };

export interface SimulationExportRow {
  id: string;
  mode: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_questions: number;
  score: number | string | null;
  score_by_section: Record<string, { correct?: number }> | null;
  test_templates: { code: string; name: string } | null;
}

export interface EmbassyExportRow {
  id: string;
  visa_type: string;
  scenario_code: string;
  input_mode: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  turn_count: number;
  overall_score: number | null;
  uses_profile: boolean;
  prompt_version: string;
  model: string;
  ai_report: (Record<string, unknown> & { level?: string; inconsistencies?: unknown[] }) | null;
}

export const RESULTS_CSV_HEADER = [
  'Type',
  'Début (heure de Brazzaville)',
  'Fin (heure de Brazzaville)',
  'Intitulé',
  'Mode ou type de visa',
  'Statut',
  'Score',
  'Bonnes réponses',
  'Questions ou réponses',
  'Niveau du rapport',
  'Points de cohérence à clarifier',
];

export function resultsCsv(simulations: SimulationExportRow[], sessions: EmbassyExportRow[], scenarioLabels: Map<string, string>): string {
  const rows = [
    ...simulations.map((simulation) => ({
      startedAt: simulation.started_at,
      cells: [
        'Simulation',
        formatExportDate(simulation.started_at),
        formatExportDate(simulation.completed_at),
        simulation.test_templates?.name ?? 'Révision ciblée',
        MODE_LABELS[simulation.mode] ?? simulation.mode,
        SIMULATION_STATUS_LABELS[simulation.status] ?? simulation.status,
        simulation.score === null ? null : Number(simulation.score),
        simulation.score_by_section ? Object.values(simulation.score_by_section).reduce((sum, section) => sum + (section.correct ?? 0), 0) : null,
        simulation.total_questions,
        null,
        null,
      ],
    })),
    ...sessions.map((session) => ({
      startedAt: session.started_at,
      cells: [
        'Entretien consulaire',
        formatExportDate(session.started_at),
        formatExportDate(session.completed_at),
        scenarioLabels.get(session.scenario_code) ?? session.scenario_code,
        VISA_LABELS[session.visa_type] ?? session.visa_type,
        EMBASSY_STATUS_LABELS[session.status] ?? session.status,
        session.overall_score,
        null,
        session.turn_count,
        session.ai_report?.level ? (LEVEL_LABELS[session.ai_report.level] ?? session.ai_report.level) : null,
        Array.isArray(session.ai_report?.inconsistencies) ? session.ai_report.inconsistencies.length : null,
      ],
    })),
  ].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return toCsv(RESULTS_CSV_HEADER, rows.map((row) => row.cells));
}

export function fileSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'etudiant'
  );
}

// ── Chargement ──────────────────────────────────────────────

async function loadStudentData(studentId: string) {
  const { data: account, error: accountError } = await db
    .from('profiles')
    .select('id, email, role, full_name, phone, level, status, created_at')
    .eq('id', studentId)
    .maybeSingle();
  if (accountError) throw accountError;
  if (!account || account.role !== 'student') throw new HttpError(404, 'student_not_found', 'Étudiant introuvable.');

  const [profile, simulations, sessions, documents, scenarios] = await Promise.all([
    getStudentProfile(studentId),
    db
      .from('simulations')
      .select('id, mode, status, started_at, completed_at, total_questions, score, score_by_section, test_templates(code, name)')
      .eq('student_id', studentId)
      .order('started_at'),
    db
      .from('embassy_sessions')
      .select('id, visa_type, scenario_code, input_mode, status, started_at, completed_at, turn_count, overall_score, uses_profile, prompt_version, model, ai_report')
      .eq('student_id', studentId)
      .order('started_at'),
    db
      .from('student_documents')
      .select('document_type, status, current_version, file_name, expires_at, reviewer_comment, reviewed_at, created_at, updated_at, document_types(label)')
      .eq('student_id', studentId)
      .order('document_type'),
    db.from('embassy_scenarios').select('code, label'),
  ]);
  for (const result of [simulations, sessions, documents, scenarios]) if (result.error) throw result.error;

  return {
    account: account as { id: string; email: string; full_name: string; phone: string | null; level: string | null; status: string; created_at: string },
    profile,
    simulations: simulations.data as unknown as SimulationExportRow[],
    sessions: sessions.data as unknown as EmbassyExportRow[],
    documents: documents.data as unknown as (Record<string, unknown> & { document_types: { label: string } | null })[],
    scenarioLabels: new Map((scenarios.data as { code: string; label: string }[]).map((row) => [row.code, row.label])),
  };
}

async function loadTranscripts(sessionIds: string[]) {
  const transcripts = new Map<string, { sequenceNumber: number; speaker: string; text: string; createdAt: string }[]>();
  if (sessionIds.length === 0) return transcripts;
  // api_content (contenu brut du fournisseur IA) n'est jamais exporté.
  const { data, error } = await db
    .from('embassy_messages')
    .select('session_id, sequence_number, speaker, text_content, created_at')
    .in('session_id', sessionIds)
    .order('sequence_number');
  if (error) throw error;
  for (const row of data as { session_id: string; sequence_number: number; speaker: string; text_content: string; created_at: string }[]) {
    const list = transcripts.get(row.session_id) ?? [];
    list.push({ sequenceNumber: row.sequence_number, speaker: row.speaker, text: row.text_content, createdAt: row.created_at });
    transcripts.set(row.session_id, list);
  }
  return transcripts;
}

// ── Export ──────────────────────────────────────────────────

export async function exportStudentData(actorId: string, studentId: string, format: ExportFormat) {
  const data = await loadStudentData(studentId);
  const now = new Date();
  const baseName = `salve-italia-${fileSlug(data.account.full_name)}-${now.toISOString().slice(0, 10)}`;

  let file: { fileName: string; contentType: string; body: string };
  if (format === 'csv') {
    file = { fileName: `${baseName}-resultats.csv`, contentType: 'text/csv; charset=utf-8', body: resultsCsv(data.simulations, data.sessions, data.scenarioLabels) };
  } else {
    const transcripts = await loadTranscripts(data.sessions.map((session) => session.id));
    const payload = {
      format: EXPORT_FORMAT_VERSION,
      exportedAt: now.toISOString(),
      notice:
        'Données personnelles confidentielles (démarche d’études et de visa). À conserver de façon sécurisée et à supprimer dès qu’elles ne sont plus nécessaires. Les rapports d’entretien sont des outils pédagogiques sans valeur administrative.',
      student: {
        id: data.account.id,
        email: data.account.email,
        fullName: data.account.full_name,
        phone: data.account.phone,
        level: data.account.level,
        status: data.account.status,
        createdAt: data.account.created_at,
      },
      profile: data.profile,
      simulations: data.simulations.map((simulation) => ({
        id: simulation.id,
        template: simulation.test_templates,
        mode: simulation.mode,
        status: simulation.status,
        startedAt: simulation.started_at,
        completedAt: simulation.completed_at,
        totalQuestions: simulation.total_questions,
        score: simulation.score === null ? null : Number(simulation.score),
        scoreBySection: simulation.score_by_section,
      })),
      embassySessions: data.sessions.map((session) => ({
        id: session.id,
        visaType: session.visa_type,
        scenario: { code: session.scenario_code, label: data.scenarioLabels.get(session.scenario_code) ?? null },
        inputMode: session.input_mode,
        status: session.status,
        usesProfile: session.uses_profile,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        turnCount: session.turn_count,
        overallScore: session.overall_score,
        promptVersion: session.prompt_version,
        model: session.model,
        report: session.ai_report,
        transcript: transcripts.get(session.id) ?? [],
      })),
      documents: data.documents.map((document) => ({
        type: document.document_type,
        label: document.document_types?.label ?? null,
        status: document.status,
        version: document.current_version,
        fileName: document.file_name,
        expiresAt: document.expires_at,
        reviewerComment: document.reviewer_comment,
        reviewedAt: document.reviewed_at,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      })),
    };
    file = { fileName: `${baseName}-complet.json`, contentType: 'application/json; charset=utf-8', body: JSON.stringify(payload, null, 2) };
  }

  // ENF-08 : l'export de données sensibles est tracé.
  await recordAudit({ actorId, action: 'student.export', entityType: 'profile', entityId: studentId, metadata: { format, version: EXPORT_FORMAT_VERSION } });
  return file;
}
