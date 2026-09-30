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
  choices?: { message?: { content?: string | null; reasoning_content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Tour d'entretien interactif : délai court ; rapport et variantes (tâche de fond) : délai long.
const TIMEOUT_MS: Record<string, number> = { embassy_turn: 60_000, embassy_report: 300_000, question_generation: 300_000 };
// Surcharge ou limite de débit passagères du catalogue : nouvelles tentatives espacées.
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [1_500, 4_000];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Modèle et niveau de raisonnement d'un appel : tours d'entretien rapides, rapport et variantes soignés.
interface CallOptions {
  model: string;
  reasoningEffort: string | null;
  // Annulation (requête de secours devenue inutile).
  signal?: AbortSignal;
}

const turnCall = (): CallOptions => ({ model: env.NVIDIA_TURN_MODEL, reasoningEffort: env.NVIDIA_TURN_REASONING_EFFORT ?? null });
const deepCall = (): CallOptions => ({ model: env.NVIDIA_MODEL, reasoningEffort: null });

function toUsage(usage: ChatCompletion['usage'], model: string): AiUsage {
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  return {
    model,
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

// Modèles qui refusent response_format ou reasoning_effort : mémorisés pour ne plus les envoyer.
const noStructuredOutput = new Set<string>();
const noReasoningEffort = new Set<string>();

async function complete(
  operation: string,
  messages: ChatMessage[],
  schema: z.ZodType,
  maxTokens: number,
  call: CallOptions,
  attempt = 0,
): Promise<{ text: string; usage: AiUsage }> {
  if (!env.NVIDIA_API_KEY) throw new AiError('unavailable', 'NVIDIA_API_KEY non configurée');
  const structured = !noStructuredOutput.has(call.model);
  const reasoning = call.reasoningEffort && !noReasoningEffort.has(call.model) ? call.reasoningEffort : null;
  const body = {
    model: call.model,
    messages,
    temperature: 0.4,
    max_tokens: maxTokens,
    stream: false,
    // Raisonnement réduit : latence divisée par 10 à 20 sur les modèles à raisonnement du catalogue.
    ...(reasoning ? { reasoning_effort: reasoning } : {}),
    ...(structured ? { response_format: { type: 'json_schema', json_schema: { name: operation, schema: toJsonSchema(schema) } } } : {}),
  };

  let response: Response;
  try {
    response = await fetch(`${env.NVIDIA_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: call.signal ? AbortSignal.any([call.signal, AbortSignal.timeout(TIMEOUT_MS[operation] ?? 120_000)]) : AbortSignal.timeout(TIMEOUT_MS[operation] ?? 120_000),
    });
  } catch (err) {
    if (call.signal?.aborted) throw new AiError('upstream', `${operation}: requête annulée`);
    logger.error({ operation, message: err instanceof Error ? err.message : undefined }, 'nvidia_network_error');
    throw new AiError('upstream', `${operation}: NVIDIA injoignable`);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    if (response.status === 400 && reasoning && /reasoning/i.test(detail)) {
      noReasoningEffort.add(call.model);
      logger.warn({ operation, model: call.model }, 'nvidia_reasoning_effort_unsupported');
      return complete(operation, messages, schema, maxTokens, call);
    }
    if (response.status === 400 && structured && /response_format|json_schema|guided/i.test(detail)) {
      noStructuredOutput.add(call.model);
      logger.warn({ operation, model: call.model }, 'nvidia_structured_output_unsupported');
      return complete(operation, messages, schema, maxTokens, call);
    }
    if (TRANSIENT_STATUSES.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
      logger.warn({ operation, status: response.status, attempt: attempt + 1 }, 'nvidia_retry');
      await sleep(RETRY_DELAYS_MS[attempt] as number);
      if (call.signal?.aborted) throw new AiError('upstream', `${operation}: requête annulée`);
      return complete(operation, messages, schema, maxTokens, call, attempt + 1);
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
  const choice = completion.choices?.[0];
  const text = choice?.message?.content ?? '';
  if (!text.trim() && structured) {
    // Certains modèles (ex. gpt-oss) renvoient un contenu vide avec response_format en conversation :
    // on le désactive pour ce modèle et on relance sans.
    noStructuredOutput.add(call.model);
    logger.warn({ operation, model: call.model }, 'nvidia_structured_output_empty');
    return complete(operation, messages, schema, maxTokens, call, attempt);
  }
  if (!text.trim()) {
    // Modèle à raisonnement : budget de tokens épuisé avant la réponse.
    logger.warn({ operation, finishReason: choice?.finish_reason, reasoning: Boolean(choice?.message?.reasoning_content) }, 'nvidia_empty_output');
    throw new AiError('invalid_output', `${operation}: réponse vide${choice?.finish_reason === 'length' ? ' (limite de tokens atteinte)' : ''}`);
  }
  return { text, usage: toUsage(completion.usage, call.model) };
}

// Une seconde tentative, avec l'erreur rappelée au modèle, si la réponse est hors schéma.
async function generate<S extends z.ZodType>(
  operation: string,
  request: { system: string; messages: ChatMessage[]; schema: S; maxTokens: number; call: CallOptions },
): Promise<{ output: z.infer<S>; text: string; usage: AiUsage }> {
  const messages: ChatMessage[] = [{ role: 'system', content: request.system + schemaInstruction(request.schema) }, ...request.messages];
  let usage: AiUsage | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let result: { text: string; usage: AiUsage };
    try {
      result = await complete(operation, messages, request.schema, request.maxTokens, request.call);
    } catch (err) {
      // Réponse vide : relancée comme une réponse hors schéma.
      if (err instanceof AiError && err.kind === 'invalid_output' && attempt < 2) continue;
      throw err;
    }
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

// Requête de secours (« hedging ») : si le modèle principal tarde (file d'attente de l'infrastructure
// partagée), la même question part vers le modèle de secours ; la première réponse valide l'emporte
// et l'autre requête est annulée. Pointes mesurées à 20 s ramenées sous ~7 s.
export async function hedged<T>(
  primary: (signal: AbortSignal) => Promise<T>,
  fallback: ((signal: AbortSignal) => Promise<T>) | null,
  delayMs: number,
): Promise<T> {
  if (!fallback) return primary(new AbortController().signal);
  const primaryAbort = new AbortController();
  const fallbackAbort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failures: unknown[] = [];

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let pending = 1;
    const win = (value: T, loser: AbortController) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      loser.abort();
      resolve(value);
    };
    const lose = (err: unknown, startFallbackNow: boolean) => {
      failures.push(err);
      pending--;
      if (settled) return;
      if (startFallbackNow && timer) {
        clearTimeout(timer);
        launchFallback();
      } else if (pending === 0) {
        settled = true;
        reject(failures[0]);
      }
    };
    const launchFallback = () => {
      timer = undefined;
      pending++;
      fallback(fallbackAbort.signal).then((value) => win(value, primaryAbort), (err) => lose(err, false));
    };
    primary(primaryAbort.signal).then((value) => win(value, fallbackAbort), (err) => lose(err, true));
    timer = setTimeout(launchFallback, delayMs);
  });
}

export const nvidiaProvider: AiProviderClient<ReportOutput> = {
  name: 'nvidia',
  // Modèle de l'entretien (enregistré sur la session) ; le rapport journalise le sien dans ai_usage_logs.
  model: () => env.NVIDIA_TURN_MODEL,
  isConfigured: () => Boolean(env.NVIDIA_API_KEY),

  async runConsulTurn(turns) {
    const run = (model: string) => (signal: AbortSignal) =>
      generate('embassy_turn', {
        system: CONSUL_SYSTEM_PROMPT,
        messages: toNvidiaMessages(turns),
        schema: consulTurnSchema,
        maxTokens: 1500,
        call: { ...turnCall(), model, signal },
      });
    const fallbackModel = env.NVIDIA_TURN_FALLBACK_MODEL;
    const { output, text, usage } = await hedged(
      run(env.NVIDIA_TURN_MODEL),
      fallbackModel && fallbackModel !== env.NVIDIA_TURN_MODEL ? run(fallbackModel) : null,
      env.NVIDIA_TURN_HEDGE_MS,
    );
    if (!output.message.trim()) throw new AiError('invalid_output', 'embassy_turn: message vide');
    return { message: output.message.trim(), endInterview: output.end_interview, apiContent: { provider: 'nvidia', data: text }, usage };
  },

  async runReport(request) {
    const { output, usage } = await generate('embassy_report', {
      system: REPORT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: request }],
      schema: reportOutputSchema,
      maxTokens: 8000,
      call: deepCall(),
    });
    return { report: output, usage };
  },

  async runQuestionVariants(request) {
    const { output, usage } = await generate('question_generation', {
      system: QUESTION_VARIANTS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: request }],
      schema: questionVariantsSchema,
      maxTokens: 8000,
      call: deepCall(),
    });
    return { output, usage };
  },
};
