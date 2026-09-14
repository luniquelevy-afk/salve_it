// Indicateur de préparation (§9.1, EF-40) et parcours personnalisé (§9.2, EF-41, EF-49).
// Règles déterministes et explicables : aucun appel IA, aucun coût variable.
import type { CefrLevel } from './access.js';

const LEVEL_SCORES: Record<CefrLevel, number> = { A1: 25, A2: 50, B1: 75, B2: 100 };

const average = (values: number[]) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);

export interface ReadinessInput {
  level: CefrLevel | null;
  // Taux de réussite (0 à 1) des simulations terminées, la plus récente en premier.
  simulationAccuracies: number[];
  exerciseRatios: number[];
  hasProfile: boolean;
  financingSource: string | null;
  budgetRange: string | null;
  embassyScores: number[];
  embassyFinancialClarity: number[];
}

export interface Readiness {
  academic: number | null;
  language: number | null;
  financial: number | null;
  visa: number | null;
  overall: number | null;
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const accuracy = average(input.simulationAccuracies.slice(0, 5));
  const academic = accuracy === null ? null : Math.round(accuracy * 100);

  const levelScore = input.level ? LEVEL_SCORES[input.level] : null;
  const exercises = average(input.exerciseRatios);
  const language = levelScore === null ? null : Math.round(exercises === null ? levelScore : 0.7 * levelScore + 30 * exercises);

  // Clarté du plan de financement (déclaré + entretiens), jamais un jugement sur le montant.
  let declared: number | null = null;
  if (input.hasProfile) {
    const sourceKnown = Boolean(input.financingSource) && input.financingSource !== 'non_defini';
    const rangeKnown = Boolean(input.budgetRange) && input.budgetRange !== 'non_defini';
    declared = sourceKnown && rangeKnown ? 80 : sourceKnown || rangeKnown ? 50 : 20;
  }
  const clarity = average(input.embassyFinancialClarity.slice(0, 3));
  const financial = declared === null ? (clarity === null ? null : Math.round(clarity)) : clarity === null ? declared : Math.round((declared + clarity) / 2);

  const visaAverage = average(input.embassyScores.slice(0, 3));
  const visa = visaAverage === null ? null : Math.round(visaAverage);

  const known = [academic, language, financial, visa].filter((value): value is number => value !== null);
  return { academic, language, financial, visa, overall: known.length ? Math.round(average(known)!) : null };
}

export interface PathSnapshot {
  hasProfile: boolean;
  studyObjective: string | null;
  desiredField: string | null;
  targetIntake: string | null;
  projectStage: string | null;
  level: CefrLevel | null;
  targetTemplate: { id: string; name: string } | null;
  completedByMode: Record<'entrainement' | 'examen' | 'revision' | 'defi', number>;
  lastExamAt: string | null;
  lastEmbassyAt: string | null;
  embassyCompleted: number;
  dueReviews: number;
  weakCategories: { category: string; accuracy: number }[];
  practiceThisWeek: number;
  exercisesThisWeek: number;
  examsLast14Days: number;
  embassyThisWeek: number;
  // V1.3 : dernier rapport d'entretien et suivi documentaire (V1.2).
  embassyLatestDimensions: Partial<Record<EmbassyDimension, number>> | null;
  embassyInconsistencyTopics: string[];
  documents: { missing: number; needsCorrection: number; expired: number; expiringSoon: number };
}

export type EmbassyDimension = 'coherence_project' | 'knowledge_university' | 'financial_clarity' | 'language_confidence' | 'return_plan' | 'document_awareness';

// Recommandation ciblée sur la dimension la plus faible du dernier entretien.
const DIMENSION_ACTIONS: Record<EmbassyDimension, { title: string; description: string; link: string }> = {
  coherence_project: {
    title: 'Clarifier votre projet d’études',
    description: 'Reliez clairement votre parcours, la formation visée et votre objectif professionnel, puis mettez votre profil à jour.',
    link: '/etudiant/profil',
  },
  knowledge_university: {
    title: 'Mieux connaître votre formation et votre ville',
    description: 'Renseignez-vous sur le programme, les cours et la vie sur place : vos réponses étaient encore imprécises.',
    link: '/etudiant/entretien',
  },
  financial_clarity: {
    title: 'Préparer un budget mensuel détaillé',
    description: 'Logement, transport, alimentation, assurance : chiffrez chaque poste et précisez qui finance.',
    link: '/etudiant/documents',
  },
  language_confidence: {
    title: 'Gagner en aisance pour répondre',
    description: 'Entraînez-vous avec les exercices puis refaites un entretien, idéalement à l’oral.',
    link: '/etudiant/exercices',
  },
  return_plan: {
    title: 'Préciser votre projet après les études',
    description: 'Préparez une réponse concrète sur ce que vous ferez à l’issue de la formation.',
    link: '/etudiant/entretien',
  },
  document_awareness: {
    title: 'Réviser les démarches et documents',
    description: 'Parcourez votre checklist et ses sources officielles avant le prochain entretien.',
    link: '/etudiant/documents',
  },
};

const WEAK_DIMENSION_THRESHOLD = 50;

export interface PathAction {
  id: string;
  priority: number;
  title: string;
  description: string;
  link: string;
}

export interface WeeklyGoal {
  id: string;
  label: string;
  target: number;
  done: number;
}

const DAY_MS = 86_400_000;
const OBJECTIVE_LABELS: Record<string, string> = {
  licence: 'Licence en Italie',
  master: 'Master en Italie',
  formation_pro: 'Formation professionnelle en Italie',
  mobilite: 'Mobilité en Italie',
};
const VISA_STAGES = new Set(['preinscription', 'visa', 'depart']);

export function buildLearningPath(snapshot: PathSnapshot, now: Date = new Date()) {
  const actions: PathAction[] = [];
  const practiceTotal = snapshot.completedByMode.entrainement + snapshot.completedByMode.revision + snapshot.completedByMode.defi;
  const templateQuery = snapshot.targetTemplate ? `?modele=${snapshot.targetTemplate.id}` : '';

  if (!snapshot.hasProfile) {
    actions.push({
      id: 'complete_profile',
      priority: 100,
      title: 'Compléter mon profil',
      description: 'Votre projet d’études permet d’adapter vos recommandations.',
      link: '/etudiant/profil',
    });
  }

  if (snapshot.documents.needsCorrection > 0) {
    actions.push({
      id: 'documents_correction',
      priority: 88,
      title: `Corriger ${snapshot.documents.needsCorrection} document${snapshot.documents.needsCorrection > 1 ? 's' : ''}`,
      description: 'Le centre vous a demandé une correction : consultez le commentaire et déposez une nouvelle version.',
      link: '/etudiant/documents',
    });
  }

  if (snapshot.documents.expired > 0 || snapshot.documents.expiringSoon > 0) {
    const count = snapshot.documents.expired + snapshot.documents.expiringSoon;
    actions.push({
      id: 'documents_expiry',
      priority: 86,
      title: `Renouveler ${count} document${count > 1 ? 's' : ''}`,
      description: snapshot.documents.expired > 0 ? 'Un document de votre dossier est expiré.' : 'Un document de votre dossier expire dans moins de 30 jours.',
      link: '/etudiant/documents',
    });
  }

  if (snapshot.embassyInconsistencyTopics.length > 0) {
    const topics = [...new Set(snapshot.embassyInconsistencyTopics)].slice(0, 2).join(', ');
    actions.push({
      id: 'embassy_inconsistencies',
      priority: 78,
      title: 'Rendre votre discours cohérent',
      description: `Votre dernier entretien comporte des points à clarifier (${topics}). Préparez une réponse claire, puis refaites un entretien.`,
      link: '/etudiant/entretien',
    });
  }

  if (snapshot.embassyLatestDimensions) {
    const rated = Object.entries(snapshot.embassyLatestDimensions).filter((entry): entry is [EmbassyDimension, number] => typeof entry[1] === 'number');
    const weakest = rated.sort((a, b) => a[1] - b[1])[0];
    if (weakest && weakest[1] < WEAK_DIMENSION_THRESHOLD) {
      actions.push({ id: `embassy_${weakest[0]}`, priority: 72, ...DIMENSION_ACTIONS[weakest[0]] });
    }
  }

  if (snapshot.projectStage && VISA_STAGES.has(snapshot.projectStage) && snapshot.documents.missing > 0) {
    actions.push({
      id: 'documents_missing',
      priority: 65,
      title: `Déposer ${snapshot.documents.missing} document${snapshot.documents.missing > 1 ? 's' : ''} de votre checklist`,
      description: 'Votre projet approche de la demande de visa : complétez votre dossier de préparation.',
      link: '/etudiant/documents',
    });
  }

  if (snapshot.dueReviews > 0) {
    actions.push({
      id: 'reviews_due',
      priority: 90,
      title: `Réviser ${snapshot.dueReviews} question${snapshot.dueReviews > 1 ? 's' : ''}`,
      description: 'Des questions déjà vues arrivent à échéance : c’est le meilleur moment pour les retravailler.',
      link: '/etudiant/simulations?mode=revision',
    });
  }

  if (practiceTotal + snapshot.completedByMode.examen === 0) {
    actions.push({
      id: 'first_practice',
      priority: 85,
      title: 'Passer une première simulation en entraînement',
      description: 'Elle sert de test de positionnement pour identifier vos points forts et vos points faibles.',
      link: `/etudiant/simulations${templateQuery}`,
    });
  }

  for (const weak of snapshot.weakCategories.slice(0, 2)) {
    actions.push({
      id: `weak_${weak.category}`,
      priority: 80,
      title: `Retravailler : ${weak.category}`,
      description: `${weak.accuracy} % de bonnes réponses dans cette compétence. Révisez vos erreurs et refaites des exercices.`,
      link: '/etudiant/simulations?mode=revision',
    });
  }

  if (snapshot.embassyCompleted === 0 || (snapshot.lastEmbassyAt && now.getTime() - Date.parse(snapshot.lastEmbassyAt) > 30 * DAY_MS)) {
    if (snapshot.projectStage && VISA_STAGES.has(snapshot.projectStage)) {
      actions.push({
        id: 'embassy_practice',
        priority: 75,
        title: 'Simuler l’entretien consulaire',
        description: 'Votre projet approche de l’étape du visa : entraînez-vous à présenter votre dossier.',
        link: '/etudiant/entretien',
      });
    } else if (snapshot.embassyCompleted === 0 && snapshot.projectStage) {
      actions.push({
        id: 'embassy_discover',
        priority: 40,
        title: 'Découvrir l’entretien consulaire',
        description: 'Un premier entretien d’entraînement vous aide à clarifier votre projet.',
        link: '/etudiant/entretien',
      });
    }
  }

  const examOverdue = !snapshot.lastExamAt || now.getTime() - Date.parse(snapshot.lastExamAt) > 14 * DAY_MS;
  if (practiceTotal >= 2 && examOverdue) {
    actions.push({
      id: 'exam_checkpoint',
      priority: 70,
      title: 'Faire le point en conditions d’examen',
      description: 'Une simulation chronométrée toutes les deux semaines permet de mesurer vos progrès.',
      link: `/etudiant/simulations${templateQuery}`,
    });
  }

  if ((snapshot.level === 'A1' || snapshot.level === 'A2') && (snapshot.studyObjective === 'licence' || snapshot.studyObjective === 'master')) {
    actions.push({
      id: 'language_boost',
      priority: 60,
      title: `Renforcer votre italien (niveau ${snapshot.level})`,
      description: 'Les études universitaires en italien demandent en général un niveau plus élevé : pratiquez les exercices chaque semaine.',
      link: '/etudiant/exercices',
    });
  }

  if (snapshot.practiceThisWeek === 0 && practiceTotal > 0) {
    actions.push({
      id: 'weekly_challenge',
      priority: 30,
      title: 'Relever un défi rapide',
      description: '5 questions en 5 minutes pour garder le rythme cette semaine.',
      link: `/etudiant/simulations${templateQuery}`,
    });
  }

  const weeklyGoals: WeeklyGoal[] = [
    { id: 'practice', label: 'Séances d’entraînement, révision ou défi', target: 3, done: snapshot.practiceThisWeek },
    { id: 'exercises', label: 'Exercices d’italien', target: 5, done: snapshot.exercisesThisWeek },
    { id: 'exam', label: 'Simulation en conditions d’examen (sur 2 semaines)', target: 1, done: snapshot.examsLast14Days },
  ];
  if (snapshot.projectStage && VISA_STAGES.has(snapshot.projectStage)) {
    weeklyGoals.push({ id: 'embassy', label: 'Entretien consulaire simulé', target: 1, done: snapshot.embassyThisWeek });
  }

  const progressPercent = Math.round((100 * weeklyGoals.reduce((sum, goal) => sum + Math.min(1, goal.done / goal.target), 0)) / weeklyGoals.length);

  const objective = snapshot.studyObjective
    ? [OBJECTIVE_LABELS[snapshot.studyObjective] ?? snapshot.studyObjective, snapshot.desiredField && `en ${snapshot.desiredField}`, snapshot.targetIntake && `— rentrée ${snapshot.targetIntake}`]
        .filter(Boolean)
        .join(' ')
    : null;

  return {
    objective,
    targetTemplate: snapshot.targetTemplate,
    weeklyGoals,
    actions: actions.sort((a, b) => b.priority - a.priority).slice(0, 5),
    progressPercent,
  };
}

export function startOfWeek(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}
