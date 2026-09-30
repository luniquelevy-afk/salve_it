// Fournisseur NVIDIA (API NIM compatible OpenAI : /v1/chat/completions, clé « nvapi-… »).
// Même point d'accès pour le catalogue hébergé (integrate.api.nvidia.com) et pour un NIM
// auto-hébergé ou sous licence AI Enterprise : seul NVIDIA_BASE_URL change.
//
// Les modèles du catalogue ne gèrent pas tous la sortie structurée : le schéma JSON est
// demandé via response_format (retiré si le modèle le refuse) ET rappelé dans les instructions ;
// la réponse est toujours validée par zod, avec une seconde tentative si elle est hors schéma.
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AiError, replayableRaw, roundCost, type AiProviderClient, type AiUsage, type ConversationTurn } from './ai-types.js';
import { CONSUL_SYSTEM_PROMPT, consulTurnSchema, REPORT_SYSTEM_PROMPT, reportOutputSchema, type ReportOutput } from './embassy-prompts.js';
import { QUESTION_VARIANTS_SYSTEM_PROMPT, questionVariantsSchema } from './question-variants.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const REQUEST_TIMEOUT_MS = 120_000;

// Schéma JSON lisible par le modèle (sans métadonnées superflues).
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

export function schemaInstruction(schema: z.ZodType): string {
  return `\n\nFormat de réponse OBLIGATOIRE : un unique objet JSON valide, sans texte avant ni après, sans bloc de code, conforme à ce schéma JSON :\n${JSON.stringify(toJsonSchema(schema))}`;
}

// Extrait l'objet JSON d'une réponse : retire un éventuel raisonnement <think>…</think> et les blocs ```json.
export function extractJson(text: string): unknown {
  const withoutThinking = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(withoutThinking);
  const candidate = (fenced?.[1] ?? withoutThinking).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('invalid_output', 'réponse sans objet JSON');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiError('invalid_output', 'réponse JSON illisible');
  }
}

// Tours de l'entretien : le contenu brut stocké est le texte JSON renvoyé par le modèle.
export function toNvidiaMessages(turns: ConversationTurn[]): ChatMessage[] {
  return turns.map((turn): ChatMessage => {
    if (turn.role === 'user') return { role: 'user', content: turn.text };
    const raw = replayableRaw(turn, 'nvidia');
    return { role: 'assistant', content: typeof raw === 'string' ? raw : JSON.stringify({ message: turn.text, end_interview: false }) };
  });
}

function toUsage(usage: ChatCompletion['usage']): AiUsage {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  return {
    model: env.NVIDIA_MODEL,
    inputTokens,
    outputTokens,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    estimatedCost: roundCost((inputTokens * env.NVIDIA_INPUT_PRICE_PER_MTOK + outputTokens * env.NVIDIA_OUTPUT_PRICE_PER_MTOK) / 1_000_000),
  };
}

function addUsage(a: AiUsage, b: AiUsage): AiUsage {
  return {
    ...a,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    estimatedCost: roundCost(a.estimatedCost + b.estimatedCost),
  };
}

// Modèles qui refusent response_format : mémorisés pour ne plus l'envoyer.
const noStructuredOutput = new Set<string>();

async function complete(operation: string, messages: ChatMessage[], schema: z.ZodType, maxTokens: number): Promise<{ text: string; usage: AiUsage }> {
  if (!env.NVIDIA_API_KEY) throw new AiError('unavailable', 'NVIDIA_API_KEY non configurée');
  const structured = !noStructuredOutput.has(env.NVIDIA_MODEL);
  const body = {
    model: env.NVIDIA_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
    stream: false,
    ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: operation, schema: toJsonSchema(schema) } } } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${env.NVIDIA_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ operation, message: err instanceof Error ? err.message : undefined }, 'nvidia_network_error');
    throw new AiError('upstream', `${operation}: NVIDIA injoignable`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    if (response.status === 400 && structured && /response_format|json_schema|guided/i.test(detail)) {
      noStructuredOutput.add(env.NVIDIA_MODEL);
      logger.warn({ operation, model: env.NVIDIA_MODEL }, 'nvidia_structured_output_unsupported');
      return complete(operation, messages, schema, maxTokens);
    }
    if (response.status === 429) throw new AiError('rate_limited', `${operation}: quota NVIDIA atteint`);
    if (response.status === 401 || response.status === 403) {
      logger.error({ operation, status: response.status }, 'nvidia_auth_error');
      throw new AiError('unavailable', `${operation}: authentification NVIDIA refusée`);
    }
    logger.error({ operation, status: response.status, detail }, 'nvidia_api_error');
    throw new AiError('upstream', `${operation}: erreur NVIDIA ${response.status}`);
  }

  const completion = (await response.json()) as ChatCompletion;
  const text = completion.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new AiError('invalid_output', `${operation}: réponse vide`);
  return { text, usage: toUsage(completion.usage) };
}

// Une seconde tentative, avec l'erreur rappelée au modèle, si la réponse est hors schéma.
async function generate<S extends z.ZodType>(
  operation: string,
  request: { system: string; messages: ChatMessage[]; schema: S; maxTokens: number },
): Promise<{ output: z.infer<S>; text: string; usage: AiUsage }> {
  const messages: ChatMessage[] = [{ role: 'system', content: request.system + schemaInstruction(request.schema) }, ...request.messages];
  let usage: AiUsage | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await complete(operation, messages, request.schema, request.maxTokens);
    usage = usage ? addUsage(usage, result.usage) : result.usage;
    let problem: string;
    try {
      const parsed = request.schema.safeParse(extractJson(result.text));
      if (parsed.success) return { output: parsed.data, text: JSON.stringify(parsed.data), usage };
      problem = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'racine'} : ${issue.message}`).join(' ; ');
    } catch (err) {
      problem = err instanceof Error ? err.message : 'réponse illisible';
    }
    logger.warn({ operation, attempt, problem }, 'nvidia_invalid_output');
    messages.push({ role: 'assistant', content: result.text }, { role: 'user', content: `Réponse non conforme (${problem}). Renvoie uniquement l'objet JSON corrigé, conforme au schéma.` });
  }
  throw new AiError('invalid_output', `${operation}: réponse hors schéma`);
}

export const nvidiaProvider: AiProviderClient<ReportOutput> = {
  name: 'nvidia',
  model: () => env.NVIDIA_MODEL,
  isConfigured: () => Boolean(env.NVIDIA_API_KEY),

  async runConsulTurn(turns) {
    const { output, text, usage } = await generate('embassy_turn', {
      system: CONSUL_SYSTEM_PROMPT,
      messages: toNvidiaMessages(turns),
      schema: consulTurnSchema,
      maxTokens: 1500,
    });
    if (!output.message.trim()) throw new AiError('invalid_output', 'embassy_turn: message vide');
    return { message: output.message.trim(), endInterview: output.end_interview, apiContent: { provider: 'nvidia', data: text }, usage };
  },

  async runReport(request) {
    const { output, usage } = await generate('embassy_report', {
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: request }],
      schema: reportOutputSchema,
      maxTokens: 8000,
    });
    return { report: output, usage };
  },

  async runQuestionVariants(request) {
    const { output, usage } = await generate('question_generation', {
      system: QUESTION_VARIANTS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: request }],
      schema: questionVariantsSchema,
      maxTokens: 8000,
    });
    return { output, usage };
  },
};
