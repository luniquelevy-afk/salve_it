import { describe, expect, it } from 'vitest';
import { buildLearningPath, computeReadiness, startOfWeek, type PathSnapshot } from '../src/services/learning-plan.js';
import { MAX_INTERVAL_DAYS, nextReviewState, reviewPriority } from '../src/services/spaced-repetition.js';

const NOW = new Date('2026-09-14T10:00:00Z');
const DAY = 86_400_000;

describe('révision espacée', () => {
  it('double l’intervalle à chaque bonne réponse, plafonné', () => {
    let state = nextReviewState(null, true, NOW);
    expect(state.intervalDays).toBe(1);
    state = nextReviewState(state, true, NOW);
    state = nextReviewState(state, true, NOW);
    expect(state.intervalDays).toBe(4);
    expect(Date.parse(state.nextReviewAt) - NOW.getTime()).toBe(4 * DAY);
    for (let i = 0; i < 10; i += 1) state = nextReviewState(state, true, NOW);
    expect(state.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it('remet à zéro sur erreur : question immédiatement à réviser', () => {
    const learned = nextReviewState(nextReviewState(null, true, NOW), true, NOW);
    const wrong = nextReviewState(learned, false, NOW);
    expect(wrong).toMatchObject({ intervalDays: 0, lastCorrect: false, attemptsCount: 3, correctCount: 2 });
    expect(wrong.nextReviewAt).toBe(NOW.toISOString());
    expect(wrong.masteryScore).toBeLessThan(learned.masteryScore);
  });

  it('fait progresser la maîtrise vers 1 avec les bonnes réponses', () => {
    let state = nextReviewState(null, true, NOW);
    expect(state.masteryScore).toBe(0.4);
    state = nextReviewState(state, true, NOW);
    expect(state.masteryScore).toBe(0.64);
  });

  it('priorise les erreurs fréquentes, les retards et les compétences importantes du test visé', () => {
    const due = NOW.toISOString();
    const oftenWrong = reviewPriority({ attemptsCount: 4, correctCount: 1, nextReviewAt: due }, NOW);
    const rarelyWrong = reviewPriority({ attemptsCount: 4, correctCount: 3, nextReviewAt: due }, NOW);
    const overdue = reviewPriority({ attemptsCount: 4, correctCount: 3, nextReviewAt: new Date(NOW.getTime() - 14 * DAY).toISOString() }, NOW);
    const weighted = reviewPriority({ attemptsCount: 4, correctCount: 3, nextReviewAt: due }, NOW, 1);
    expect(oftenWrong).toBeGreaterThan(rarelyWrong);
    expect(overdue).toBeGreaterThan(rarelyWrong);
    expect(weighted).toBeGreaterThan(rarelyWrong);
  });
});

describe('indicateur de préparation', () => {
  const empty = {
    level: null,
    simulationAccuracies: [],
    exerciseRatios: [],
    hasProfile: false,
    financingSource: null,
    budgetRange: null,
    embassyScores: [],
    embassyFinancialClarity: [],
  };

  it('ne produit aucune valeur sans donnée (pas de score inventé)', () => {
    expect(computeReadiness(empty)).toEqual({ academic: null, language: null, financial: null, visa: null, overall: null });
  });

  it('combine les sources disponibles', () => {
    const readiness = computeReadiness({
      ...empty,
      level: 'B1',
      simulationAccuracies: [0.8, 0.6],
      exerciseRatios: [1, 0.5],
      hasProfile: true,
      financingSource: 'famille',
      budgetRange: '500_800',
      embassyScores: [60],
      embassyFinancialClarity: [40],
    });
    expect(readiness).toEqual({ academic: 70, language: 75, financial: 60, visa: 60, overall: 66 });
  });

  it('évalue la clarté du financement, jamais le montant', () => {
    const low = computeReadiness({ ...empty, hasProfile: true, financingSource: 'garant', budgetRange: 'moins_500' });
    const high = computeReadiness({ ...empty, hasProfile: true, financingSource: 'garant', budgetRange: 'plus_1200' });
    const undefinedPlan = computeReadiness({ ...empty, hasProfile: true, financingSource: 'non_defini', budgetRange: 'non_defini' });
    expect(low.financial).toBe(high.financial);
    expect(undefinedPlan.financial).toBe(20);
  });
});

const baseSnapshot: PathSnapshot = {
  hasProfile: true,
  studyObjective: 'licence',
  desiredField: 'informatique',
  targetIntake: 'septembre 2027',
  projectStage: 'preparation_tests',
  level: 'B1',
  targetTemplate: { id: 'tpl-1', name: 'TOLC-I' },
  completedByMode: { entrainement: 3, examen: 1, revision: 1, defi: 0 },
  lastExamAt: new Date(NOW.getTime() - 3 * DAY).toISOString(),
  lastEmbassyAt: null,
  embassyCompleted: 0,
  dueReviews: 0,
  weakCategories: [],
  practiceThisWeek: 1,
  exercisesThisWeek: 2,
  examsLast14Days: 1,
  embassyThisWeek: 0,
  embassyLatestDimensions: null,
  embassyInconsistencyTopics: [],
  documents: { missing: 0, needsCorrection: 0, expired: 0, expiringSoon: 0 },
};

describe('parcours personnalisé', () => {
  it('commence par le profil et le positionnement pour un nouvel étudiant', () => {
    const path = buildLearningPath(
      { ...baseSnapshot, hasProfile: false, studyObjective: null, projectStage: null, completedByMode: { entrainement: 0, examen: 0, revision: 0, defi: 0 }, lastExamAt: null },
      NOW,
    );
    expect(path.actions.map((action) => action.id)).toEqual(['complete_profile', 'first_practice']);
    expect(path.objective).toBeNull();
  });

  it('met en avant les révisions dues et les compétences faibles', () => {
    const path = buildLearningPath({ ...baseSnapshot, dueReviews: 7, weakCategories: [{ category: 'logica', accuracy: 40 }] }, NOW);
    expect(path.actions[0]).toMatchObject({ id: 'reviews_due', title: 'Réviser 7 questions' });
    expect(path.actions.some((action) => action.id === 'weak_logica')).toBe(true);
    expect(path.objective).toBe('Licence en Italie en informatique — rentrée septembre 2027');
  });

  it('recommande l’entretien consulaire quand le projet arrive au visa', () => {
    const path = buildLearningPath({ ...baseSnapshot, projectStage: 'visa' }, NOW);
    expect(path.actions.some((action) => action.id === 'embassy_practice')).toBe(true);
    expect(path.weeklyGoals.map((goal) => goal.id)).toContain('embassy');
  });

  it('propose un examen de contrôle toutes les deux semaines', () => {
    const path = buildLearningPath({ ...baseSnapshot, lastExamAt: new Date(NOW.getTime() - 20 * DAY).toISOString(), examsLast14Days: 0 }, NOW);
    expect(path.actions.some((action) => action.id === 'exam_checkpoint')).toBe(true);
  });

  it('calcule la progression hebdomadaire plafonnée par objectif', () => {
    const path = buildLearningPath({ ...baseSnapshot, practiceThisWeek: 10, exercisesThisWeek: 0, examsLast14Days: 1 }, NOW);
    expect(path.progressPercent).toBe(67);
  });

  it('V1.3 : documents à corriger, incohérences et dimension la plus faible du dernier entretien', () => {
    const path = buildLearningPath(
      {
        ...baseSnapshot,
        projectStage: 'visa',
        embassyCompleted: 1,
        lastEmbassyAt: new Date(NOW.getTime() - 2 * DAY).toISOString(),
        embassyLatestDimensions: { coherence_project: 70, financial_clarity: 35, document_awareness: 60 },
        embassyInconsistencyTopics: ['Ville d’études', 'Ville d’études'],
        documents: { missing: 3, needsCorrection: 1, expired: 0, expiringSoon: 1 },
      },
      NOW,
    );
    expect(path.actions.map((action) => action.id)).toEqual(['documents_correction', 'documents_expiry', 'embassy_inconsistencies', 'embassy_financial_clarity', 'documents_missing']);
    expect(path.actions[0]).toMatchObject({ title: 'Corriger 1 document' });
    expect(path.actions[1]).toMatchObject({ title: 'Renouveler 1 document' });
    expect(path.actions.find((action) => action.id === 'embassy_inconsistencies')?.description).toContain('Ville d’études');
    expect(path.actions.find((action) => action.id === 'embassy_financial_clarity')?.title).toBe('Préparer un budget mensuel détaillé');
  });

  it('aucune recommandation d’entretien si toutes les dimensions sont satisfaisantes', () => {
    const path = buildLearningPath({ ...baseSnapshot, embassyLatestDimensions: { coherence_project: 80, financial_clarity: 65 } }, NOW);
    expect(path.actions.some((action) => action.id.startsWith('embassy_') && action.id !== 'embassy_discover')).toBe(false);
  });

  it('semaine commençant le lundi', () => {
    expect(startOfWeek(new Date('2026-09-17T15:00:00Z')).toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(startOfWeek(new Date('2026-09-20T23:00:00Z')).toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });
});
