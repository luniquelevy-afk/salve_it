import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { getEffectiveLimits } from './ai-limits.js';
import type { StoredApiContent } from './ai-types.js';
import { activeModel, AiError, isAiConfigured, runConsulTurn, runEmbassyReport, type AiUsage } from './ai.js';
import { recordAudit } from './audit.js';
import { computeEmbassyProgress, type ProgressPoint } from './embassy-progress.js';
import {
  buildConversation,
  buildReportRequest,
  EMBASSY_PROMPT_VERSION,
  finalizeReport,
  profileFactsFromRow,
  toStudentReport,
  type ConversationContext,
  type EmbassyReport,
  type KeyFacts,
  type ProfileFacts,
  type StoredMessage,
  type VisaType,
} from './embassy-prompts.js';
import { getScenario, listScenarios, type Scenario } from './embassy-scenarios.js';
import { notifySafely } from './notifications.js';

export type InputMode = 'voice' | 'text';
type SessionStatus = 'in_progress' | 'report_pending' | 'completed' | 'failed' | 'abandoned';

// Un rapport exige un minimum d'échange : jamais de rapport sur une session vide (EF-23).
const MIN_STUDENT_ANSWERS_FOR_REPORT = 2;
const MAX_REPORT_ATTEMPTS = 3;
const REPORT_CLAIM_TIMEOUT_MS = 5 * 60_000;

interface SessionRow {
  id: string;
  student_id: string;
  visa_type: VisaType;
  scenario_code: string;
  input_mode: InputMode;
  status: SessionStatus;
  prompt_version: string;
  model: string;
  max_turns: number;
  turn_count: number;
  started_at: string;
  ended_at: string | null;
  completed_at: string | null;
  overall_score: number | null;
  ai_report: Partial<EmbassyReport> | null;
  report_attempts: number;
  report_claimed_at: string | null;
  failure_reason: string | null;
  uses_profile: boolean;
  profile_snapshot: ProfileFacts | null;
  cost_limit_reached: boolean;
}

const SESSION_COLUMNS =
  'id, student_id, visa_type, scenario_code, input_mode, status, prompt_version, model, max_turns, turn_count, started_at, ended_at, completed_at, overall_score, ai_report, report_attempts, report_claimed_at, failure_reason, uses_profile, profile_snapshot, cost_limit_reached';

interface MessageRow extends StoredMessage {
  id: string;
  created_at: string;
}

const MESSAGE_COLUMNS = 'id, speaker, sequence_number, text_content, api_content, created_at';

function toHttpError(err: unknown): unknown {
  if (!(err instanceof AiError)) return err;
  switch (err.kind) {
    case 'unavailable':
      return new HttpError(503, 'ai_unavailable', "L'agent ambassade est momentanément indisponible. Contactez le centre si le problème persiste.");
    case 'rate_limited':
      return new HttpError(503, 'ai_busy', "L'agent ambassade est très sollicité. Réessayez dans quelques minutes.");
    default:
      return new HttpError(502, 'ai_error', "L'agent n'a pas pu répondre. La session a été interrompue, aucun rapport ne sera généré.");
  }
}

async function recordUsage(studentId: string, sessionId: string, operation: 'embassy_turn' | 'embassy_report', usage: AiUsage) {
  const { error } = await supabaseAdmin.from('ai_usage_logs').insert({
    student_id: studentId,
    session_id: sessionId,
    operation,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cache_read_input_tokens: usage.cacheReadInputTokens,
    cache_creation_input_tokens: usage.cacheCreationInputTokens,
    estimated_cost: usage.estimatedCost,
  });
  if (error) logger.error({ err: error, sessionId, operation }, 'ai_usage_log_failed');
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function sumCost(filter: { studentId?: string; sessionId?: string; since?: string }): Promise<number> {
  let query = supabaseAdmin.from('ai_usage_logs').select('estimated_cost');
  if (filter.studentId) query = query.eq('student_id', filter.studentId);
  if (filter.sessionId) query = query.eq('session_id', filter.sessionId);
  if (filter.since) query = query.gte('created_at', filter.since);
  const { data, error } = await query;
  if (error) throw error;
  return (data as { estimated_cost: number | string }[]).reduce((sum, row) => sum + Number(row.estimated_cost), 0);
}

async function weeklySessionCount(studentId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('embassy_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .neq('status', 'failed')
    .gte('started_at', new Date(Date.now() - 7 * 24 * 3_600_000).toISOString());
  if (error) throw error;
  return count ?? 0;
}

async function loadProfileFacts(studentId: string): Promise<ProfileFacts | null> {
  const [profileResult, levelResult] = await Promise.all([
    supabaseAdmin
      .from('student_profiles')
      .select('study_objective, desired_field, preferred_cities, institution_type_preference, financing_source, has_guarantor, budget_range, target_intake')
      .eq('student_id', studentId)
      .maybeSingle(),
    supabaseAdmin.from('profiles').select('level').eq('id', studentId).single(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (levelResult.error) throw levelResult.error;
  if (!profileResult.data) return null;
  return profileFactsFromRow(profileResult.data as Parameters<typeof profileFactsFromRow>[0], (levelResult.data.level as string | null) ?? null);
}

export async function getEmbassyConfig(studentId: string) {
  const [limits, used, cost, scenarios, profile] = await Promise.all([
    getEffectiveLimits(studentId),
    weeklySessionCount(studentId),
    sumCost({ studentId, since: startOfMonth() }),
    listScenarios(true),
    supabaseAdmin.from('student_profiles').select('student_id').eq('student_id', studentId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  return {
    aiAvailable: isAiConfigured(),
    maxTurns: limits.maxTurns,
    weeklyLimit: limits.weeklySessionLimit,
    weeklyUsed: used,
    budgetReached: cost >= limits.monthlyCostLimitUsd,
    profileAvailable: Boolean(profile.data),
    scenarios: scenarios.map((scenario) => ({ code: scenario.code, label: scenario.label, description: scenario.description, visaTypes: scenario.visaTypes })),
  };
}

async function loadOwnedSession(studentId: string, sessionId: string): Promise<SessionRow> {
  const { data, error } = await supabaseAdmin.from('embassy_sessions').select(SESSION_COLUMNS).eq('id', sessionId).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'embassy_session_not_found', 'Entretien introuvable.');
  return data as SessionRow;
}

async function loadMessages(sessionId: string): Promise<MessageRow[]> {
  const { data, error } = await supabaseAdmin.from('embassy_messages').select(MESSAGE_COLUMNS).eq('session_id', sessionId).order('sequence_number');
  if (error) throw error;
  return data as MessageRow[];
}

function conversationContext(session: SessionRow, scenario: Scenario | null): ConversationContext {
  return {
    visaType: session.visa_type,
    maxTurns: session.max_turns,
    scenario: scenario ? { label: scenario.label, instructions: scenario.agentInstructions, focusThemes: scenario.focusThemes } : null,
    profileFacts: session.uses_profile ? session.profile_snapshot : null,
  };
}

async function failSession(sessionId: string, reason: string) {
  const { error } = await supabaseAdmin
    .from('embassy_sessions')
    .update({ status: 'failed', ended_at: new Date().toISOString(), failure_reason: reason })
    .eq('id', sessionId)
    .eq('status', 'in_progress');
  if (error) logger.error({ err: error, sessionId }, 'embassy_fail_session_failed');
}

async function insertAgentMessage(sessionId: string, sequenceNumber: number, text: string, apiContent: StoredApiContent) {
  const { error } = await supabaseAdmin.from('embassy_messages').insert({
    session_id: sessionId,
    speaker: 'agent',
    sequence_number: sequenceNumber,
    text_content: text,
    api_content: apiContent,
  });
  if (error) throw error;
}

async function scenarioLabels(): Promise<Map<string, string>> {
  return new Map((await listScenarios(false)).map((scenario) => [scenario.code, scenario.label]));
}

function toSessionView(session: SessionRow, messages: MessageRow[], scenarioLabel: string | null, audience: 'student' | 'staff') {
  return {
    id: session.id,
    visaType: session.visa_type,
    scenario: { code: session.scenario_code, label: scenarioLabel },
    inputMode: session.input_mode,
    status: session.status,
    usesProfile: session.uses_profile,
    costLimitReached: session.cost_limit_reached,
    maxTurns: session.max_turns,
    turnCount: session.turn_count,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    completedAt: session.completed_at,
    overallScore: session.overall_score,
    report: audience === 'staff' ? session.ai_report : toStudentReport(session.ai_report),
    messages: messages.map((message) => ({
      sequenceNumber: message.sequence_number,
      speaker: message.speaker,
      text: message.text_content,
      createdAt: message.created_at,
    })),
  };
}

export async function getEmbassySession(studentId: string, sessionId: string) {
  const session = await loadOwnedSession(studentId, sessionId);
  const [messages, scenario] = await Promise.all([loadMessages(session.id), getScenario(session.scenario_code)]);
  return toSessionView(session, messages, scenario?.label ?? null, 'student');
}

// Vue enseignant (V1.3) : rapport complet, vue enseignant incluse. L'appelant vérifie l'accès.
export async function getEmbassySessionForStaff(studentId: string, sessionId: string) {
  const session = await loadOwnedSession(studentId, sessionId);
  const [messages, scenario] = await Promise.all([loadMessages(session.id), getScenario(session.scenario_code)]);
  return toSessionView(session, messages, scenario?.label ?? null, 'staff');
}

export async function listEmbassySessions(studentId: string) {
  const [result, labels] = await Promise.all([
    supabaseAdmin
      .from('embassy_sessions')
      .select('id, visa_type, scenario_code, input_mode, status, turn_count, max_turns, started_at, completed_at, overall_score, uses_profile, ai_report->>level, ai_report->inconsistencies')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(50),
    scenarioLabels(),
  ]);
  if (result.error) throw result.error;
  return (result.data as unknown as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    visaType: row.visa_type as VisaType,
    scenarioLabel: labels.get(row.scenario_code as string) ?? null,
    inputMode: row.input_mode as InputMode,
    status: row.status as SessionStatus,
    turnCount: row.turn_count as number,
    maxTurns: row.max_turns as number,
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string | null,
    overallScore: row.overall_score as number | null,
    level: (row.level as string | null) ?? null,
    inconsistencyCount: Array.isArray(row.inconsistencies) ? row.inconsistencies.length : 0,
  }));
}

export async function getEmbassyProgress(studentId: string) {
  const [result, labels] = await Promise.all([
    supabaseAdmin
      .from('embassy_sessions')
      .select('id, visa_type, scenario_code, completed_at, overall_score, ai_report')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .order('completed_at')
      .limit(50),
    scenarioLabels(),
  ]);
  if (result.error) throw result.error;
  const points: ProgressPoint[] = (result.data as unknown as { id: string; visa_type: VisaType; scenario_code: string; completed_at: string; overall_score: number; ai_report: Partial<EmbassyReport> | null }[]).map((row) => ({
    sessionId: row.id,
    completedAt: row.completed_at,
    visaType: row.visa_type,
    scenarioLabel: labels.get(row.scenario_code) ?? null,
    overallScore: row.overall_score,
    dimensions: row.ai_report?.dimensions ?? {},
    inconsistencyTopics: (row.ai_report?.inconsistencies ?? []).map((item) => item.topic),
  }));
  return computeEmbassyProgress(points);
}

export async function startEmbassySession(studentId: string, input: { visaType: VisaType; inputMode: InputMode; scenarioCode: string; useProfile: boolean }) {
  if (!isAiConfigured()) {
    throw new HttpError(503, 'ai_unavailable', "L'agent ambassade n'est pas encore configuré. Contactez le centre.");
  }

  const { data: active, error: activeError } = await supabaseAdmin.from('embassy_sessions').select('id').eq('student_id', studentId).eq('status', 'in_progress').maybeSingle();
  if (activeError) throw activeError;
  if (active) throw new HttpError(409, 'embassy_session_in_progress', 'Un entretien est déjà en cours.', { sessionId: active.id });

  const limits = await getEffectiveLimits(studentId);
  // EF-22 : quota hebdomadaire administrable (réglage du centre ou exception par étudiant).
  if ((await weeklySessionCount(studentId)) >= limits.weeklySessionLimit) {
    throw new HttpError(429, 'quota_exceeded', `Vous avez atteint la limite de ${limits.weeklySessionLimit} entretien(s) par semaine.`);
  }
  // EF-59 : blocage explicite quand la limite de coût mensuelle est atteinte.
  if ((await sumCost({ studentId, since: startOfMonth() })) >= limits.monthlyCostLimitUsd) {
    throw new HttpError(429, 'ai_budget_exceeded', "Limite d'utilisation mensuelle de l'agent atteinte. Contactez le centre.");
  }

  const scenario = await getScenario(input.scenarioCode);
  if (!scenario?.isActive) throw new HttpError(400, 'scenario_not_found', 'Scénario d’entretien introuvable.');
  if (!scenario.visaTypes.includes(input.visaType)) throw new HttpError(400, 'scenario_not_applicable', 'Ce scénario ne correspond pas au type de visa choisi.');

  // EF-56 : profil transmis uniquement avec le consentement explicite de l'étudiant, sous forme minimisée.
  const profileFacts = input.useProfile ? await loadProfileFacts(studentId) : null;
  if (input.useProfile && !profileFacts) throw new HttpError(400, 'profile_required', 'Complétez d’abord votre profil pour activer la détection des incohérences.');

  const { data: created, error: insertError } = await supabaseAdmin
    .from('embassy_sessions')
    .insert({
      student_id: studentId,
      visa_type: input.visaType,
      scenario_code: scenario.code,
      input_mode: input.inputMode,
      prompt_version: EMBASSY_PROMPT_VERSION,
      model: activeModel(),
      max_turns: limits.maxTurns,
      uses_profile: input.useProfile,
      profile_snapshot: profileFacts,
    })
    .select(SESSION_COLUMNS)
    .single();
  if (insertError?.code === '23505') throw new HttpError(409, 'embassy_session_in_progress', 'Un entretien est déjà en cours.');
  if (insertError) throw insertError;
  const session = created as SessionRow;

  try {
    const turn = await runConsulTurn(buildConversation(conversationContext(session, scenario), []));
    await recordUsage(studentId, session.id, 'embassy_turn', turn.usage);
    await insertAgentMessage(session.id, 0, turn.message, turn.apiContent);
  } catch (err) {
    await failSession(session.id, err instanceof AiError ? `ai_${err.kind}` : 'internal_error');
    throw toHttpError(err);
  }

  return getEmbassySession(studentId, session.id);
}

export async function sendStudentMessage(studentId: string, sessionId: string, input: { text: string; expectedSequence: number; responseTimeSeconds?: number | undefined }) {
  const session = await loadOwnedSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw new HttpError(409, 'embassy_session_closed', 'Cet entretien est terminé.');

  const messages = await loadMessages(session.id);
  const last = messages.at(-1);
  // Tour par tour : une réponse n'est acceptée que juste après la question courante de l'agent.
  if (!last || last.speaker !== 'agent' || last.sequence_number !== input.expectedSequence) {
    throw new HttpError(409, 'out_of_sequence', 'Cette question a déjà reçu une réponse.');
  }

  const limits = await getEffectiveLimits(studentId);
  if ((await sumCost({ studentId, since: startOfMonth() })) >= limits.monthlyCostLimitUsd) {
    throw new HttpError(429, 'ai_budget_exceeded', "Limite d'utilisation mensuelle de l'agent atteinte. Contactez le centre.");
  }
  const answered = messages.filter((message) => message.speaker === 'student').length;
  // EF-59 : plafond de coût par entretien — clôture propre, avec rapport si l'échange est suffisant.
  if ((await sumCost({ sessionId: session.id })) >= limits.sessionCostLimitUsd) {
    const status = await closeSession(session.id, answered, true);
    throw new HttpError(
      409,
      'session_cost_limit',
      status === 'report_pending'
        ? 'Limite d’utilisation de cet entretien atteinte : il est clôturé et votre rapport est en préparation.'
        : 'Limite d’utilisation de cet entretien atteinte : il est clôturé, trop tôt pour produire un rapport.',
    );
  }

  const studentMessage: MessageRow = {
    id: '',
    speaker: 'student',
    sequence_number: last.sequence_number + 1,
    text_content: input.text,
    api_content: null,
    created_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabaseAdmin.from('embassy_messages').insert({
    session_id: session.id,
    speaker: 'student',
    sequence_number: studentMessage.sequence_number,
    text_content: input.text,
    response_time_seconds: input.responseTimeSeconds ?? null,
  });
  if (insertError?.code === '23505') throw new HttpError(409, 'out_of_sequence', 'Cette question a déjà reçu une réponse.');
  if (insertError) throw insertError;

  const turnCount = answered + 1;
  const { error: countError } = await supabaseAdmin.from('embassy_sessions').update({ turn_count: turnCount }).eq('id', session.id);
  if (countError) throw countError;

  let turn;
  try {
    const scenario = await getScenario(session.scenario_code);
    turn = await runConsulTurn(buildConversation(conversationContext(session, scenario), [...messages, studentMessage]));
    await recordUsage(studentId, session.id, 'embassy_turn', turn.usage);
    await insertAgentMessage(session.id, studentMessage.sequence_number + 1, turn.message, turn.apiContent);
  } catch (err) {
    await failSession(session.id, err instanceof AiError ? `ai_${err.kind}` : 'internal_error');
    throw toHttpError(err);
  }

  // EF-19 : fin décidée par l'agent ou limite de tours atteinte.
  const ended = turn.endInterview || turnCount >= session.max_turns;
  if (ended) await closeSession(session.id, turnCount);

  return {
    agentMessage: { sequenceNumber: studentMessage.sequence_number + 1, speaker: 'agent' as const, text: turn.message },
    ended,
    turnCount,
    maxTurns: session.max_turns,
  };
}

async function closeSession(sessionId: string, studentAnswers: number, costLimitReached = false): Promise<SessionStatus> {
  const status: SessionStatus = studentAnswers >= MIN_STUDENT_ANSWERS_FOR_REPORT ? 'report_pending' : 'abandoned';
  const { error } = await supabaseAdmin
    .from('embassy_sessions')
    .update({ status, ended_at: new Date().toISOString(), ...(costLimitReached && { cost_limit_reached: true }) })
    .eq('id', sessionId)
    .eq('status', 'in_progress');
  if (error) throw error;

  // Génération hors requête HTTP (§17.4) ; le balayage périodique reprend les échecs.
  if (status === 'report_pending') {
    void processReport(sessionId).catch((err: unknown) => logger.error({ err, sessionId }, 'embassy_report_unhandled'));
  }
  return status;
}

export async function endEmbassySession(studentId: string, sessionId: string) {
  const session = await loadOwnedSession(studentId, sessionId);
  if (session.status !== 'in_progress') throw new HttpError(409, 'embassy_session_closed', 'Cet entretien est déjà terminé.');
  const messages = await loadMessages(session.id);
  await closeSession(session.id, messages.filter((message) => message.speaker === 'student').length);
  return getEmbassySession(studentId, session.id);
}

// EF-58 : l'étudiant supprime la session, son transcript et son rapport.
export async function deleteEmbassySession(studentId: string, sessionId: string) {
  const session = await loadOwnedSession(studentId, sessionId);
  const { error } = await supabaseAdmin.from('embassy_sessions').delete().eq('id', session.id).eq('student_id', studentId);
  if (error) throw error;
  await recordAudit({ actorId: studentId, action: 'embassy_session.delete', entityType: 'embassy_session', entityId: session.id });
}

// ─────────────────────────────────────────────────────────────
// File de génération des rapports
// ─────────────────────────────────────────────────────────────

// §10.6 : faits clés du dernier entretien terminé, pour repérer les réponses qui changent d'une session à l'autre.
async function previousKeyFacts(session: SessionRow): Promise<KeyFacts | null> {
  if (!session.uses_profile) return null;
  const { data, error } = await supabaseAdmin
    .from('embassy_sessions')
    .select('ai_report->key_facts')
    .eq('student_id', session.student_id)
    .eq('status', 'completed')
    .neq('id', session.id)
    .lt('started_at', session.started_at)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return ((data as { key_facts: KeyFacts | null } | null)?.key_facts as KeyFacts | null) ?? null;
}

export async function processReport(sessionId: string): Promise<void> {
  const { data: current, error: loadError } = await supabaseAdmin.from('embassy_sessions').select(SESSION_COLUMNS).eq('id', sessionId).eq('status', 'report_pending').maybeSingle();
  if (loadError) throw loadError;
  if (!current) return;
  const session = current as SessionRow;
  if (session.report_claimed_at && Date.now() - Date.parse(session.report_claimed_at) < REPORT_CLAIM_TIMEOUT_MS) return;

  if (session.report_attempts >= MAX_REPORT_ATTEMPTS) {
    await supabaseAdmin.from('embassy_sessions').update({ status: 'failed', failure_reason: 'report_generation_failed' }).eq('id', session.id).eq('status', 'report_pending');
    return;
  }

  // Réservation atomique : une seule génération à la fois pour une session.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('embassy_sessions')
    .update({ report_attempts: session.report_attempts + 1, report_claimed_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'report_pending')
    .eq('report_attempts', session.report_attempts)
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  try {
    const [messages, scenario, previousFacts] = await Promise.all([loadMessages(session.id), getScenario(session.scenario_code), previousKeyFacts(session)]);
    const request = buildReportRequest(
      {
        visaType: session.visa_type,
        scenarioLabel: scenario?.label ?? null,
        profileFacts: session.uses_profile ? session.profile_snapshot : null,
        previousFacts,
      },
      messages,
    );
    const { report, usage } = await runEmbassyReport(request);
    await recordUsage(session.student_id, session.id, 'embassy_report', usage);

    const finalReport = finalizeReport(report, { promptVersion: session.prompt_version, model: usage.model, usesProfile: session.uses_profile });
    const { error } = await supabaseAdmin
      .from('embassy_sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString(), overall_score: finalReport.overall_score, ai_report: finalReport, report_claimed_at: null })
      .eq('id', session.id)
      .eq('status', 'report_pending');
    if (error) throw error;
    await notifySafely([session.student_id], {
      type: 'embassy_report_ready',
      title: 'Votre rapport d’entretien est prêt',
      link: `/etudiant/entretien/${session.id}`,
      dedupeKey: `embassy_report:${session.id}`,
      email: true,
    });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err, sessionId: session.id, attempt: session.report_attempts + 1 }, 'embassy_report_failed');
    // Libère la réservation : la prochaine passe du balayage retentera.
    await supabaseAdmin.from('embassy_sessions').update({ report_claimed_at: null }).eq('id', session.id).eq('status', 'report_pending');
  }
}

export async function sweepPendingReports(): Promise<void> {
  const { data, error } = await supabaseAdmin.from('embassy_sessions').select('id').eq('status', 'report_pending').limit(20);
  if (error) throw error;
  for (const row of data as { id: string }[]) await processReport(row.id);
}

export function startReportWorker(intervalMs = 60_000): NodeJS.Timeout {
  const tick = () => void sweepPendingReports().catch((err: unknown) => logger.error({ err }, 'embassy_report_sweep_failed'));
  tick();
  return setInterval(tick, intervalMs);
}
