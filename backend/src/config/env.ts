import { z } from 'zod';

if (!['production', 'test'].includes(process.env.NODE_ENV ?? '')) {
  try {
    process.loadEnvFile();
  } catch {
    // Pas de .env local : les variables viennent de l'environnement.
  }
}

const flag = (fallback: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(fallback)
    .transform((value) => value === 'true');

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
    REQUIRE_ADMIN_MFA: flag('true'),

    // ── IA (clés confinées au backend, CDC §17.2) ──
    // fake : agent déterministe pour développer sans clé ni coût (interdit en production).
    AI_PROVIDER: z.enum(['gemini', 'claude', 'fake']).default('gemini'),
    GEMINI_API_KEY: optionalSecret,
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
    // Palier payant Google AI : contenu non réutilisé pour améliorer les produits Google.
    GEMINI_PAID_TIER: flag('false'),
    // Tarifs du palier payant en $ par million de tokens (page tarifs Gemini) ; 0 sur le palier gratuit.
    GEMINI_INPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    GEMINI_OUTPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    ANTHROPIC_API_KEY: optionalSecret,

    // ── Notifications (§15) ──
    // Absent : les emails restent en file avec le statut « skipped ». En local : smtp://127.0.0.1:54325 (Mailpit).
    SMTP_URL: optionalSecret,
    EMAIL_FROM: z.string().trim().min(3).default('Salve Italia <no-reply@salve-italia.local>'),
    // Base des liens envoyés par email.
    APP_URL: z.url().default('http://localhost:5173'),

    // EF-22 / EF-59 — valeurs par défaut à valider avec le centre.
    EMBASSY_MAX_TURNS: z.coerce.number().int().min(2).max(30).default(12),
    EMBASSY_WEEKLY_SESSION_LIMIT: z.coerce.number().int().min(1).default(5),
    EMBASSY_MONTHLY_COST_LIMIT_USD: z.coerce.number().positive().default(5),
    // Plafond par entretien : au-delà, l'entretien est clôturé proprement (EF-59).
    EMBASSY_SESSION_COST_LIMIT_USD: z.coerce.number().positive().default(1),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    if (value.AI_PROVIDER === 'fake') {
      ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: "L'agent factice est interdit en production." });
    }
    // Conditions du palier gratuit Gemini : « Do not submit sensitive, confidential, or personal
    // information to the Unpaid Services ». Les entretiens de visa sont des données sensibles (ENF-02).
    if (value.AI_PROVIDER === 'gemini' && !value.GEMINI_PAID_TIER) {
      ctx.addIssue({
        code: 'custom',
        path: ['GEMINI_PAID_TIER'],
        message: 'En production, Gemini exige le palier payant (données personnelles interdites sur le palier gratuit).',
      });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Configuration invalide (voir backend/.env.example) :\n${details}`);
}

export const env = parsed.data;
