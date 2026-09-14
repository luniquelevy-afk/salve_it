import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { shuffle } from './scoring.js';

export type ExerciseType = 'qcm' | 'texte_a_trous' | 'appariement';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
const GAP_PATTERN = /\[\[([^\]]+)\]\]/g;

// ─────────────────────────────────────────────────────────────
// Format de saisie enseignant
// ─────────────────────────────────────────────────────────────

const text = (max: number) => z.string().trim().min(1).max(max);

const qcmInput = z.strictObject({
  type: z.literal('qcm'),
  questions: z
    .array(
      z
        .strictObject({ text: text(1000), options: z.array(text(300)).min(2).max(6), correctIndex: z.number().int().min(0) })
        .refine((question) => question.correctIndex < question.options.length, { message: 'Bonne réponse hors des options.', path: ['correctIndex'] }),
    )
    .min(1)
    .max(30),
});

// Texte à trous : chaque trou s'écrit [[réponse]] ou [[réponse|variante acceptée]].
const gapFillInput = z.strictObject({
  type: z.literal('texte_a_trous'),
  text: text(5000).refine((value) => /\[\[[^\]]*\S[^\]]*\]\]/.test(value), 'Ajoutez au moins un trou au format [[réponse]].'),
});

const matchingInput = z.strictObject({
  type: z.literal('appariement'),
  pairs: z
    .array(z.strictObject({ left: text(200), right: text(200) }))
    .min(2)
    .max(15)
    .refine((pairs) => new Set(pairs.map((pair) => pair.left.toLowerCase())).size === pairs.length, 'Éléments de gauche en double.')
    .refine((pairs) => new Set(pairs.map((pair) => pair.right.toLowerCase())).size === pairs.length, 'Éléments de droite en double.'),
});

export const exerciseInputSchema = z.discriminatedUnion('type', [qcmInput, gapFillInput, matchingInput]);
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

// ─────────────────────────────────────────────────────────────
// Format stocké : contenu public / solution privée
// ─────────────────────────────────────────────────────────────

const qcmContent = z.object({
  questions: z.array(z.object({ id: z.string(), text: z.string(), options: z.array(z.object({ key: z.string(), text: z.string() })) })),
});
const qcmSolution = z.object({ answers: z.record(z.string(), z.string()) });

const gapFillContent = z.object({
  segments: z.array(z.discriminatedUnion('type', [z.object({ type: z.literal('text'), value: z.string() }), z.object({ type: z.literal('gap'), id: z.string() })])),
});
const gapFillSolution = z.object({ answers: z.record(z.string(), z.array(z.string()).min(1)) });

const matchingContent = z.object({
  left: z.array(z.object({ id: z.string(), text: z.string() })),
  right: z.array(z.object({ id: z.string(), text: z.string() })),
});
const matchingSolution = z.object({ pairs: z.record(z.string(), z.string()) });

export interface CompiledExercise {
  exerciseType: ExerciseType;
  content: Record<string, unknown>;
  solution: Record<string, unknown>;
}

export function compileExercise(input: ExerciseInput, random: (max: number) => number = randomInt): CompiledExercise {
  switch (input.type) {
    case 'qcm': {
      const questions = input.questions.map((question, index) => ({
        id: `q${index + 1}`,
        text: question.text,
        options: question.options.map((option, optionIndex) => ({ key: OPTION_KEYS[optionIndex]!, text: option })),
      }));
      const answers = Object.fromEntries(input.questions.map((question, index) => [`q${index + 1}`, OPTION_KEYS[question.correctIndex]!]));
      return { exerciseType: 'qcm', content: { questions }, solution: { answers } };
    }
    case 'texte_a_trous': {
      const segments: z.infer<typeof gapFillContent>['segments'] = [];
      const answers: Record<string, string[]> = {};
      let cursor = 0;
      let gapNumber = 0;
      for (const match of input.text.matchAll(GAP_PATTERN)) {
        const accepted = match[1]!.split('|').map((value) => value.trim()).filter(Boolean);
        if (accepted.length === 0) continue;
        if (match.index > cursor) segments.push({ type: 'text', value: input.text.slice(cursor, match.index) });
        gapNumber += 1;
        const id = `g${gapNumber}`;
        segments.push({ type: 'gap', id });
        answers[id] = accepted;
        cursor = match.index + match[0].length;
      }
      if (cursor < input.text.length) segments.push({ type: 'text', value: input.text.slice(cursor) });
      return { exerciseType: 'texte_a_trous', content: { segments }, solution: { answers } };
    }
    case 'appariement': {
      const left = input.pairs.map((pair, index) => ({ id: `l${index + 1}`, text: pair.left }));
      // Colonne de droite mélangée puis numérotée : ni l'ordre ni les ids ne trahissent les paires.
      const shuffled = shuffle(input.pairs.map((pair, index) => ({ pairIndex: index, text: pair.right })), random);
      const right = shuffled.map((item, index) => ({ id: `r${index + 1}`, text: item.text }));
      const pairs = Object.fromEntries(shuffled.map((item, index) => [`l${item.pairIndex + 1}`, `r${index + 1}`]));
      return { exerciseType: 'appariement', content: { left, right }, solution: { pairs } };
    }
  }
}

// Reconstruit la saisie enseignant pour l'édition.
export function toExerciseInput(type: ExerciseType, content: unknown, solution: unknown): ExerciseInput {
  switch (type) {
    case 'qcm': {
      const { questions } = qcmContent.parse(content);
      const { answers } = qcmSolution.parse(solution);
      return {
        type,
        questions: questions.map((question) => ({
          text: question.text,
          options: question.options.map((option) => option.text),
          correctIndex: Math.max(0, question.options.findIndex((option) => option.key === answers[question.id])),
        })),
      };
    }
    case 'texte_a_trous': {
      const { segments } = gapFillContent.parse(content);
      const { answers } = gapFillSolution.parse(solution);
      return {
        type,
        text: segments.map((segment) => (segment.type === 'text' ? segment.value : `[[${(answers[segment.id] ?? []).join('|')}]]`)).join(''),
      };
    }
    case 'appariement': {
      const { left, right } = matchingContent.parse(content);
      const { pairs } = matchingSolution.parse(solution);
      return {
        type,
        pairs: left.map((item) => ({ left: item.text, right: right.find((candidate) => candidate.id === pairs[item.id])?.text ?? '' })),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Correction (EF-25)
// ─────────────────────────────────────────────────────────────

export const studentAnswersSchema = z.record(z.string().max(10), z.string().max(300));

// Tolère la casse, les espaces et les variantes d'apostrophe ; les accents restent significatifs (è ≠ e).
export function normalizeAnswer(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/[’‘`´]/g, "'").toLowerCase();
}

export interface GradedItem {
  id: string;
  correct: boolean;
  given: string | null;
  expected: string;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  items: GradedItem[];
}

export function gradeExercise(type: ExerciseType, content: unknown, solution: unknown, answers: Record<string, string>): GradeResult {
  const items: GradedItem[] = [];

  if (type === 'qcm') {
    const { questions } = qcmContent.parse(content);
    const expected = qcmSolution.parse(solution).answers;
    for (const question of questions) {
      const given = answers[question.id] ?? null;
      items.push({ id: question.id, given, expected: expected[question.id] ?? '', correct: given !== null && given === expected[question.id] });
    }
  } else if (type === 'texte_a_trous') {
    const { segments } = gapFillContent.parse(content);
    const expected = gapFillSolution.parse(solution).answers;
    for (const segment of segments) {
      if (segment.type !== 'gap') continue;
      const accepted = expected[segment.id] ?? [];
      const given = answers[segment.id]?.trim() || null;
      items.push({
        id: segment.id,
        given,
        expected: accepted[0] ?? '',
        correct: given !== null && accepted.some((candidate) => normalizeAnswer(candidate) === normalizeAnswer(given)),
      });
    }
  } else {
    const { left } = matchingContent.parse(content);
    const expected = matchingSolution.parse(solution).pairs;
    for (const item of left) {
      const given = answers[item.id] ?? null;
      items.push({ id: item.id, given, expected: expected[item.id] ?? '', correct: given !== null && given === expected[item.id] });
    }
  }

  return { score: items.filter((item) => item.correct).length, maxScore: items.length, items };
}
