import { HttpError } from '../lib/http-error.js';
import { supabaseAdmin } from '../lib/supabase.js';
import type { CefrLevel } from './access.js';
import { getStudentDocumentsSpace } from './documents.js';
import { buildLearningPath, computeReadiness, startOfWeek, type EmbassyDimension, type PathSnapshot } from './learning-plan.js';
import type { SectionTally } from './scoring.js';
import { getReviewSummary } from './test-engine.js';

export interface StudentProfileInput {
  currentEducationLevel?: string | null | undefined;
  diplomas: string[];
  englishLevel?: string | null | undefined;
  desiredField?: string | null | undefined;
  preferredCities: string[];
  institutionTypePreference?: string | null | undefined;
  studyObjective?: string | null | undefined;
  budgetRange?: string | null | undefined;
  financingSource?: string | null | undefined;
  projectStage?: string | null | undefined;
  targetIntake?: string | null | undefined;
  targetTemplateId?: string | null | undefined;
  visaType?: string | null | undefined;
  hasGuarantor?: boolean | null | undefined;
}

const PROFILE_COLUMNS =
  'current_education_level, diplomas, english_level, desired_field, preferred_cities, institution_type_preference, study_objective, budget_range, financing_source, project_stage, target_intake, target_template_id, visa_type, has_guarantor, updated_at, test_templates(id, name)';

interface ProfileRow {
  current_education_level: string | null;
  diplomas: string[];
  english_level: string | null;
  desired_field: string | null;
  preferred_cities: string[];
  institution_type_preference: string | null;
  study_objective: string | null;
  budget_range: string | null;
  financing_source: string | null;
  project_stage: string | null;
  target_intake: string | null;
  target_template_id: string | null;
  visa_type: string | null;
  has_guarantor: boolean | null;
  updated_at: string;
  test_templates: { id: string; name: string } | null;
}

function toProfile(row: ProfileRow | null) {
  return {
    exists: row !== null,
    currentEducationLevel: row?.current_education_level ?? null,
    diplomas: row?.diplomas ?? [],
    englishLevel: row?.english_level ?? null,
    desiredField: row?.desired_field ?? null,
    preferredCities: row?.preferred_cities ?? [],
    institutionTypePreference: row?.institution_type_preference ?? null,
    studyObjective: row?.study_objective ?? null,
    budgetRange: row?.budget_range ?? null,
    financingSource: row?.financing_source ?? null,
    projectStage: row?.project_stage ?? null,
    targetIntake: row?.target_intake ?? null,
    targetTemplate: row?.test_templates ?? null,
    visaType: row?.visa_type ?? null,
    hasGuarantor: row?.has_guarantor ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

async function loadProfileRow(studentId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabaseAdmin.from('student_profiles').select(PROFILE_COLUMNS).eq('student_id', studentId).maybeSingle();
  if (error) throw error;
  return data as unknown as ProfileRow | null;
}

export async function getStudentProfile(studentId: string) {
  return toProfile(await loadProfileRow(studentId));
}

export async function saveStudentProfile(studentId: string, input: StudentProfileInput) {
  if (input.targetTemplateId) {
    const { data, error } = await supabaseAdmin.from('test_templates').select('id').eq('id', input.targetTemplateId).eq('is_active', true).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(400, 'template_not_found', 'Modèle de test introuvable.');
  }

  const { error } = await supabaseAdmin.from('student_profiles').upsert(
    {
      student_id: studentId,
      current_education_level: input.currentEducationLevel ?? null,
      diplomas: input.diplomas.map((value) => value.trim()).filter(Boolean),
      english_level: input.englishLevel ?? null,
      desired_field: input.desiredField || null,
      preferred_cities: input.preferredCities.map((value) => value.trim()).filter(Boolean),
      institution_type_preference: input.institutionTypePreference ?? null,
      study_objective: input.studyObjective ?? null,
      budget_range: input.budgetRange ?? null,
      financing_source: input.financingSource ?? null,
      project_stage: input.projectStage ?? null,
      target_intake: input.targetIntake || null,
      target_template_id: input.targetTemplateId ?? null,
      visa_type: input.visaType ?? null,
      has_guarantor: input.hasGuarantor ?? null,
    },
    { onConflict: 'student_id' },
  );
  if (error) throw error;
  return getStudentProfile(studentId);
}

// ─────────────────────────────────────────────────────────────
// Données agrégées de l'étudiant
// ─────────────────────────────────────────────────────────────

interface SimulationSummaryRow {
  mode: PathSnapshot['completedByMode'] extends Record<infer K, number> ? K : never;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_questions: number;
  test_template_id: string | null;
  score_by_section: Record<string, SectionTally> | null;
}

interface EmbassyRow {
  status: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  ai_report: { dimensions?: Partial<Record<EmbassyDimension, number>>; inconsistencies?: { topic: string }[] } | null;
}

async function loadActivity(studentId: string) {
  const since60Days = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const [levelResult, simulationsResult, exercisesResult, embassyResult] = await Promise.all([
    supabaseAdmin.from('profiles').select('level').eq('id', studentId).single(),
    supabaseAdmin
      .from('simulations')
      .select('mode, status, started_at, completed_at, total_questions, test_template_id, score_by_section')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(100),
    supabaseAdmin.from('exercise_attempts').select('score, max_score, created_at').eq('student_id', studentId).gte('created_at', since60Days),
    supabaseAdmin
      .from('embassy_sessions')
      .select('status, started_at, completed_at, overall_score, ai_report')
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(30),
  ]);
  for (const result of [levelResult, simulationsResult, exercisesResult, embassyResult]) if (result.error) throw result.error;

  return {
    level: (levelResult.data?.level as CefrLevel | null) ?? null,
    simulations: simulationsResult.data as unknown as SimulationSummaryRow[],
    exercises: exercisesResult.data as { score: number; max_score: number; created_at: string }[],
    embassy: embassyResult.data as unknown as EmbassyRow[],
  };
}

function accuracyOf(simulation: SimulationSummaryRow): number | null {
  if (!simulation.score_by_section || simulation.total_questions === 0) return null;
  const correct = Object.values(simulation.score_by_section).reduce((sum, section) => sum + section.correct, 0);
  return correct / simulation.total_questions;
}

export async function getReadiness(studentId: string) {
  const [profile, activity] = await Promise.all([loadProfileRow(studentId), loadActivity(studentId)]);
  const completed = activity.simulations.filter((simulation) => simulation.status === 'completed' && simulation.mode !== 'revision');
  // Priorité au test visé ; à défaut, toutes les simulations.
  const targeted = profile?.target_template_id ? completed.filter((simulation) => simulation.test_template_id === profile.target_template_id) : [];
  const relevant = targeted.length > 0 ? targeted : completed;
  const completedEmbassy = activity.embassy.filter((session) => session.status === 'completed' && session.overall_score !== null);

  const readiness = computeReadiness({
    level: activity.level,
    simulationAccuracies: relevant.map(accuracyOf).filter((value): value is number => value !== null),
    exerciseRatios: activity.exercises.map((attempt) => attempt.score / attempt.max_score),
    hasProfile: profile !== null,
    financingSource: profile?.financing_source ?? null,
    budgetRange: profile?.budget_range ?? null,
    embassyScores: completedEmbassy.map((session) => session.overall_score!),
    embassyFinancialClarity: completedEmbassy
      .map((session) => session.ai_report?.dimensions?.financial_clarity)
      .filter((value): value is number => typeof value === 'number'),
  });

  return {
    ...readiness,
    basis: {
      simulations: relevant.length,
      exercises: activity.exercises.length,
      embassySessions: completedEmbassy.length,
      targetTemplate: profile?.test_templates?.name ?? null,
    },
    notice: 'Indicateur pédagogique d’auto-évaluation : il ne constitue ni une décision ni une probabilité d’admission ou d’obtention du visa.',
  };
}

export async function getLearningPath(studentId: string, now = new Date()) {
  const [profile, activity, reviews, documents] = await Promise.all([
    loadProfileRow(studentId),
    loadActivity(studentId),
    getReviewSummary(studentId, now),
    getStudentDocumentsSpace(studentId),
  ]);
  const weekStart = startOfWeek(now).getTime();
  const completed = activity.simulations.filter((simulation) => simulation.status === 'completed' && simulation.completed_at);
  const count = (mode: SimulationSummaryRow['mode']) => completed.filter((simulation) => simulation.mode === mode).length;
  const completedEmbassy = activity.embassy.filter((session) => session.status === 'completed');
  const latestReport = completedEmbassy[0]?.ai_report ?? null;

  const snapshot: PathSnapshot = {
    hasProfile: profile !== null,
    studyObjective: profile?.study_objective ?? null,
    desiredField: profile?.desired_field ?? null,
    targetIntake: profile?.target_intake ?? null,
    projectStage: profile?.project_stage ?? null,
    level: activity.level,
    targetTemplate: profile?.test_templates ?? null,
    completedByMode: { entrainement: count('entrainement'), examen: count('examen'), revision: count('revision'), defi: count('defi') },
    lastExamAt: completed.find((simulation) => simulation.mode === 'examen')?.completed_at ?? null,
    lastEmbassyAt: completedEmbassy[0]?.completed_at ?? null,
    embassyCompleted: completedEmbassy.length,
    dueReviews: reviews.dueCount,
    weakCategories: reviews.weakCategories,
    practiceThisWeek: completed.filter((simulation) => simulation.mode !== 'examen' && Date.parse(simulation.completed_at!) >= weekStart).length,
    exercisesThisWeek: activity.exercises.filter((attempt) => Date.parse(attempt.created_at) >= weekStart).length,
    examsLast14Days: completed.filter((simulation) => simulation.mode === 'examen' && now.getTime() - Date.parse(simulation.completed_at!) <= 14 * 86_400_000).length,
    embassyThisWeek: completedEmbassy.filter((session) => session.completed_at && Date.parse(session.completed_at) >= weekStart).length,
    embassyLatestDimensions: latestReport?.dimensions ?? null,
    embassyInconsistencyTopics: (latestReport?.inconsistencies ?? []).map((item) => item.topic),
    documents: {
      missing: documents.checklist.items.filter((item) => item.status === 'missing' && item.documentType).length,
      needsCorrection: documents.checklist.items.filter((item) => item.status === 'needs_correction').length,
      expired: documents.checklist.items.filter((item) => item.status === 'expired').length,
      expiringSoon: documents.checklist.items.filter((item) => item.expiringSoon).length,
    },
  };

  const path = buildLearningPath(snapshot, now);

  // Instantané conservé pour le suivi enseignant (§19.4).
  const { error } = await supabaseAdmin.from('learning_paths').upsert(
    {
      student_id: studentId,
      objective: path.objective,
      target_template_id: path.targetTemplate?.id ?? null,
      weekly_goals: path.weeklyGoals,
      recommended_actions: path.actions,
      progress_percent: path.progressPercent,
      generated_at: now.toISOString(),
    },
    { onConflict: 'student_id' },
  );
  if (error) throw error;

  return { ...path, reviews: { dueCount: reviews.dueCount, nextReviewAt: reviews.nextReviewAt, categories: reviews.categories }, generatedAt: now.toISOString() };
}
