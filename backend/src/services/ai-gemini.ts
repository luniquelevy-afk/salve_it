// Fournisseur Gemini (Interactions API, SDK @google/genai) — mode sans état : store=false,
// historique renvoyé à chaque tour avec les étapes brutes du modèle.
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AiError, replayableRaw, roundCost, type AiProviderClient, type AiUsage, type ConversationTurn } from './ai-types.js';
import { CONSUL_SYSTEM_PROMPT, consulTurnSchema, REPORT_SYSTEM_PROMPT, reportOutputSchema, type ReportOutput } from './embassy-prompts.js';
import { QUESTION_VARIANTS_SYSTEM_PROMPT, questionVariantsSchema } from './question-variants.js';

type CreateParams = Parameters<GoogleGenAI['interactions']['create']>[0];
type GeminiInput = CreateParams['input'];
type GeminiStep = Record<string, unknown> & { type: string };
type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

// Au-delà, les bornes ajoutées par z.int() (entiers sûrs JS) n'apportent rien et alourdissent le schéma.
const MAX_MEANINGFUL_BOUND = 1e12;

// Gemini n'accepte qu'un sous-ensemble de JSON Schema : on retire ce qui n'y figure pas.
export function toGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key, value]) => {
          if (key === '$schema' || key === 'additionalProperties') return false;
          if ((key === 'minimum' || key === 'maximum') && typeof value === 'number') return Math.abs(value) < MAX_MEANINGFUL_BOUND;
          return true;
        })
        .map(([key, value]) => [key, clean(value)]),
    );
  };
  return clean(z.toJSONSchema(schema)) as Record<string, unknown>;
}

export function toGeminiInput(turns: ConversationTurn[]): GeminiStep[] {
  return turns.flatMap((turn): GeminiStep[] => {
    if (turn.role === 'user') return [{ type: 'user_input', content: [{ type: 'text', text: turn.text }] }];
    const raw = replayableRaw(turn, 'gemini');
    if (Array.isArray(raw) && raw.length > 0) return raw as GeminiStep[];
    return [{ type: 'model_output', content: [{ type: 'text', text: turn.text }] }];
  });
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) throw new AiError('unavailable', 'GEMINI_API_KEY non configurée');
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

function toUsage(usage: { total_input_tokens?: number; total_output_tokens?: number; total_thought_tokens?: number; total_cached_tokens?: number } | undefined): AiUsage {
  const inputTokens = usage?.total_input_tokens ?? 0;
  // Les tokens de réflexion sont facturés comme des tokens de sortie.
  const outputTokens = (usage?.total_output_tokens ?? 0) + (usage?.total_thought_tokens ?? 0);
  const estimatedCost = env.GEMINI_PAID_TIER
    ? roundCost((inputTokens * env.GEMINI_INPUT_PRICE_PER_MTOK + outputTokens * env.GEMINI_OUTPUT_PRICE_PER_MTOK) / 1_000_000)
    : 0;
  return {
    model: env.GEMINI_MODEL,
    inputTokens,
    outputTokens,
    cacheReadInputTokens: usage?.total_cached_tokens ?? 0,
    cacheCreationInputTokens: 0,
    estimatedCost,
  };
}

async function generate<S extends z.ZodType>(
  operation: string,
  request: { system: string; input: GeminiStep[]; schema: S; thinking: ThinkingLevel; maxOutputTokens: number },
): Promise<{ output: z.infer<S>; steps: GeminiStep[]; text: string; usage: AiUsage }> {
  let interaction;
  try {
    interaction = await getClient().interactions.create({
      model: env.GEMINI_MODEL,
      store: false,
      system_instruction: request.system,
      input: request.input as unknown as GeminiInput,
      response_format: { type: 'text', mime_type: 'application/json', schema: toGeminiSchema(request.schema) },
      generation_config: { thinking_level: request.thinking, max_output_tokens: request.maxOutputTokens },
    });
  } catch (err) {
    if (err instanceof AiError) throw err;
    const status = (err as { status?: unknown }).status;
    if (status === 429) throw new AiError('rate_limited', `${operation}: quota Gemini atteint`);
    if (status === 401 || status === 403) {
      logger.error({ operation, status }, 'gemini_auth_error');
      throw new AiError('unavailable', `${operation}: authentification Gemini refusée`);
    }
    logger.error({ operation, status, message: err instanceof Error ? err.message : undefined }, 'gemini_api_error');
    throw new AiError('upstream', `${operation}: erreur Gemini ${typeof status === 'number' ? status : 'réseau'}`);
  }

  if (interaction.status !== 'completed') {
    throw new AiError('invalid_output', `${operation}: interaction ${interaction.status}`);
  }

  const text = interaction.output_text ?? '';
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError('invalid_output', `${operation}: réponse non JSON`);
  }
  const parsed = request.schema.safeParse(json);
  if (!parsed.success) throw new AiError('invalid_output', `${operation}: réponse hors schéma`);

  const steps = ((interaction.steps ?? []) as unknown as GeminiStep[]).filter((step) => step.type === 'model_output' || step.type === 'thought');
  return { output: parsed.data, steps, text, usage: toUsage(interaction.usage) };
}

export const geminiProvider: AiProviderClient<ReportOutput> = {
  name: 'gemini',
  model: () => env.GEMINI_MODEL,
  isConfigured: () => Boolean(env.GEMINI_API_KEY),

  async runConsulTurn(turns) {
    const { output, steps, text, usage } = await generate('embassy_turn', {
      system: CONSUL_SYSTEM_PROMPT,
      input: toGeminiInput(turns),
      schema: consulTurnSchema,
      // Réflexion légère : tour de parole court, latence perçue < 3 s visée (ENF-06).
      thinking: 'low',
      maxOutputTokens: 2000,
    });
    if (!output.message.trim()) throw new AiError('invalid_output', 'embassy_turn: message vide');
    return {
      message: output.message.trim(),
      endInterview: output.end_interview,
      apiContent: { provider: 'gemini', data: steps.length > 0 ? steps : [{ type: 'model_output', content: [{ type: 'text', text }] }] },
      usage,
    };
  },

  async runReport(request) {
    const { output, usage } = await generate('embassy_report', {
      system: REPORT_SYSTEM_PROMPT,
      input: [{ type: 'user_input', content: [{ type: 'text', text: request }] }],
      schema: reportOutputSchema,
      thinking: 'high',
      maxOutputTokens: 16000,
    });
    return { report: output, usage };
  },

  async runQuestionVariants(request) {
    const { output, usage } = await generate('question_generation', {
      system: QUESTION_VARIANTS_SYSTEM_PROMPT,
      input: [{ type: 'user_input', content: [{ type: 'text', text: request }] }],
      schema: questionVariantsSchema,
      // Calculs et raisonnements à vérifier : réflexion approfondie.
      thinking: 'high',
      maxOutputTokens: 16000,
    });
    return { output, usage };
  },
};
