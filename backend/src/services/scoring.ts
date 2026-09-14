import { randomInt } from 'node:crypto';
import { z } from 'zod';

export const scoringRulesSchema = z.object({
  correct: z.number(),
  wrong: z.number(),
  blank: z.number(),
});

export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export interface GradedAnswer {
  sectionKey: string;
  sectionName: string;
  answerGiven: string | null;
  isCorrect: boolean;
}

export interface Tally {
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  points: number;
}

export interface SectionTally extends Tally {
  name: string;
}

export interface ScoreResult extends Tally {
  bySection: Record<string, SectionTally>;
}

const emptyTally = (): Tally => ({ correct: 0, wrong: 0, blank: 0, total: 0, points: 0 });
const round2 = (value: number) => Math.round(value * 100) / 100;

function add(tally: Tally, answer: GradedAnswer, rules: ScoringRules) {
  tally.total += 1;
  if (answer.answerGiven === null) {
    tally.blank += 1;
    tally.points += rules.blank;
  } else if (answer.isCorrect) {
    tally.correct += 1;
    tally.points += rules.correct;
  } else {
    tally.wrong += 1;
    tally.points += rules.wrong;
  }
}

// Barème du modèle de test : points par bonne / mauvaise / absence de réponse (CDC §7).
// Une question sans réponse n'est jamais comptée juste (EF-10) et rapporte `rules.blank`.
export function scoreAnswers(answers: GradedAnswer[], rules: ScoringRules): ScoreResult {
  const result: ScoreResult = { ...emptyTally(), bySection: {} };

  for (const answer of answers) {
    add(result, answer, rules);
    const section = (result.bySection[answer.sectionKey] ??= { ...emptyTally(), name: answer.sectionName });
    add(section, answer, rules);
  }

  result.points = round2(result.points);
  for (const section of Object.values(result.bySection)) section.points = round2(section.points);
  return result;
}

// Fisher–Yates avec un aléa cryptographique : l'ordre de tirage n'est pas prévisible.
export function shuffle<T>(items: readonly T[], random: (max: number) => number = randomInt): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
