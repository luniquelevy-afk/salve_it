import { HttpError } from '../lib/http-error.js';
import { db } from '../lib/db/index.js';
import { CEFR_LEVELS, type CefrLevel } from './access.js';
import { createLead } from './leads.js';

// Seuil de réussite d'un niveau pour le considérer comme acquis.
export const LEVEL_PASS_RATIO = 0.6;

interface LevelQuestionRow {
  id: string;
  level: CefrLevel;
  question_text: string;
  options: { key: string; text: string }[];
  correct_answer: string;
  order_index: number;
}

export interface LevelTally {
  correct: number;
  total: number;
}

// Niveau estimé = le plus haut niveau atteint sans lacune sur les niveaux inférieurs ; null = débutant.
export function estimateLevel(byLevel: Partial<Record<CefrLevel, LevelTally>>): CefrLevel | null {
  let estimated: CefrLevel | null = null;
  for (const level of CEFR_LEVELS) {
    const tally = byLevel[level];
    if (!tally || tally.total === 0) continue;
    if (tally.correct / tally.total < LEVEL_PASS_RATIO) break;
    estimated = level;
  }
  return estimated;
}

async function loadQuestions(): Promise<LevelQuestionRow[]> {
  const { data, error } = await db
    .from('level_test_questions')
    .select('id, level, question_text, options, correct_answer, order_index')
    .eq('is_active', true)
    .order('order_index');
  if (error) throw error;
  return data as LevelQuestionRow[];
}

// Public, sans compte (EF-27) : jamais de bonne réponse dans la réponse.
export async function getLevelTest() {
  const questions = await loadQuestions();
  return {
    questions: questions.map((question) => ({ id: question.id, text: question.question_text, options: question.options })),
  };
}

export interface LevelTestContact {
  fullName: string;
  email?: string | undefined;
  phone?: string | undefined;
  desiredProgram?: string | undefined;
}

export async function submitLevelTest(answers: Record<string, string>, contact: LevelTestContact | null) {
  const questions = await loadQuestions();
  if (questions.length === 0) throw new HttpError(503, 'level_test_unavailable', 'Le test de niveau est momentanément indisponible.');

  const byLevel: Partial<Record<CefrLevel, LevelTally>> = {};
  let score = 0;
  for (const question of questions) {
    const tally = (byLevel[question.level] ??= { correct: 0, total: 0 });
    tally.total += 1;
    if (answers[question.id] === question.correct_answer) {
      tally.correct += 1;
      score += 1;
    }
  }
  const estimatedLevel = estimateLevel(byLevel);

  const { error } = await db.from('level_test_attempts').insert({
    answers,
    score,
    total: questions.length,
    estimated_level: estimatedLevel,
    contact_consent: contact !== null,
    full_name: contact?.fullName ?? null,
    email: contact?.email || null,
    phone: contact?.phone || null,
    desired_program: contact?.desiredProgram || null,
  });
  if (error) throw error;

  // EF-27 / EF-60 : une demande de contact devient un prospect à suivre.
  if (contact) {
    await createLead({
      fullName: contact.fullName,
      phone: contact.phone,
      email: contact.email,
      desiredProgram: contact.desiredProgram,
      levelEstimate: estimatedLevel,
      source: 'level_test',
    });
  }

  return { score, total: questions.length, estimatedLevel, byLevel, contactSaved: contact !== null };
}

// Prospects issus du test (admin) — préfigure le CRM de la V1.2.
export async function listLevelTestAttempts() {
  const { data, error } = await db
    .from('level_test_attempts')
    .select('id, score, total, estimated_level, full_name, email, phone, desired_program, contact_consent, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    score: row.score as number,
    total: row.total as number,
    estimatedLevel: row.estimated_level as CefrLevel | null,
    fullName: row.full_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    desiredProgram: row.desired_program as string | null,
    contactConsent: row.contact_consent as boolean,
    createdAt: row.created_at as string,
  }));
}
