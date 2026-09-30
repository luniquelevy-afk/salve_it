// Gamification légère (CDC §14) : séries de jours actifs, objectif hebdomadaire,
// badges de progression. Aucun classement global public (§14). Les indicateurs sont
// dérivés de l'activité existante ; seuls les badges obtenus sont persistés.
import type { AuthContext } from '../middleware/auth.js';
import { db } from '../lib/db/index.js';
import { getStudentDocumentsSpace } from './documents.js';

const DAY_MS = 86_400_000;
export const WEEKLY_GOAL_TARGET = 3; // activités par semaine (récompense définie par le centre)

// ─────────────────────────────────────────────────────────────
// Cœur pur et testable
// ─────────────────────────────────────────────────────────────

/** Ramène un instant ISO au jour civil UTC (AAAA-MM-JJ). */
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Série de jours actifs consécutifs se terminant aujourd'hui ou hier (§14).
 * Tolérer « hier » évite de casser la série tant que la journée en cours n'est pas jouée.
 */
export function computeStreak(activityDates: string[], now: Date = new Date()): number {
  const days = new Set(activityDates.map(dayKey));
  if (days.size === 0) return 0;
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - DAY_MS).toISOString());
  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(yesterday)) cursor = yesterday;
  else return 0;

  let streak = 0;
  let time = Date.parse(`${cursor}T00:00:00.000Z`);
  while (days.has(dayKey(new Date(time).toISOString()))) {
    streak += 1;
    time -= DAY_MS;
  }
  return streak;
}

/** Nombre d'activités depuis le début de la semaine en cours (lundi, UTC). */
export function activitiesThisWeek(activityDates: string[], now: Date = new Date()): number {
  const start = startOfWeek(now).getTime();
  return activityDates.filter((iso) => Date.parse(`${dayKey(iso)}T00:00:00.000Z`) >= start).length;
}

function startOfWeek(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(d.getTime() - dow * DAY_MS);
}

export interface GamificationSignals {
  completedSimulations: number;
  maxSectionAccuracy: number; // 0..1, meilleure précision atteinte sur une section
  completedInterviews: number;
  documentsComplete: boolean;
  streakDays: number;
}

/** Codes des badges obtenus au vu des signaux d'activité (§14). */
export function earnedBadgeCodes(signals: GamificationSignals): string[] {
  const earned: string[] = [];
  if (signals.completedSimulations >= 1) earned.push('first_simulation');
  if (signals.maxSectionAccuracy >= 0.8) earned.push('section_80');
  if (signals.streakDays >= 7) earned.push('week_streak');
  if (signals.completedInterviews >= 5) earned.push('five_interviews');
  if (signals.documentsComplete) earned.push('documents_complete');
  return earned;
}

export interface BadgeCatalogueEntry {
  code: string;
  label: string;
  description: string;
}

export interface GamificationBadge extends BadgeCatalogueEntry {
  earned: boolean;
  awardedAt: string | null;
}

export interface GamificationView {
  streakDays: number;
  weeklyGoal: { target: number; done: number; reached: boolean };
  badges: GamificationBadge[];
  earnedCount: number;
  generatedAt: string;
}

/** Assemble la vue affichable à partir du catalogue, des badges déjà obtenus et des signaux. */
export function buildGamificationView(
  catalogue: BadgeCatalogueEntry[],
  awardedAt: Map<string, string>,
  signals: GamificationSignals,
  weeklyDone: number,
  now: Date = new Date(),
): GamificationView {
  const earned = new Set(earnedBadgeCodes(signals));
  const badges = catalogue.map((entry) => ({
    ...entry,
    earned: earned.has(entry.code),
    awardedAt: awardedAt.get(entry.code) ?? null,
  }));
  return {
    streakDays: signals.streakDays,
    weeklyGoal: { target: WEEKLY_GOAL_TARGET, done: weeklyDone, reached: weeklyDone >= WEEKLY_GOAL_TARGET },
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
    generatedAt: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Accès (lecture + persistance des badges nouvellement obtenus)
// ─────────────────────────────────────────────────────────────

interface SimulationRow {
  completed_at: string | null;
  total_questions: number | null;
  score_by_section: Record<string, { correct: number; total: number }> | null;
}

export async function getStudentGamification(auth: AuthContext, now: Date = new Date()): Promise<GamificationView> {
  const studentId = auth.userId;
  const since = new Date(now.getTime() - 60 * DAY_MS).toISOString(); // fenêtre suffisante pour une série de jours

  const [catalogue, awarded, simulations, interviews, exercises, documents] = await Promise.all([
    db.from('badges').select('code, label, description').eq('is_active', true).order('sort_order'),
    db.from('student_badges').select('badge_id, awarded_at, badges(code)').eq('student_id', studentId),
    db
      .from('simulations')
      .select('completed_at, total_questions, score_by_section')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .neq('mode', 'revision')
      .not('completed_at', 'is', null)
      .gte('completed_at', since)
      .limit(500),
    db
      .from('embassy_sessions')
      .select('completed_at')
      .eq('student_id', studentId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null)
      .limit(500),
    db.from('exercise_attempts').select('created_at').eq('student_id', studentId).gte('created_at', since).limit(500),
    getStudentDocumentsSpace(studentId),
  ]);
  if (catalogue.error) throw catalogue.error;
  if (awarded.error) throw awarded.error;
  if (simulations.error) throw simulations.error;
  if (interviews.error) throw interviews.error;
  if (exercises.error) throw exercises.error;

  const simRows = (simulations.data ?? []) as SimulationRow[];
  const maxSectionAccuracy = simRows.reduce((max, row) => {
    if (!row.score_by_section) return max;
    for (const section of Object.values(row.score_by_section)) {
      if (section.total > 0) max = Math.max(max, section.correct / section.total);
    }
    return max;
  }, 0);

  const activityDates = [
    ...simRows.map((r) => r.completed_at!),
    ...((interviews.data ?? []) as { completed_at: string }[]).map((r) => r.completed_at),
    ...((exercises.data ?? []) as { created_at: string }[]).map((r) => r.created_at),
  ];

  const checklist = documents.checklist.items;
  const requiredDocs = checklist.filter((item) => item.documentType);
  const documentsComplete = requiredDocs.length > 0 && requiredDocs.every((item) => item.status === 'validated');

  const signals: GamificationSignals = {
    completedSimulations: simRows.length,
    maxSectionAccuracy,
    completedInterviews: (interviews.data ?? []).length,
    documentsComplete,
    streakDays: computeStreak(activityDates, now),
  };

  const awardedAt = new Map<string, string>();
  for (const row of (awarded.data ?? []) as unknown as { awarded_at: string; badges: { code: string } | null }[]) {
    if (row.badges?.code) awardedAt.set(row.badges.code, row.awarded_at);
  }

  await persistNewlyEarned(studentId, earnedBadgeCodes(signals), awardedAt, now);

  return buildGamificationView(
    (catalogue.data ?? []) as BadgeCatalogueEntry[],
    awardedAt,
    signals,
    activitiesThisWeek(activityDates, now),
    now,
  );
}

/** Insère les badges franchis pour la première fois (idempotent). Met à jour la map en mémoire. */
async function persistNewlyEarned(
  studentId: string,
  earnedCodes: string[],
  awardedAt: Map<string, string>,
  now: Date,
): Promise<void> {
  const toAward = earnedCodes.filter((code) => !awardedAt.has(code));
  if (toAward.length === 0) return;

  const { data: ids, error } = await db.from('badges').select('id, code').in('code', toAward);
  if (error) throw error;

  const awardedIso = now.toISOString();
  const rows = ((ids ?? []) as { id: string; code: string }[]).map((b) => ({
    student_id: studentId,
    badge_id: b.id,
    awarded_at: awardedIso,
  }));
  if (rows.length === 0) return;

  const { error: insertError } = await db
    .from('student_badges')
    .upsert(rows, { onConflict: 'student_id,badge_id', ignoreDuplicates: true });
  if (insertError) throw insertError;

  for (const b of (ids ?? []) as { id: string; code: string }[]) awardedAt.set(b.code, awardedIso);
}
