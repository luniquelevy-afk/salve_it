// Phase 5 — site vitrine : contenu public, formulaire de contact, administration du contenu et des prospects.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { adminOnly, authOf } from '../middleware/auth.js';
import { createLead, LEAD_STATUSES, listLeads, updateLead } from '../services/leads.js';
import {
  faqItems,
  galleryImages,
  getPublicProgram,
  getPublicSite,
  getSiteSettings,
  listProgramsWithPublicFields,
  testimonials,
  updateProgramPublic,
  updateSiteSettings,
} from '../services/site-content.js';

const idSchema = z.uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value || null);
const httpsUrl = z
  .url({ protocol: /^https$/, message: 'Lien https requis.' })
  .max(2000)
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));
const displayOrder = z.number().int().min(0).max(10_000).default(0);
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

// ── Public ──────────────────────────────────────────────────

export const publicSiteRouter = Router();

publicSiteRouter.get('/site', async (_req, res) => {
  // Contenu public peu changeant : cache court côté navigateur et CDN.
  res.set('Cache-Control', 'public, max-age=60');
  res.json(await getPublicSite());
});

publicSiteRouter.get('/programs/:slug', async (req, res) => {
  const slug = z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80)
    .parse(req.params.slug);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ program: await getPublicProgram(slug) });
});

// Formulaire public sans compte : limite stricte par adresse IP.
const contactLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

const contactSchema = z
  .strictObject({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional(),
    email: z.email().max(200).optional().or(z.literal('')),
    desiredProgram: z.string().trim().max(120).optional(),
    message: z.string().trim().max(2000).optional(),
    consent: z.literal(true, { message: 'Le consentement est requis.' }),
    // Champ piège invisible pour les humains : rempli uniquement par les robots.
    website: z.string().max(200).optional(),
  })
  .refine((input) => Boolean(input.phone || input.email), { message: 'Indiquez un téléphone ou un email.', path: ['phone'] });

publicSiteRouter.post('/contact', contactLimiter, async (req, res) => {
  const input = contactSchema.parse(req.body);
  if (input.website) {
    // Robot probable : réponse identique à un succès, rien n'est enregistré.
    res.status(201).json({ received: true });
    return;
  }
  await createLead({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || undefined,
    desiredProgram: input.desiredProgram,
    message: input.message,
    source: 'contact_form',
  });
  res.status(201).json({ received: true });
});

// ── Administration du contenu ───────────────────────────────

export const adminSiteRouter = Router();

adminSiteRouter.use(...adminOnly);

const settingsSchema = z.strictObject({
  centreName: z.string().trim().min(1).max(120),
  tagline: optionalText(200),
  about: optionalText(5000),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z.email().max(200).nullable().optional().or(z.literal('').transform(() => null)).transform((value) => value ?? null),
  address: optionalText(300),
  openingHours: optionalText(300),
  facebookUrl: httpsUrl.transform((value) => value ?? null),
  instagramUrl: httpsUrl.transform((value) => value ?? null),
  mapUrl: httpsUrl.transform((value) => value ?? null),
  keyFigures: z
    .array(z.strictObject({ value: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(80) }))
    .max(6)
    .default([]),
});

adminSiteRouter.get('/settings', async (_req, res) => {
  res.json({ settings: await getSiteSettings() });
});

adminSiteRouter.put('/settings', writeLimiter, async (req, res) => {
  res.json({ settings: await updateSiteSettings(authOf(req).userId, settingsSchema.parse(req.body)) });
});

adminSiteRouter.get('/programs', async (_req, res) => {
  res.json({ programs: await listProgramsWithPublicFields() });
});

adminSiteRouter.put('/programs/:id', writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      slug: z.string().trim().max(80).nullable().optional(),
      isPublic: z.boolean(),
      summary: optionalText(300),
      description: optionalText(5000),
      durationLabel: optionalText(120),
      scheduleLabel: optionalText(200),
      audience: optionalText(300),
      objectives: z.array(z.string().trim().max(300)).max(12).default([]),
      displayOrder,
    })
    .parse(req.body);
  res.json({ program: await updateProgramPublic(authOf(req).userId, idSchema.parse(req.params.id), input) });
});

function mountCollection<Input>(
  path: string,
  schema: z.ZodType<Input>,
  store: {
    list: (onlyPublished: boolean) => Promise<unknown[]>;
    create: (actorId: string, input: Input) => Promise<unknown>;
    update: (actorId: string, id: string, input: Input) => Promise<unknown>;
    remove: (actorId: string, id: string) => Promise<void>;
  },
) {
  adminSiteRouter.get(`/${path}`, async (_req, res) => {
    res.json({ items: await store.list(false) });
  });
  adminSiteRouter.post(`/${path}`, writeLimiter, async (req, res) => {
    res.status(201).json({ item: await store.create(authOf(req).userId, schema.parse(req.body)) });
  });
  adminSiteRouter.put(`/${path}/:id`, writeLimiter, async (req, res) => {
    res.json({ item: await store.update(authOf(req).userId, idSchema.parse(req.params.id), schema.parse(req.body)) });
  });
  adminSiteRouter.delete(`/${path}/:id`, async (req, res) => {
    await store.remove(authOf(req).userId, idSchema.parse(req.params.id));
    res.status(204).end();
  });
}

mountCollection(
  'testimonials',
  z
    .strictObject({
      authorName: z.string().trim().min(1).max(120),
      authorContext: optionalText(160),
      quote: z.string().trim().min(1).max(1500),
      photoUrl: httpsUrl.transform((value) => value ?? null),
      consentConfirmed: z.boolean(),
      isPublished: z.boolean(),
      displayOrder,
    })
    .refine((input) => !input.isPublished || input.consentConfirmed, {
      message: 'Un témoignage ne peut être publié sans l’accord de la personne.',
      path: ['consentConfirmed'],
    }),
  testimonials,
);

mountCollection(
  'faq',
  z.strictObject({
    question: z.string().trim().min(1).max(300),
    answer: z.string().trim().min(1).max(3000),
    isPublished: z.boolean(),
    displayOrder,
  }),
  faqItems,
);

mountCollection(
  'gallery',
  z.strictObject({
    imageUrl: z.url({ protocol: /^https$/, message: 'Lien https requis.' }).max(2000),
    altText: z.string().trim().min(1).max(200),
    caption: optionalText(200),
    isPublished: z.boolean(),
    displayOrder,
  }),
  galleryImages,
);

// ── Prospects ───────────────────────────────────────────────

export const leadsRouter = Router();

leadsRouter.use(...adminOnly);

leadsRouter.get('/', async (req, res) => {
  const filters = z.object({ status: z.enum(LEAD_STATUSES).optional() }).parse(req.query);
  res.json({ leads: await listLeads(filters) });
});

leadsRouter.patch('/:id', writeLimiter, async (req, res) => {
  const patch = z
    .strictObject({
      status: z.enum(LEAD_STATUSES).optional(),
      notes: z.string().trim().max(5000).nullable().optional(),
      nextFollowUpAt: z.iso.datetime({ offset: true }).nullable().optional(),
    })
    .parse(req.body);
  res.json({ lead: await updateLead(authOf(req).userId, idSchema.parse(req.params.id), patch) });
});
