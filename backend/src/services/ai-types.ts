import type { QuestionVariantsOutput } from './question-variants.js';

export type AiProviderName = 'nvidia' | 'gemini' | 'claude' | 'fake';

export type AiErrorKind = 'unavailable' | 'rate_limited' | 'refusal' | 'invalid_output' | 'upstream';

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  estimatedCost: number;
}

// Tour neutre, indépendant du fournisseur. `raw` : contenu brut stocké lors d'un tour de l'agent.
export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
  raw?: unknown;
}

// Format de embassy_messages.api_content : rejoué tel quel uniquement par le fournisseur qui l'a produit.
export interface StoredApiContent {
  provider: AiProviderName;
  data: unknown;
}

export function replayableRaw(turn: ConversationTurn, provider: AiProviderName): unknown {
  const raw = turn.raw as Partial<StoredApiContent> | null | undefined;
  return raw && raw.provider === provider ? raw.data : undefined;
}

export interface ConsulTurn {
  message: string;
  endInterview: boolean;
  apiContent: StoredApiContent;
  usage: AiUsage;
}

export interface AiProviderClient<Report> {
  readonly name: AiProviderName;
  model(): string;
  isConfigured(): boolean;
  runConsulTurn(turns: ConversationTurn[]): Promise<ConsulTurn>;
  runReport(request: string): Promise<{ report: Report; usage: AiUsage }>;
  // EF-07 : variantes d'une question de la banque (aucune donnée personnelle transmise).
  runQuestionVariants(request: string): Promise<{ output: QuestionVariantsOutput; usage: AiUsage }>;
}

export function roundCost(cost: number): number {
  return Math.round(cost * 1_000_000) / 1_000_000;
}
