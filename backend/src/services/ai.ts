// AIService : point d'accès unique à l'IA, fournisseur choisi par AI_PROVIDER.
import { env } from '../config/env.js';
import { claudeProvider } from './ai-claude.js';
import { fakeProvider } from './ai-fake.js';
import { geminiProvider } from './ai-gemini.js';
import type { AiProviderClient, AiUsage, ConsulTurn, ConversationTurn } from './ai-types.js';
import type { ReportOutput } from './embassy-prompts.js';
import type { QuestionVariantsOutput } from './question-variants.js';

export { AiError } from './ai-types.js';
export type { AiUsage, ConsulTurn, ConversationTurn } from './ai-types.js';

const PROVIDERS: Record<typeof env.AI_PROVIDER, AiProviderClient<ReportOutput>> = {
  gemini: geminiProvider,
  claude: claudeProvider,
  fake: fakeProvider,
};

function provider(): AiProviderClient<ReportOutput> {
  return PROVIDERS[env.AI_PROVIDER];
}

export function activeProviderName() {
  return provider().name;
}

export function activeModel(): string {
  return provider().model();
}

export function isAiConfigured(): boolean {
  return provider().isConfigured();
}

export function runConsulTurn(turns: ConversationTurn[]): Promise<ConsulTurn> {
  return provider().runConsulTurn(turns);
}

export function runEmbassyReport(request: string): Promise<{ report: ReportOutput; usage: AiUsage }> {
  return provider().runReport(request);
}

export function runQuestionVariants(request: string): Promise<{ output: QuestionVariantsOutput; usage: AiUsage }> {
  return provider().runQuestionVariants(request);
}
