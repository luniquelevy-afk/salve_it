// Limites d'usage de l'IA (EF-22, EF-59, ENF-07) : configuration serveur < réglages admin < exception par étudiant.
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import { activeModel, activeProviderName } from './ai.js';
import { recordAudit } from './audit.js';

export interface LimitValues {
  maxTurns: number;
  weeklySessionLimit: number;
  monthlyCostLimitUsd: number;
  sessionCostLimitUsd: number;
}

type Nullable<T> = { [K in keyof T]?: T[K] | null };

export interface EffectiveLimits extends LimitValues {
  sources: Record<keyof LimitValues, 'serveur' | 'centre' | 'etudiant'>;
}

export function mergeLimits(defaults: LimitValues, settings: Nullable<LimitValues>, student: Nullable<Pick<LimitValues, 'weeklySessionLimit' | 'monthlyCostLimitUsd'>> | null): EffectiveLimits {
  const studentValues: Nullable<LimitValues> = student ?? {};
  const pick = (key: keyof LimitValues) => {
    const studentValue = key === 'weeklySessionLimit' || key === 'monthlyCostLimitUsd' ? studentValues[key] : undefined;
    if (studentValue !== undefined && studentValue !== null) return { value: studentValue, source: 'etudiant' as const };
    const settingValue = settings[key];
    if (settingValue !== undefined && settingValue !== null) return { value: settingValue, source: 'centre' as const };
    return { value: defaults[key], source: 'serveur' as const };
  };
  const keys = ['maxTurns', 'weeklySessionLimit', 'monthlyCostLimitUsd', 'sessionCostLimitUsd'] as const;
  const picked = Object.fromEntries(keys.map((key) => [key, pick(key)])) as Record<keyof LimitValues, { value: number; source: 'serveur' | 'centre' | 'etudiant' }>;
  return {
    maxTurns: picked.maxTurns.value,
    weeklySessionLimit: picked.weeklySessionLimit.value,
    monthlyCostLimitUsd: picked.monthlyCostLimitUsd.value,
    sessionCostLimitUsd: picked.sessionCostLimitUsd.value,
    sources: Object.fromEntries(keys.map((key) => [key, picked[key].source])) as EffectiveLimits['sources'],
  };
}

export function serverDefaults(): LimitValues {
  return {
    maxTurns: env.EMBASSY_MAX_TURNS,
    weeklySessionLimit: env.EMBASSY_WEEKLY_SESSION_LIMIT,
    monthlyCostLimitUsd: env.EMBASSY_MONTHLY_COST_LIMIT_USD,
    sessionCostLimitUsd: env.EMBASSY_SESSION_COST_LIMIT_USD,
  };
}

interface SettingsRow {
  max_turns: number | null;
  weekly_session_limit: number | null;
  monthly_cost_limit_usd: number | string | null;
  session_cost_limit_usd: number | string | null;
  updated_at: string;
}

const toNumber = (value: number | string | null) => (value === null ? null : Number(value));

function settingsValues(row: SettingsRow): Nullable<LimitValues> {
  return {
    maxTurns: row.max_turns,
    weeklySessionLimit: row.weekly_session_limit,
    monthlyCostLimitUsd: toNumber(row.monthly_cost_limit_usd),
    sessionCostLimitUsd: toNumber(row.session_cost_limit_usd),
  };
}

async function loadSettings(): Promise<SettingsRow> {
  const { data, error } = await db.from('ai_settings').select('max_turns, weekly_session_limit, monthly_cost_limit_usd, session_cost_limit_usd, updated_at').eq('id', true).single();
  if (error) throw error;
  return data as SettingsRow;
}

export async function getEffectiveLimits(studentId: string): Promise<EffectiveLimits> {
  const [settings, studentResult] = await Promise.all([
    loadSettings(),
    db.from('student_ai_limits').select('weekly_session_limit, monthly_cost_limit_usd').eq('student_id', studentId).maybeSingle(),
  ]);
  if (studentResult.error) throw studentResult.error;
  const student = studentResult.data as { weekly_session_limit: number | null; monthly_cost_limit_usd: number | string | null } | null;
  return mergeLimits(
    serverDefaults(),
    settingsValues(settings),
    student ? { weeklySessionLimit: student.weekly_session_limit, monthlyCostLimitUsd: toNumber(student.monthly_cost_limit_usd) } : null,
  );
}

export async function getAiSettings() {
  const settings = await loadSettings();
  const values = settingsValues(settings);
  const provider = activeProviderName();
  return {
    provider,
    model: activeModel(),
    // Palier gratuit Gemini et agent factice : coûts estimés nuls, les plafonds de coût n'agissent pas.
    costTracked: provider === 'claude' || (provider === 'gemini' && env.GEMINI_PAID_TIER && (env.GEMINI_INPUT_PRICE_PER_MTOK > 0 || env.GEMINI_OUTPUT_PRICE_PER_MTOK > 0)),
    defaults: serverDefaults(),
    settings: values,
    effective: mergeLimits(serverDefaults(), values, null),
    updatedAt: settings.updated_at,
  };
}

export async function updateAiSettings(actorId: string, input: Nullable<LimitValues>) {
  const { error } = await db
    .from('ai_settings')
    .update({
      max_turns: input.maxTurns ?? null,
      weekly_session_limit: input.weeklySessionLimit ?? null,
      monthly_cost_limit_usd: input.monthlyCostLimitUsd ?? null,
      session_cost_limit_usd: input.sessionCostLimitUsd ?? null,
      updated_by: actorId,
    })
    .eq('id', true);
  if (error) throw error;
  await recordAudit({ actorId, action: 'ai_settings.update', entityType: 'ai_settings', metadata: { ...input } });
  return getAiSettings();
}

const startOfMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

// Suivi de consommation par étudiant (ENF-07) pour repérer les abus et ajuster les quotas.
export async function listStudentAiUsage() {
  const monthStart = startOfMonth();
  const weekStart = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [students, usage, sessions, overrides, settings] = await Promise.all([
    db.from('profiles').select('id, full_name, level').eq('role', 'student').eq('status', 'active').order('full_name'),
    db.from('ai_usage_logs').select('student_id, estimated_cost').gte('created_at', monthStart).not('student_id', 'is', null),
    db.from('embassy_sessions').select('student_id, started_at, status, cost_limit_reached').gte('started_at', monthStart),
    db.from('student_ai_limits').select('student_id, weekly_session_limit, monthly_cost_limit_usd, note'),
    loadSettings(),
  ]);
  for (const result of [students, usage, sessions, overrides]) if (result.error) throw result.error;

  const cost = new Map<string, number>();
  for (const row of usage.data as { student_id: string; estimated_cost: number | string }[]) cost.set(row.student_id, (cost.get(row.student_id) ?? 0) + Number(row.estimated_cost));
  const overrideMap = new Map((overrides.data as { student_id: string; weekly_session_limit: number | null; monthly_cost_limit_usd: number | string | null; note: string | null }[]).map((row) => [row.student_id, row]));

  return (students.data as { id: string; full_name: string; level: string | null }[]).map((student) => {
    const studentSessions = (sessions.data as { student_id: string; started_at: string; status: string; cost_limit_reached: boolean }[]).filter((row) => row.student_id === student.id);
    const override = overrideMap.get(student.id) ?? null;
    const effective = mergeLimits(
      serverDefaults(),
      settingsValues(settings),
      override ? { weeklySessionLimit: override.weekly_session_limit, monthlyCostLimitUsd: toNumber(override.monthly_cost_limit_usd) } : null,
    );
    const monthCost = Math.round((cost.get(student.id) ?? 0) * 10_000) / 10_000;
    return {
      studentId: student.id,
      fullName: student.full_name,
      level: student.level,
      monthCostUsd: monthCost,
      monthSessions: studentSessions.length,
      weekSessions: studentSessions.filter((row) => row.started_at >= weekStart && row.status !== 'failed').length,
      costLimitHits: studentSessions.filter((row) => row.cost_limit_reached).length,
      override: override ? { weeklySessionLimit: override.weekly_session_limit, monthlyCostLimitUsd: toNumber(override.monthly_cost_limit_usd), note: override.note } : null,
      effective,
      budgetUsedPercent: effective.monthlyCostLimitUsd > 0 ? Math.min(100, Math.round((100 * monthCost) / effective.monthlyCostLimitUsd)) : null,
    };
  });
}

export async function setStudentAiLimits(actorId: string, studentId: string, input: { weeklySessionLimit: number | null; monthlyCostLimitUsd: number | null; note?: string | null | undefined }) {
  const { data: student, error: studentError } = await db.from('profiles').select('role').eq('id', studentId).maybeSingle();
  if (studentError) throw studentError;
  if (student?.role !== 'student') throw new HttpError(404, 'student_not_found', 'Étudiant introuvable.');

  if (input.weeklySessionLimit === null && input.monthlyCostLimitUsd === null) {
    const { error } = await db.from('student_ai_limits').delete().eq('student_id', studentId);
    if (error) throw error;
  } else {
    const { error } = await db.from('student_ai_limits').upsert(
      {
        student_id: studentId,
        weekly_session_limit: input.weeklySessionLimit,
        monthly_cost_limit_usd: input.monthlyCostLimitUsd,
        note: input.note || null,
        updated_by: actorId,
      },
      { onConflict: 'student_id' },
    );
    if (error) throw error;
  }
  await recordAudit({ actorId, action: 'student_ai_limits.set', entityType: 'profile', entityId: studentId, metadata: { weeklySessionLimit: input.weeklySessionLimit, monthlyCostLimitUsd: input.monthlyCostLimitUsd } });
  return getEffectiveLimits(studentId);
}
