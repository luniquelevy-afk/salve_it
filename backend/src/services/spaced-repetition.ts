// Révision espacée (CDC §8.1, EF-51) : intervalle doublé à chaque bonne réponse, remis à zéro sur erreur.
const DAY_MS = 86_400_000;
export const MAX_INTERVAL_DAYS = 60;

export interface QuestionStat {
  attemptsCount: number;
  correctCount: number;
  masteryScore: number;
  intervalDays: number;
  lastCorrect: boolean | null;
  lastAnsweredAt: string | null;
  nextReviewAt: string;
}

export function nextReviewState(previous: QuestionStat | null, correct: boolean, now: Date = new Date()): QuestionStat {
  const intervalDays = correct ? Math.min(MAX_INTERVAL_DAYS, Math.max(1, (previous?.intervalDays ?? 0) * 2)) : 0;
  return {
    attemptsCount: (previous?.attemptsCount ?? 0) + 1,
    correctCount: (previous?.correctCount ?? 0) + (correct ? 1 : 0),
    // Moyenne mobile : les réponses récentes pèsent davantage que l'historique.
    masteryScore: Math.round(((previous?.masteryScore ?? 0) * 0.6 + (correct ? 0.4 : 0)) * 1000) / 1000,
    intervalDays,
    lastCorrect: correct,
    lastAnsweredAt: now.toISOString(),
    // Une erreur rend la question immédiatement disponible en révision.
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString(),
  };
}

// Priorité (§8.1) : taux d'erreur, ancienneté du retard, poids de la compétence dans le test visé.
export function reviewPriority(stat: Pick<QuestionStat, 'attemptsCount' | 'correctCount' | 'nextReviewAt'>, now: Date, sectionWeight = 0): number {
  const errorRate = stat.attemptsCount > 0 ? 1 - stat.correctCount / stat.attemptsCount : 1;
  const overdueDays = Math.max(0, (now.getTime() - Date.parse(stat.nextReviewAt)) / DAY_MS);
  return 0.5 * errorRate + 0.3 * Math.min(1, overdueDays / 14) + 0.2 * Math.min(1, Math.max(0, sectionWeight));
}
