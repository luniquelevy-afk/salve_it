// Agent factice déterministe (AI_PROVIDER=fake) : développement de l'interface et tests sans clé ni coût.
import type { AiProviderClient, AiUsage } from './ai-types.js';
import type { KeyFacts, ReportOutput } from './embassy-prompts.js';
import type { QuestionVariantsOutput } from './question-variants.js';

export const FAKE_MODEL = 'fake-consul';

const QUESTIONS = [
  "Bonjour, asseyez-vous je vous prie. Pouvez-vous me présenter votre projet d'études en Italie ?",
  'Pourquoi avez-vous choisi cette université et cette ville en particulier ?',
  'Comment allez-vous financer vos études et votre vie sur place ?',
  'Où allez-vous vous loger pendant votre séjour ?',
  'Que comptez-vous faire à la fin de vos études ?',
];

const KNOWN_CITIES = ['Pise', 'Bologne', 'Milan', 'Rome', 'Turin', 'Padoue', 'Florence', 'Naples', 'Venise', 'Gênes'];

const noUsage = (): AiUsage => ({
  model: FAKE_MODEL,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  estimatedCost: 0,
});

const clamp = (value: number) => Math.max(0, Math.min(100, value));

function blockLine(block: string | undefined, label: string): string | null {
  const match = block?.match(new RegExp(`^- ${label} : (.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

// Simule le repérage des incohérences à partir du texte réellement transmis au modèle.
export function fakeReportFor(request: string): ReportOutput {
  const candidate = request
    .split('\n')
    .filter((line) => line.startsWith('Candidat : '))
    .map((line) => line.slice('Candidat : '.length))
    .join(' ');
  const lower = candidate.toLowerCase();
  const city = KNOWN_CITIES.find((name) => lower.includes(name.toLowerCase())) ?? 'non précisé';
  const words = candidate.split(/\s+/).filter(Boolean).length;
  const overall = clamp(40 + Math.round(words / 4));

  const profile = request.match(/<profil_declare>([\s\S]*?)<\/profil_declare>/)?.[1];
  const previous = request.match(/<entretien_precedent>([\s\S]*?)<\/entretien_precedent>/)?.[1];
  const inconsistencies: ReportOutput['inconsistencies'] = [];

  const declaredCities = blockLine(profile, 'Villes envisagées');
  if (declaredCities && city !== 'non précisé' && !declaredCities.toLowerCase().includes(city.toLowerCase())) {
    inconsistencies.push({
      topic: 'Ville d’études',
      source: 'profil',
      declared: `Villes envisagées : ${declaredCities}`,
      stated: `Ville évoquée : ${city}`,
      advice: 'Mettez votre profil à jour ou expliquez ce changement de ville.',
    });
  }
  const previousCity = blockLine(previous, 'Ville');
  if (previousCity && previousCity !== 'non précisé' && city !== 'non précisé' && previousCity.toLowerCase() !== city.toLowerCase()) {
    inconsistencies.push({
      topic: 'Ville d’études',
      source: 'entretien_precedent',
      declared: `Entretien précédent : ${previousCity}`,
      stated: `Cet entretien : ${city}`,
      advice: 'Gardez la même ville d’un entretien à l’autre, ou préparez une explication claire.',
    });
  }

  const keyFacts: KeyFacts = {
    field_of_study: lower.includes('informatique') ? 'informatique' : 'non précisé',
    institution: 'non précisé',
    city,
    financing: lower.includes('garant') ? 'garant' : lower.includes('famille') || lower.includes('oncle') ? 'famille' : 'non précisé',
    monthly_budget: 'non_precise',
    accommodation: lower.includes('résidence') ? 'résidence universitaire' : 'non précisé',
    intake: 'non précisé',
    after_studies: 'non précisé',
  };

  return {
    level: overall >= 70 ? 'satisfaisante' : overall >= 50 ? 'intermediaire' : 'faible',
    overall_score: overall,
    dimensions: {
      coherence_project: clamp(overall + 5),
      knowledge_university: clamp(overall - 5),
      financial_clarity: clamp(overall - 15),
      language_confidence: clamp(overall + 10),
      return_plan: clamp(overall),
      document_awareness: clamp(overall - 20),
    },
    summary: 'Rapport factice généré en mode développement (AI_PROVIDER=fake). Il ne reflète pas une évaluation réelle.',
    strengths: ['Présentation claire du projet.'],
    critical_risks: ['Budget mensuel non détaillé.'],
    recommended_actions: ['Préparer un budget mensuel détaillé.'],
    inconsistencies,
    key_facts: keyFacts,
    teacher_view: {
      summary: `Rapport factice : ${words} mots de réponse, ${inconsistencies.length} incohérence(s) repérée(s).`,
      follow_up_questions: ['Pouvez-vous détailler votre budget mensuel ?'],
      class_activities: ['Jeu de rôle sur le financement des études.'],
    },
  };
}

// Relit la question source dans la requête réellement construite : le chemin complet est testé sans clé.
export function fakeVariantsFor(request: string): QuestionVariantsOutput {
  const count = Number(request.match(/Rédigez (\d+) variante/)?.[1] ?? 1);
  const source = request.match(/<question_source>([\s\S]*?)<\/question_source>/)?.[1] ?? '';
  const statement = source.match(/^Énoncé : (.+)$/m)?.[1]?.trim() ?? 'Question';
  const options = [...source.matchAll(/^([A-F])\. (.+)$/gm)].map((match) => ({ key: match[1]!, text: match[2]!.trim() }));
  const correct = source.match(/^Bonne réponse : ([A-F])$/m)?.[1] ?? options[0]?.key ?? 'A';

  return {
    variants: Array.from({ length: count }, (_, index) => ({
      question_text: `[Variante factice ${index + 1}] ${statement}`,
      options: options.map((option) => ({ key: option.key, text: `${option.text} (v${index + 1})` })),
      correct_answer: correct,
      explanation: 'Variante factice générée en mode développement (AI_PROVIDER=fake) : à relire avant toute activation.',
    })),
  };
}

export const fakeProvider: AiProviderClient<ReportOutput> = {
  name: 'fake',
  model: () => FAKE_MODEL,
  isConfigured: () => true,

  async runConsulTurn(turns) {
    const asked = turns.filter((turn) => turn.role === 'assistant').length;
    const endInterview = asked >= QUESTIONS.length;
    const message = endInterview ? "Merci, l'entretien est terminé." : QUESTIONS[asked]!;
    return {
      message,
      endInterview,
      apiContent: { provider: 'fake', data: { message, end_interview: endInterview } },
      usage: noUsage(),
    };
  },

  async runReport(request) {
    return { usage: noUsage(), report: fakeReportFor(request) };
  },

  async runQuestionVariants(request) {
    return { usage: noUsage(), output: fakeVariantsFor(request) };
  },
};
