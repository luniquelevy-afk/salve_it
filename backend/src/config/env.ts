import { z } from 'zod';

if (!['production', 'test'].includes(process.env.NODE_ENV ?? '')) {
  try {
    // ENV_FILE : autre fichier ponctuellement (ex. .env.production pour migrer la base de production).
    process.loadEnvFile(process.env.ENV_FILE ?? '.env');
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
    // ── Firebase (Firestore, Auth, Storage) ──
    FIREBASE_PROJECT_ID: z.string().trim().min(1),
    // Compte de service (JSON brut ou encodé en base64) : backend uniquement, jamais exposé (CDC §18).
    // Absent en local : les émulateurs (FIRESTORE_EMULATOR_HOST…) n'en ont pas besoin.
    FIREBASE_SERVICE_ACCOUNT: optionalSecret,
    FIREBASE_STORAGE_BUCKET: optionalSecret,
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:5173')
      .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
    REQUIRE_ADMIN_MFA: flag('true'),

    // ── IA (clés confinées au backend, CDC §17.2) ──
    // fake : agent déterministe pour développer sans clé ni coût (interdit en production).
    // nvidia (défaut) : API NVIDIA NIM compatible OpenAI ; gemini et claude restent disponibles.
    AI_PROVIDER: z.enum(['nvidia', 'gemini', 'claude', 'fake']).default('nvidia'),
    NVIDIA_API_KEY: optionalSecret,
    // Catalogue hébergé par défaut ; un NIM auto-hébergé ou sous licence AI Enterprise se branche ici.
    NVIDIA_BASE_URL: z.url().default('https://integrate.api.nvidia.com/v1'),
    NVIDIA_MODEL: z.string().trim().min(1).default('meta/llama-3.3-70b-instruct'),
    // L'essai gratuit (build.nvidia.com) interdit la production et les données personnelles :
    // true uniquement avec un accès de production (licence NVIDIA AI Enterprise ou NIM auto-hébergé).
    NVIDIA_PRODUCTION_ACCESS: flag('false'),
    NVIDIA_INPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    NVIDIA_OUTPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    GEMINI_API_KEY: optionalSecret,
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
    // Palier payant Google AI : contenu non réutilisé pour améliorer les produits Google.
    GEMINI_PAID_TIER: flag('false'),
    // Tarifs du palier payant en $ par million de tokens (page tarifs Gemini) ; 0 sur le palier gratuit.
    GEMINI_INPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    GEMINI_OUTPUT_PRICE_PER_MTOK: z.coerce.number().min(0).default(0),
    ANTHROPIC_API_KEY: optionalSecret,

    // ── Notifications (§15) ──
    // Absent : les emails restent en file avec le statut « skipped » (cas local, sans serveur SMTP).
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
    for (const variable of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
      if (process.env[variable]) {
        ctx.addIssue({ code: 'custom', path: [variable], message: 'Les émulateurs Firebase sont interdits en production.' });
      }
    }
    // Signature des URL de téléchargement (documents) : exige la clé privée du compte de service.
    if (!value.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      ctx.addIssue({ code: 'custom', path: ['FIREBASE_SERVICE_ACCOUNT'], message: 'Compte de service Firebase requis en production.' });
    }
    if (value.AI_PROVIDER === 'fake') {
      ctx.addIssue({ code: 'custom', path: ['AI_PROVIDER'], message: "L'agent factice est interdit en production." });
    }
    // Conditions du palier gratuit Gemini : « Do not submit sensitive, confidential, or personal
    // information to the Unpaid Services ». Les entretiens de visa sont des données sensibles (ENF-02).
    // Conditions de l'essai API NVIDIA : évaluation uniquement, sans production ni données personnelles
    // (les entretiens de visa en contiennent, ENF-02).
    if (value.AI_PROVIDER === 'nvidia' && !value.NVIDIA_PRODUCTION_ACCESS) {
      ctx.addIssue({
        code: 'custom',
        path: ['NVIDIA_PRODUCTION_ACCESS'],
        message: "En production, NVIDIA exige un accès de production (AI Enterprise ou NIM auto-hébergé) : l'essai gratuit interdit les données personnelles.",
      });
    }
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
