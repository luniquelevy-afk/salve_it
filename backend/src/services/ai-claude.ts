// Fournisseur Claude (optionnel, AI_PROVIDER=claude).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AiError, replayableRaw, roundCost, type AiProviderClient, type AiUsage, type ConversationTurn } from './ai-types.js';
import { CONSUL_SYSTEM_PROMPT, consulTurnSchema, REPORT_SYSTEM_PROMPT, reportOutputSchema, type ReportOutput } from './embassy-prompts.js';
import { QUESTION_VARIANTS_SYSTEM_PROMPT, questionVariantsSchema } from './question-variants.js';

export const CLAUDE_MODEL = 'claude-opus-5';

// Si le filtre de sécurité décline une requête, l'API la relance côté serveur sur le modèle de repli recommandé.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Tarifs publics en $ par million de tokens (à revérifier avant mise en production).
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

export function estimateClaudeCost(model: string, usage: Omit<AiUsage, 'model' | 'estimatedCost'>): number {
  const price = PRICING[model] ?? PRICING[CLAUDE_MODEL]!;
  return roundCost(
    (usage.inputTokens * price.input +
      usage.cacheCreationInputTokens * price.input * 1.25 +
      usage.cacheReadInputTokens * price.input * 0.1 +
      usage.outputTokens * price.output) /
      1_000_000,
  );
}

function toUsage(response: { model: string; usage: Anthropic.Beta.BetaUsage }): AiUsage {
  const tokens = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
  return { model: response.model, ...tokens, estimatedCost: estimateClaudeCost(response.model, tokens) };
}

export function toClaudeMessages(turns: ConversationTurn[]): Anthropic.Beta.BetaMessageParam[] {
  return turns.map((turn) => {
    if (turn.role === 'user') return { role: 'user', content: turn.text };
    const raw = replayableRaw(turn, 'claude');
    return { role: 'assistant', content: Array.isArray(raw) ? (raw as Anthropic.Beta.BetaContentBlockParam[]) : turn.text };
  });
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new AiError('unavailable', 'ANTHROPIC_API_KEY non configurée');
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  return client;
}

async function callApi<T>(operation: string, request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Anthropic.RateLimitError) throw new AiError('rate_limited', `${operation}: rate limited`);
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      logger.error({ operation, status: err.status }, 'anthropic_auth_error');
      throw new AiError('unavailable', `${operation}: authentication failed`);
    }
    if (err instanceof Anthropic.APIError) {
      logger.error({ operation, status: err.status, requestId: err.requestID }, 'anthropic_api_error');
      throw new AiError('upstream', `${operation}: API error ${err.status ?? 'connection'}`);
    }
    throw err;
  }
}

// Le SDK ajoute parsed_output aux blocs texte : on ne rejoue que ce que l'API a renvoyé.
function toReplayableContent(content: readonly object[]): object[] {
  return content.map((block) => {
    if (!('parsed_output' in block)) return block;
    const { parsed_output: _parsed, ...rest } = block as Record<string, unknown>;
    return rest;
  });
}

export const claudeProvider: AiProviderClient<ReportOutput> = {
  name: 'claude',
  model: () => CLAUDE_MODEL,
  isConfigured: () => Boolean(env.ANTHROPIC_API_KEY),

  async runConsulTurn(turns) {
    const response = await callApi('embassy_turn', () =>
      getClient().beta.messages.parse(
        {
          model: CLAUDE_MODEL,
          max_tokens: 4000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort: 'low', format: betaZodOutputFormat(consulTurnSchema) },
          system: [{ type: 'text', text: CONSUL_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: toClaudeMessages(turns),
        },
        { timeout: 45_000 },
      ),
    );

    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'embassy_turn: refusal');
    const parsed = response.parsed_output;
    if (response.stop_reason === 'max_tokens' || !parsed || !parsed.message.trim()) {
      throw new AiError('invalid_output', `embassy_turn: unusable output (${response.stop_reason})`);
    }
    return {
      message: parsed.message.trim(),
      endInterview: parsed.end_interview,
      apiContent: { provider: 'claude', data: toReplayableContent(response.content) },
      usage: toUsage(response),
    };
  },

  async runReport(request) {
    const response = await callApi('embassy_report', () =>
      getClient().beta.messages.parse(
        {
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high', format: betaZodOutputFormat(reportOutputSchema) },
          system: [{ type: 'text', text: REPORT_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: request }],
        },
        { timeout: 180_000 },
      ),
    );

    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'embassy_report: refusal');
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new AiError('invalid_output', `embassy_report: unusable output (${response.stop_reason})`);
    }
    return { report: response.parsed_output, usage: toUsage(response) };
  },

  async runQuestionVariants(request) {
    const response = await callApi('question_generation', () =>
      getClient().beta.messages.parse(
        {
          model: CLAUDE_MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          // Calculs et raisonnements à vérifier : effort élevé plutôt que rapidité.
          output_config: { effort: 'high', format: betaZodOutputFormat(questionVariantsSchema) },
          system: [{ type: 'text', text: QUESTION_VARIANTS_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: request }],
        },
        { timeout: 180_000 },
      ),
    );

    if (response.stop_reason === 'refusal') throw new AiError('refusal', 'question_generation: refusal');
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new AiError('invalid_output', `question_generation: unusable output (${response.stop_reason})`);
    }
    return { output: response.parsed_output, usage: toUsage(response) };
  },
};
