import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { scoreAnswers, scoringRulesSchema, shuffle, type ScoringRules, type SectionTally } from './scoring.js';
import { nextReviewState, reviewPriority, type QuestionStat } from './spaced-repetition.js';

export type SimulationMode = 'entrainement' | 'examen' | 'revision' | 'defi';

// Correction immédiate en entraînement et en révision ; aucune avant la fin en examen et en défi (CDC §8).
const FEEDBACK_MODES = new Set<SimulationMode>(['entrainement', 'revision']);

// Tolérance réseau sur l'échéance : une réponse envoyée juste avant la fin reste acceptée.
const DEADLINE_GRACE_MS = 2_000;

export const REVIEW_BATCH_SIZE = 10;
const REVIEW_SECONDS_PER_QUESTION = 180;
export const CHALLENGE_SIZE = 5;
export const CHALLENGE_DURATION_SECONDS = 5 * 60;
export const CHALLENGE_TARGET = 4;
const REVISION_RULES: ScoringRules = { correct: 1, wrong: 0, blank: 0 };
export const REVISION_TEMPLATE = { name: 'Révision de mes erreurs', code: 'REVISION' };

const optionsSchema = z.array(z.object({ key: z.string(), text: z.string() }));

interface SimulationRow {
  id: string;
  student_id: string;
  test_template_id: string | null;
  mode: SimulationMode;
  status: 'in_progress' | 'completed' | 'abandoned';
  started_at: string;
  deadline_at: string;
  completed_at: string | null;
  total_questions: number;
  current_position: number;
  score: number | null;
  score_by_section: Record<string, SectionTally> | null;
}

const SIMULATION_COLUMNS =
  'id, student_id, test_template_id, mode, status, started_at, deadline_at, completed_at, total_questions, current_position, score, score_by_section';

interface DrawnQuestion {
  position: number;
  questionId: string;
  sectionKey: string;
  sectionName: string;
  category: string;
  text: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation: string | null;
}

interface DrawnQuestionRow {
  position: number;
  question_id: string;
  section_id: string | null;
  test_sections: { name: string } | null;
  questions: { question_text: string; options: unknown; correct_answer: string; explanation: string | null; category: string };
}

const DRAWN_QUESTION_COLUMNS =
  'position, question_id, section_id, test_sections(name), questions(question_text, options, correct_answer, explanation, category)';

const categoryLabel = (category: string) => category.charAt(0).toUpperCase() + category.slice(1);

// Sans section (révision), les résultats sont regroupés par catégorie de question.
function sectionOf(sectionId: string | null, sectionName: string | undefined, category: string) {
  return sectionId ? { key: sectionId, name: sectionName ?? categoryLabel(category) } : { key: `categorie:${category}`, name: categoryLabel(category) };
}

function toDrawnQuestion(row: DrawnQuestionRow): DrawnQuestion {
  const section = sectionOf(row.section_id, row.test_sections?.name, row.questions.category);
  return {
    position: row.position,
    questionId: row.question_id,
    sectionKey: section.key,
    sectionName: section.name,
    category: row.questions.category,
    text: row.questions.question_text,
    options: optionsSchema.parse(row.questions.options),
    correctAnswer: row.questions.correct_answer,
    explanation: row.questions.explanation,
  };
}

// ─────────────────────────────────────────────────────────────
// Modèles de test
// ─────────────────────────────────────────────────────────────

interface TemplateSection {
  id: string;
  name: string;
  category: string;
  question_count: number;
  order_index: number;
}

interface TemplateRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: number;
  is_active: boolean;
  total_duration_seconds: number;
  test_sections: TemplateSection[];
}

export async function listActiveTemplates() {
  const { data, error } = await supabaseAdmin
    .from('test_templates')
    .select('id, code, name, description, version, is_active, total_duration_seconds, test_sections(id, name, category, question_count, order_index)')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;

  return (data as unknown as TemplateRow[]).map((template) => {
    const sections = [...template.test_sections]
      .sort((a, b) => a.order_index - b.order_index)
      .map((section) => ({ id: section.id, name: section.name, category: section.category, questionCount: section.question_count }));
    return {
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description,
      totalDurationSeconds: template.total_duration_seconds,
      totalQuestions: sections.reduce((sum, section) => sum + section.questionCount, 0),
      sections,
    };
  });
}

async function loadActiveTemplate(templateId: string): Promise<TemplateRow> {
  const { data, error } = await supabaseAdmin
    .from('test_templates')
    .select('id, code, name, description, version, is_active, total_duration_seconds, test_sections(id, name, category, question_count, order_index)')
    .eq('id', templateId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.is_active) throw new HttpError(404, 'template_not_found', 'Modèle de test introuvable.');
  const template = data as unknown as TemplateRow;
  template.test_sections.sort((a, b) => a.order_index - b.order_index);
  return template;
}

// ─────────────────────────────────────────────────────────────
// Statistiques par étudiant et révision (EF-50, EF-51)
// ─────────────────────────────────────────────────────────────

interface StatRow {
  question_id: string;
  attempts_count: number;
  correct_count: number;
  mastery_score: number | string;
  interval_days: number;
  last_correct: boolean | null;
  last_answered_at: string | null;
  next_review_at: string;
}

const STAT_COLUMNS = 'question_id, attempts_count, correct_count, mastery_score, interval_days, last_correct, last_answered_at, next_review_at';

function toStat(row: StatRow): QuestionStat {
  return {
    attemptsCount: row.attempts_count,
    correctCount: row.correct_count,
    masteryScore: Number(row.mastery_score),
    intervalDays: row.interval_days,
    lastCorrect: row.last_correct,
    lastAnsweredAt: row.last_answered_at,
    nextReviewAt: row.next_review_at,
  };
}

export async function updateQuestionStats(studentId: string, results: { questionId: string; correct: boolean }[], now = new Date()) {
  if (results.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from('student_question_stats')
    .select(STAT_COLUMNS)
    .eq('student_id', studentId)
    .in('question_id', results.map((result) => result.questionId));
  if (error) throw error;

  const previous = new Map((data as StatRow[]).map((row) => [row.question_id, toStat(row)]));
  const rows = results.map((result) => {
    const next = nextReviewState(previous.get(result.questionId) ?? null, result.correct, now);
    return {
      student_id: studentId,
      question_id: result.questionId,
      attempts_count: next.attemptsCount,
      correct_count: next.correctCount,
      mastery_score: next.masteryScore,
      interval_days: next.intervalDays,
      last_correct: next.lastCorrect,
      last_answered_at: next.lastAnsweredAt,
      next_review_at: next.nextReviewAt,
    };
  });
  const { error: upsertError } = await supabaseAdmin.from('student_question_stats').upsert(rows, { onConflict: 'student_id,question_id' });
  if (upsertError) throw upsertError;
}

interface TrackedQuestion extends QuestionStat {
  questionId: string;
  category: string;
}

async function loadTrackedQuestions(studentId: string): Promise<TrackedQuestion[]> {
  const { data, error } = await supabaseAdmin
    .from('student_question_stats')
    .select(`${STAT_COLUMNS}, questions!inner(category, validation_status)`)
    .eq('student_id', studentId)
    .eq('questions.validation_status', 'active');
  if (error) throw error;
  return (data as unknown as (StatRow & { questions: { category: string } })[]).map((row) => ({
    ...toStat(row),
    questionId: row.question_id,
    category: row.questions.category,
  }));
}

// Poids de chaque catégorie dans le test visé par l'étudiant (profil).
async function targetCategoryWeights(studentId: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from('student_profiles')
    .select('test_templates(test_sections(category, question_count))')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  const sections = (data as unknown as { test_templates: { test_sections: { category: string; question_count: number }[] } | null } | null)?.test_templates?.test_sections ?? [];
  const total = sections.reduce((sum, section) => sum + section.question_count, 0);
  const weights = new Map<string, number>();
  for (const section of sections) weights.set(section.category, (weights.get(section.category) ?? 0) + (total ? section.question_count / total : 0));
  return weights;
}

export async function getReviewSummary(studentId: string, now = new Date()) {
  const tracked = await loadTrackedQuestions(studentId);
  const due = tracked.filter((stat) => Date.parse(stat.nextReviewAt) <= now.getTime());
  const upcoming = tracked
    .filter((stat) => Date.parse(stat.nextReviewAt) > now.getTime())
    .map((stat) => stat.nextReviewAt)
    .sort()[0];

  const byCategory = new Map<string, { attempts: number; correct: number; tracked: number; mastery: number }>();
  for (const stat of tracked) {
    const entry = byCategory.get(stat.category) ?? { attempts: 0, correct: 0, tracked: 0, mastery: 0 };
    entry.attempts += stat.attemptsCount;
    entry.correct += stat.correctCount;
    entry.tracked += 1;
    entry.mastery += stat.masteryScore;
    byCategory.set(stat.category, entry);
  }

  const categories = [...byCategory.entries()]
    .map(([category, entry]) => ({
      category,
      attempts: entry.attempts,
      accuracy: Math.round((100 * entry.correct) / entry.attempts),
      mastery: Math.round((100 * entry.mastery) / entry.tracked),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  return {
    dueCount: due.length,
    trackedCount: tracked.length,
    retryableCount: tracked.filter((stat) => stat.lastCorrect === false).length,
    nextReviewAt: upcoming ?? null,
    categories,
    weakCategories: categories.filter((category) => category.attempts >= 3 && category.accuracy < 60),
  };
}

// ─────────────────────────────────────────────────────────────
// Tirage des questions selon le mode
// ─────────────────────────────────────────────────────────────

interface DrawPlan {
  templateId: string | null;
  templateVersion: number | null;
  durationSeconds: number;
  draw: { questionId: string; sectionId: string | null }[];
}

async function activeQuestionIds(categories: string[]): Promise<{ id: string; category: string }[]> {
  const { data, error } = await supabaseAdmin.from('questions').select('id, category').in('category', categories).eq('validation_status', 'active');
  if (error) throw error;
  return data as { id: string; category: string }[];
}

// Examen / entraînement : tirage aléatoire par section, sans doublon (EF-09).
async function planFullTest(template: TemplateRow): Promise<DrawPlan> {
  const pool = await activeQuestionIds([...new Set(template.test_sections.map((section) => section.category))]);
  const used = new Set<string>();
  const draw: DrawPlan['draw'] = [];
  for (const section of template.test_sections) {
    const candidates = shuffle(pool.filter((question) => question.category === section.category && !used.has(question.id)));
    if (candidates.length < section.question_count) {
      throw new HttpError(422, 'not_enough_questions', `Pas assez de questions actives pour la section « ${section.name} ».`);
    }
    for (const question of candidates.slice(0, section.question_count)) {
      used.add(question.id);
      draw.push({ questionId: question.id, sectionId: section.id });
    }
  }
  return { templateId: template.id, templateVersion: template.version, durationSeconds: template.total_duration_seconds, draw };
}

// Défi : série courte tirée dans les catégories du modèle (§8).
async function planChallenge(template: TemplateRow): Promise<DrawPlan> {
  const sectionByCategory = new Map(template.test_sections.map((section) => [section.category, section.id]));
  const pool = shuffle(await activeQuestionIds([...sectionByCategory.keys()]));
  if (pool.length < CHALLENGE_SIZE) {
    throw new HttpError(422, 'not_enough_questions', 'Pas assez de questions actives pour lancer un défi sur ce modèle.');
  }
  return {
    templateId: template.id,
    templateVersion: template.version,
    durationSeconds: CHALLENGE_DURATION_SECONDS,
    draw: pool.slice(0, CHALLENGE_SIZE).map((question) => ({ questionId: question.id, sectionId: sectionByCategory.get(question.category) ?? null })),
  };
}

// Révision : questions arrivées à échéance, sinon dernières erreurs, par ordre de priorité.
async function planRevision(studentId: string, now = new Date()): Promise<DrawPlan> {
  const [tracked, weights] = await Promise.all([loadTrackedQuestions(studentId), targetCategoryWeights(studentId)]);
  if (tracked.length === 0) {
    throw new HttpError(422, 'nothing_to_review', 'Aucune question à réviser : passez d’abord une simulation.');
  }
  const due = tracked.filter((stat) => Date.parse(stat.nextReviewAt) <= now.getTime());
  const pool = due.length > 0 ? due : tracked.filter((stat) => stat.lastCorrect === false);
  if (pool.length === 0) {
    throw new HttpError(422, 'nothing_to_review', 'Rien à réviser pour le moment : toutes vos questions sont maîtrisées. Revenez plus tard.');
  }

  const selected = pool
    .map((stat) => ({ stat, priority: reviewPriority(stat, now, weights.get(stat.category) ?? 0) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, REVIEW_BATCH_SIZE);

  return {
    templateId: null,
    templateVersion: null,
    durationSeconds: selected.length * REVIEW_SECONDS_PER_QUESTION,
    draw: shuffle(selected.map(({ stat }) => ({ questionId: stat.questionId, sectionId: null }))),
  };
}

// ─────────────────────────────────────────────────────────────
// Cycle de vie d'une simulation
// ─────────────────────────────────────────────────────────────

async function loadOwnedSimulation(studentId: string, simulationId: string): Promise<SimulationRow> {
  const { data, error } = await supabaseAdmin
    .from('simulations')
    .select(SIMULATION_COLUMNS)
    .eq('id', simulationId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'simulation_not_found', 'Simulation introuvable.');
  return data as SimulationRow;
}

async function loadQuestionAt(simulationId: string, position: number): Promise<DrawnQuestion> {
  const { data, error } = await supabaseAdmin
    .from('simulation_questions')
    .select(DRAWN_QUESTION_COLUMNS)
    .eq('simulation_id', simulationId)
    .eq('position', position)
    .single();
  if (error) throw error;
  return toDrawnQuestion(data as unknown as DrawnQuestionRow);
}

async function scoringRulesFor(simulation: SimulationRow): Promise<ScoringRules> {
  if (!simulation.test_template_id) return REVISION_RULES;
  const { data, error } = await supabaseAdmin.from('test_templates').select('scoring_rules').eq('id', simulation.test_template_id).single();
  if (error) throw error;
  return scoringRulesSchema.parse(data.scoring_rules);
}

function isExpired(simulation: SimulationRow, graceMs = 0): boolean {
  return Date.now() > Date.parse(simulation.deadline_at) + graceMs;
}

// Clôt la simulation : réponses manquantes enregistrées à blanc (EF-10), score calculé serveur.
async function finalize(simulation: SimulationRow): Promise<SimulationRow> {
  const [drawnResult, answersResult, rules] = await Promise.all([
    supabaseAdmin.from('simulation_questions').select('position, question_id, section_id, test_sections(name), questions(category)').eq('simulation_id', simulation.id),
    supabaseAdmin.from('simulation_answers').select('position, answer_given, is_correct').eq('simulation_id', simulation.id),
    scoringRulesFor(simulation),
  ]);
  if (drawnResult.error) throw drawnResult.error;
  if (answersResult.error) throw answersResult.error;

  const drawn = drawnResult.data as unknown as {
    position: number;
    question_id: string;
    section_id: string | null;
    test_sections: { name: string } | null;
    questions: { category: string };
  }[];
  const answers = new Map(
    (answersResult.data as { position: number; answer_given: string | null; is_correct: boolean }[]).map((answer) => [answer.position, answer]),
  );

  const missing = drawn.filter((question) => !answers.has(question.position));
  if (missing.length > 0) {
    const { error } = await supabaseAdmin.from('simulation_answers').upsert(
      missing.map((question) => ({
        simulation_id: simulation.id,
        position: question.position,
        question_id: question.question_id,
        answer_given: null,
        is_correct: false,
        time_spent_seconds: 0,
      })),
      { onConflict: 'simulation_id,position', ignoreDuplicates: true },
    );
    if (error) throw error;
  }

  const result = scoreAnswers(
    drawn.map((question) => {
      const answer = answers.get(question.position);
      const section = sectionOf(question.section_id, question.test_sections?.name, question.questions.category);
      return {
        sectionKey: section.key,
        sectionName: section.name,
        answerGiven: answer?.answer_given ?? null,
        isCorrect: answer?.is_correct ?? false,
      };
    }),
    rules,
  );

  const { data, error } = await supabaseAdmin
    .from('simulations')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      current_position: simulation.total_questions,
      score: result.points,
      score_by_section: result.bySection,
    })
    .eq('id', simulation.id)
    .eq('status', 'in_progress')
    .select(SIMULATION_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) return loadOwnedSimulation(simulation.student_id, simulation.id);

  // Seules les questions réellement vues par l'étudiant alimentent la révision espacée.
  try {
    await updateQuestionStats(
      simulation.student_id,
      drawn.filter((question) => answers.has(question.position)).map((question) => ({ questionId: question.question_id, correct: answers.get(question.position)!.is_correct })),
    );
  } catch (err) {
    logger.error({ err, simulationId: simulation.id }, 'question_stats_update_failed');
  }

  return data as SimulationRow;
}

async function settleIfExpired(simulation: SimulationRow): Promise<SimulationRow> {
  return simulation.status === 'in_progress' && isExpired(simulation) ? finalize(simulation) : simulation;
}

export async function startSimulation(studentId: string, input: { mode: SimulationMode; templateId?: string | undefined }) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('simulations')
    .select(SIMULATION_COLUMNS)
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && (await settleIfExpired(existing as SimulationRow)).status === 'in_progress') {
    throw new HttpError(409, 'simulation_in_progress', 'Une simulation est déjà en cours.', { simulationId: existing.id });
  }

  let plan: DrawPlan;
  if (input.mode === 'revision') {
    plan = await planRevision(studentId);
  } else {
    if (!input.templateId) throw new HttpError(400, 'template_required', 'Choisissez un modèle de test.');
    const template = await loadActiveTemplate(input.templateId);
    plan = input.mode === 'defi' ? await planChallenge(template) : await planFullTest(template);
  }

  const startedAt = new Date();
  const { data: simulation, error: insertError } = await supabaseAdmin
    .from('simulations')
    .insert({
      student_id: studentId,
      test_template_id: plan.templateId,
      template_version: plan.templateVersion,
      mode: input.mode,
      started_at: startedAt.toISOString(),
      deadline_at: new Date(startedAt.getTime() + plan.durationSeconds * 1000).toISOString(),
      total_questions: plan.draw.length,
    })
    .select('id')
    .single();
  if (insertError?.code === '23505') throw new HttpError(409, 'simulation_in_progress', 'Une simulation est déjà en cours.');
  if (insertError) throw insertError;

  const { error: drawError } = await supabaseAdmin
    .from('simulation_questions')
    .insert(plan.draw.map((item, position) => ({ simulation_id: simulation.id, position, question_id: item.questionId, section_id: item.sectionId })));
  if (drawError) {
    await supabaseAdmin.from('simulations').delete().eq('id', simulation.id);
    throw drawError;
  }

  return getSimulationState(studentId, simulation.id as string);
}

// État courant, sans jamais exposer la bonne réponse (checklist anti-triche).
export async function getSimulationState(studentId: string, simulationId: string) {
  const simulation = await settleIfExpired(await loadOwnedSimulation(studentId, simulationId));

  const base = {
    id: simulation.id,
    mode: simulation.mode,
    status: simulation.status,
    startedAt: simulation.started_at,
    deadlineAt: simulation.deadline_at,
    serverNow: new Date().toISOString(),
    totalQuestions: simulation.total_questions,
    position: simulation.current_position,
  };
  if (simulation.status !== 'in_progress') return { ...base, question: null };

  const question = await loadQuestionAt(simulation.id, simulation.current_position);
  return {
    ...base,
    question: { position: question.position, sectionName: question.sectionName, text: question.text, options: question.options },
  };
}

export async function submitAnswer(studentId: string, simulationId: string, input: { position: number; answer: string | null }) {
  const simulation = await loadOwnedSimulation(studentId, simulationId);
  if (simulation.status !== 'in_progress') throw new HttpError(409, 'simulation_closed', 'Cette simulation est terminée.');
  if (isExpired(simulation, DEADLINE_GRACE_MS)) {
    await finalize(simulation);
    throw new HttpError(409, 'time_over', 'Le temps est écoulé.');
  }
  // Pas de retour en arrière ni de saut : seule la question courante est acceptée (EF-09).
  if (input.position !== simulation.current_position) {
    throw new HttpError(409, 'out_of_sequence', 'Cette question n’est plus disponible.');
  }

  const question = await loadQuestionAt(simulation.id, input.position);
  if (input.answer !== null && !question.options.some((option) => option.key === input.answer)) {
    throw new HttpError(400, 'invalid_answer', 'Réponse invalide.');
  }

  const { data: lastAnswer, error: lastError } = await supabaseAdmin
    .from('simulation_answers')
    .select('answered_at')
    .eq('simulation_id', simulation.id)
    .order('answered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;
  const since = Date.parse(lastAnswer?.answered_at ?? simulation.started_at);
  const isCorrect = input.answer !== null && input.answer === question.correctAnswer;

  const { error: insertError } = await supabaseAdmin.from('simulation_answers').insert({
    simulation_id: simulation.id,
    position: input.position,
    question_id: question.questionId,
    answer_given: input.answer,
    is_correct: isCorrect,
    time_spent_seconds: Math.max(0, Math.round((Date.now() - since) / 1000)),
  });
  if (insertError?.code === '23505') throw new HttpError(409, 'out_of_sequence', 'Cette question a déjà été répondue.');
  if (insertError) throw insertError;

  const nextPosition = input.position + 1;
  const { data: advanced, error: advanceError } = await supabaseAdmin
    .from('simulations')
    .update({ current_position: nextPosition })
    .eq('id', simulation.id)
    .eq('status', 'in_progress')
    .eq('current_position', input.position)
    .select(SIMULATION_COLUMNS)
    .maybeSingle();
  if (advanceError) throw advanceError;
  if (!advanced) throw new HttpError(409, 'out_of_sequence', 'Cette question a déjà été répondue.');

  const finished = nextPosition >= simulation.total_questions;
  if (finished) await finalize(advanced as SimulationRow);

  return {
    finished,
    feedback: FEEDBACK_MODES.has(simulation.mode) ? { isCorrect, correctAnswer: question.correctAnswer, explanation: question.explanation } : null,
  };
}

async function templateLabel(templateId: string | null) {
  if (!templateId) return REVISION_TEMPLATE;
  const { data, error } = await supabaseAdmin.from('test_templates').select('name, code').eq('id', templateId).single();
  if (error) throw error;
  return { name: data.name as string, code: data.code as string };
}

export async function getSimulationResults(studentId: string, simulationId: string) {
  const simulation = await settleIfExpired(await loadOwnedSimulation(studentId, simulationId));
  if (simulation.status !== 'completed') {
    throw new HttpError(409, 'simulation_not_finished', 'Les résultats seront disponibles à la fin de la simulation.');
  }

  const [drawnResult, answersResult, template, rules, previousResult] = await Promise.all([
    supabaseAdmin.from('simulation_questions').select(DRAWN_QUESTION_COLUMNS).eq('simulation_id', simulation.id).order('position'),
    supabaseAdmin.from('simulation_answers').select('position, answer_given, is_correct, time_spent_seconds').eq('simulation_id', simulation.id),
    templateLabel(simulation.test_template_id),
    scoringRulesFor(simulation),
    // EF-43 : comparaison avec la tentative précédente sur le même modèle et le même mode.
    simulation.test_template_id
      ? supabaseAdmin
          .from('simulations')
          .select('id, score, completed_at, total_questions, score_by_section')
          .eq('student_id', studentId)
          .eq('test_template_id', simulation.test_template_id)
          .eq('mode', simulation.mode)
          .eq('status', 'completed')
          .lt('started_at', simulation.started_at)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (drawnResult.error) throw drawnResult.error;
  if (answersResult.error) throw answersResult.error;
  if (previousResult.error) throw previousResult.error;

  const answers = new Map(
    (answersResult.data as { position: number; answer_given: string | null; is_correct: boolean; time_spent_seconds: number }[]).map((answer) => [answer.position, answer]),
  );
  const bySection = simulation.score_by_section ?? {};
  const correct = Object.values(bySection).reduce((sum, section) => sum + section.correct, 0);
  const previous = previousResult.data as { id: string; score: number | null; completed_at: string; score_by_section: Record<string, SectionTally> | null } | null;

  return {
    id: simulation.id,
    mode: simulation.mode,
    template,
    scoringRules: rules,
    startedAt: simulation.started_at,
    completedAt: simulation.completed_at,
    totalQuestions: simulation.total_questions,
    score: simulation.score,
    bySection,
    challenge: simulation.mode === 'defi' ? { target: CHALLENGE_TARGET, correct, succeeded: correct >= CHALLENGE_TARGET } : null,
    previous: previous
      ? {
          id: previous.id,
          score: previous.score,
          correct: Object.values(previous.score_by_section ?? {}).reduce((sum, section) => sum + section.correct, 0),
          completedAt: previous.completed_at,
        }
      : null,
    questions: (drawnResult.data as unknown as DrawnQuestionRow[]).map((row) => {
      const question = toDrawnQuestion(row);
      const answer = answers.get(question.position);
      return {
        position: question.position,
        sectionName: question.sectionName,
        text: question.text,
        options: question.options,
        answerGiven: answer?.answer_given ?? null,
        correctAnswer: question.correctAnswer,
        isCorrect: answer?.is_correct ?? false,
        explanation: question.explanation,
        timeSpentSeconds: answer?.time_spent_seconds ?? 0,
      };
    }),
  };
}

// Historique étudiant (EF-13), simulation en cours incluse pour permettre la reprise (EF-11).
export async function listSimulations(studentId: string) {
  const { data, error } = await supabaseAdmin
    .from('simulations')
    .select(`${SIMULATION_COLUMNS}, test_templates(name, code)`)
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data as unknown as (SimulationRow & { test_templates: { name: string; code: string } | null })[]).map((row) => ({
    id: row.id,
    mode: row.mode,
    status: row.status === 'in_progress' && isExpired(row) ? 'expired' : row.status,
    template: row.test_templates ?? REVISION_TEMPLATE,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deadlineAt: row.deadline_at,
    totalQuestions: row.total_questions,
    score: row.score,
    correct: row.score_by_section ? Object.values(row.score_by_section).reduce((sum, section) => sum + section.correct, 0) : null,
  }));
}
