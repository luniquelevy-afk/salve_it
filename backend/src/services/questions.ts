import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { db } from '../lib/db/index.js';
import { AiError, isAiConfigured, runQuestionVariants, type AiUsage } from './ai.js';
import { recordAudit } from './audit.js';
import { questionSuccessStats } from './overviews.js';
import { buildVariantsRequest, finalizeVariants, QUESTION_VARIANTS_PROMPT_VERSION, type VariantSource } from './question-variants.js';

export type QuestionStatus = 'draft' | 'pending_review' | 'active' | 'archived';

export interface QuestionInput {
  category: string;
  difficulty: 1 | 2 | 3;
  questionText: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation?: string | null | undefined;
  language?: string | undefined;
}

interface QuestionRow {
  id: string;
  category: string;
  difficulty: 1 | 2 | 3;
  question_text: string;
  options: { key: string; text: string }[];
  correct_answer: string;
  explanation: string | null;
  language: string;
  source: 'manual' | 'ai_generated';
  validation_status: QuestionStatus;
  validated_by: string | null;
  created_by: string | null;
  generated_from: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

const QUESTION_COLUMNS =
  'id, category, difficulty, question_text, options, correct_answer, explanation, language, source, validation_status, validated_by, created_by, generated_from, version, created_at, updated_at';

function toQuestion(row: QuestionRow) {
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    questionText: row.question_text,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    language: row.language,
    source: row.source,
    status: row.validation_status,
    validatedBy: row.validated_by,
    createdBy: row.created_by,
    generatedFrom: row.generated_from,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listQuestions(filters: { category?: string | undefined; status?: QuestionStatus | undefined }) {
  let query = db.from('questions').select(QUESTION_COLUMNS).order('created_at', { ascending: false }).limit(500);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('validation_status', filters.status);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data as QuestionRow[];

  // EF-14 : taux de réussite par question pour repérer les questions mal calibrées.
  const stats = new Map<string, { answers_count: number; correct_count: number; avg_time_seconds: number | null }>();
  if (rows.length > 0) {
    for (const row of await questionSuccessStats(rows.map((row) => row.id))) stats.set(row.question_id, row);
  }

  // EF-07 : énoncé de la question d'origine, même quand elle n'est pas dans la liste filtrée.
  const sourceTexts = new Map<string, string>();
  const sourceIds = [...new Set(rows.map((row) => row.generated_from).filter((id): id is string => id !== null))];
  if (sourceIds.length > 0) {
    const { data: sourceRows, error: sourceError } = await db.from('questions').select('id, question_text').in('id', sourceIds);
    if (sourceError) throw sourceError;
    for (const source of sourceRows as { id: string; question_text: string }[]) sourceTexts.set(source.id, source.question_text.slice(0, 200));
  }

  return rows.map((row) => {
    const stat = stats.get(row.id);
    return {
      ...toQuestion(row),
      generatedFromText: row.generated_from ? (sourceTexts.get(row.generated_from) ?? null) : null,
      stats: stat
        ? { answers: stat.answers_count, successRate: Math.round((100 * stat.correct_count) / stat.answers_count), avgTimeSeconds: stat.avg_time_seconds }
        : null,
    };
  });
}

// Catégories utilisées par les sections de test, pour guider la saisie enseignant.
export async function listCategories(): Promise<string[]> {
  const { data, error } = await db.from('test_sections').select('category');
  if (error) throw error;
  return [...new Set((data as { category: string }[]).map((row) => row.category))].sort();
}

async function getQuestionRow(id: string): Promise<QuestionRow> {
  const { data, error } = await db.from('questions').select(QUESTION_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'question_not_found', 'Question introuvable.');
  return data as QuestionRow;
}

export async function getQuestion(id: string) {
  return toQuestion(await getQuestionRow(id));
}

export async function createQuestion(input: QuestionInput, actorId: string) {
  const { data, error } = await db
    .from('questions')
    .insert({
      category: input.category,
      difficulty: input.difficulty,
      question_text: input.questionText,
      options: input.options,
      correct_answer: input.correctAnswer,
      explanation: input.explanation ?? null,
      language: input.language ?? 'it',
      source: 'manual',
      validation_status: 'draft',
      created_by: actorId,
    })
    .select(QUESTION_COLUMNS)
    .single();
  if (error) throw error;

  const question = toQuestion(data as QuestionRow);
  await recordAudit({ actorId, action: 'question.create', entityType: 'question', entityId: question.id });
  return question;
}

export async function updateQuestion(id: string, patch: Partial<QuestionInput>, actorId: string) {
  const current = await getQuestionRow(id);
  const options = patch.options ?? current.options;
  const correctAnswer = patch.correctAnswer ?? current.correct_answer;
  if (!options.some((option) => option.key === correctAnswer)) {
    throw new HttpError(400, 'invalid_correct_answer', 'La bonne réponse doit correspondre à une des options.');
  }

  const { data, error } = await db
    .from('questions')
    .update({
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.difficulty !== undefined && { difficulty: patch.difficulty }),
      ...(patch.questionText !== undefined && { question_text: patch.questionText }),
      ...(patch.explanation !== undefined && { explanation: patch.explanation }),
      ...(patch.language !== undefined && { language: patch.language }),
      options,
      correct_answer: correctAnswer,
      // Toute modification crée une nouvelle version (CDC §19.11).
      version: current.version + 1,
    })
    .eq('id', id)
    .eq('version', current.version)
    .select(QUESTION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(409, 'question_modified', 'La question a été modifiée entre-temps. Rechargez la page.');

  await recordAudit({ actorId, action: 'question.update', entityType: 'question', entityId: id, metadata: { version: current.version + 1 } });
  return toQuestion(data as QuestionRow);
}

export async function setQuestionStatus(id: string, status: QuestionStatus, actorId: string) {
  await getQuestionRow(id);
  const { data, error } = await db
    .from('questions')
    .update({ validation_status: status, ...(status === 'active' && { validated_by: actorId }) })
    .eq('id', id)
    .select(QUESTION_COLUMNS)
    .single();
  if (error) throw error;

  await recordAudit({ actorId, action: `question.status.${status}`, entityType: 'question', entityId: id });
  return toQuestion(data as QuestionRow);
}

// ─────────────────────────────────────────────────────────────
// EF-07 : variantes générées par IA
// ─────────────────────────────────────────────────────────────

function toAiHttpError(err: unknown): unknown {
  if (!(err instanceof AiError)) return err;
  switch (err.kind) {
    case 'unavailable':
      return new HttpError(503, 'ai_unavailable', "Le service d'IA est momentanément indisponible.");
    case 'rate_limited':
      return new HttpError(503, 'ai_busy', "Le service d'IA est très sollicité. Réessayez dans quelques minutes.");
    default:
      return new HttpError(502, 'ai_error', "L'IA n'a pas pu produire de variantes. Réessayez.");
  }
}

async function recordGenerationUsage(questionId: string, usage: AiUsage) {
  // Aucun étudiant concerné : consommation rattachée à la question source via l'audit.
  const { error } = await db.from('ai_usage_logs').insert({
    student_id: null,
    session_id: null,
    operation: 'question_generation',
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cache_read_input_tokens: usage.cacheReadInputTokens,
    cache_creation_input_tokens: usage.cacheCreationInputTokens,
    estimated_cost: usage.estimatedCost,
  });
  if (error) logger.error({ err: error, questionId }, 'ai_usage_log_failed');
}

export async function generateQuestionVariants(sourceId: string, count: number, actorId: string) {
  if (!isAiConfigured()) throw new HttpError(503, 'ai_unavailable', "La génération par IA n'est pas configurée sur la plateforme.");

  const row = await getQuestionRow(sourceId);
  if (row.validation_status === 'archived') throw new HttpError(400, 'question_archived', 'Réactivez la question avant d’en générer des variantes.');

  const source: VariantSource = {
    category: row.category,
    difficulty: row.difficulty,
    questionText: row.question_text,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    language: row.language,
  };

  let generated;
  try {
    generated = await runQuestionVariants(buildVariantsRequest(source, count));
  } catch (err) {
    throw toAiHttpError(err);
  }
  await recordGenerationUsage(sourceId, generated.usage);

  let variants;
  try {
    variants = finalizeVariants(generated.output, source, count);
  } catch {
    throw new HttpError(502, 'ai_error', "L'IA n'a pas pu produire de variantes. Réessayez.");
  }
  if (variants.length === 0) throw new HttpError(502, 'ai_no_valid_variant', "Aucune variante exploitable n'a été produite. Réessayez.");

  const { data, error } = await db
    .from('questions')
    .insert(
      variants.map((variant) => ({
        category: row.category,
        difficulty: row.difficulty,
        question_text: variant.questionText,
        options: variant.options,
        correct_answer: variant.correctAnswer,
        explanation: variant.explanation,
        language: row.language,
        source: 'ai_generated',
        // Jamais « active » : un enseignant relit et valide chaque variante (EF-07).
        validation_status: 'pending_review',
        created_by: actorId,
        generated_from: row.id,
      })),
    )
    .select(QUESTION_COLUMNS);
  if (error) throw error;

  const questions = (data as QuestionRow[]).map(toQuestion);
  await recordAudit({
    actorId,
    action: 'question.generate_variants',
    entityType: 'question',
    entityId: row.id,
    metadata: { requested: count, created: questions.length, model: generated.usage.model, promptVersion: QUESTION_VARIANTS_PROMPT_VERSION },
  });
  return { questions, requested: count, rejected: count - questions.length };
}
