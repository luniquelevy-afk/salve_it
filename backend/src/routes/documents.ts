// V1.2 — documents, checklist, notifications, CRM (interactions et affectation).
import express, { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { adminOnly, authOf, signedIn, staffOnly, studentOnly } from '../middleware/auth.js';
import { createRequirement, listDocumentTypes, listRequirements, markRequirementVerified, updateRequirement } from '../services/checklist.js';
import { MAX_DOCUMENT_BYTES } from '../services/document-files.js';
import {
  deleteDocument,
  getDocumentDownloadUrl,
  getDocumentsOverview,
  getDocumentsSpaceForStaff,
  getStudentDocumentsSpace,
  reviewDocument,
  setDocumentExpiry,
  uploadDocument,
} from '../services/documents.js';
import { addLeadInteraction, assignLead, INTERACTION_KINDS, listLeadAssignees, listLeadInteractions } from '../services/leads.js';
import { getEmailPreference, listNotifications, markNotificationsRead, setEmailPreference } from '../services/notifications.js';

const idSchema = z.uuid();
const documentTypeSchema = z.string().regex(/^[a-z0-9_]+$/).max(60);
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });
const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

// Contenus de documents et liens signés : jamais mis en cache (checklist « postes partagés »).
const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

// ── Étudiant ────────────────────────────────────────────────

export const studentDocumentsRouter = Router();

studentDocumentsRouter.use(...studentOnly, noStore);

studentDocumentsRouter.get('/', async (req, res) => {
  res.json(await getStudentDocumentsSpace(authOf(req).userId));
});

// Corps binaire brut (pas de multipart) : le type réel est déterminé côté serveur par la signature du fichier.
studentDocumentsRouter.put(
  '/:type/file',
  uploadLimiter,
  express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES }),
  async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const fileName = typeof req.headers['x-file-name'] === 'string' ? req.headers['x-file-name'] : undefined;
    res.status(201).json(await uploadDocument(authOf(req).userId, documentTypeSchema.parse(req.params.type), body, fileName));
  },
);

studentDocumentsRouter.put('/:id/expiry', writeLimiter, async (req, res) => {
  const { expiresAt } = z.strictObject({ expiresAt: z.iso.date().nullable() }).parse(req.body);
  res.json(await setDocumentExpiry(authOf(req), idSchema.parse(req.params.id), expiresAt));
});

studentDocumentsRouter.get('/:id/file', async (req, res) => {
  const { version } = z.object({ version: z.coerce.number().int().min(1).optional() }).parse(req.query);
  res.json(await getDocumentDownloadUrl(authOf(req), idSchema.parse(req.params.id), version));
});

studentDocumentsRouter.delete('/:id', async (req, res) => {
  await deleteDocument(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

// ── Enseignant / admin (EF-45) ──────────────────────────────

export const staffDocumentsRouter = Router();

staffDocumentsRouter.use(...staffOnly, noStore);

staffDocumentsRouter.get('/overview', async (req, res) => {
  res.json(await getDocumentsOverview(authOf(req)));
});

staffDocumentsRouter.get('/students/:studentId', async (req, res) => {
  res.json(await getDocumentsSpaceForStaff(authOf(req), idSchema.parse(req.params.studentId)));
});

staffDocumentsRouter.get('/:id/file', async (req, res) => {
  const { version } = z.object({ version: z.coerce.number().int().min(1).optional() }).parse(req.query);
  res.json(await getDocumentDownloadUrl(authOf(req), idSchema.parse(req.params.id), version));
});

staffDocumentsRouter.post('/:id/review', writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      action: z.enum(['validate', 'request_correction']),
      version: z.number().int().min(1),
      comment: z.string().trim().max(2000).optional(),
    })
    .parse(req.body);
  res.json(await reviewDocument(authOf(req), idSchema.parse(req.params.id), input));
});

staffDocumentsRouter.put('/:id/expiry', writeLimiter, async (req, res) => {
  const { expiresAt } = z.strictObject({ expiresAt: z.iso.date().nullable() }).parse(req.body);
  res.json(await setDocumentExpiry(authOf(req), idSchema.parse(req.params.id), expiresAt));
});

// ── Checklist : référentiel (admin) ─────────────────────────

export const adminChecklistRouter = Router();

adminChecklistRouter.use(...adminOnly);

const requirementSchema = z.strictObject({
  code: z.string().trim().regex(/^[a-z0-9_]+$/).min(2).max(60),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  documentType: documentTypeSchema.nullable().optional(),
  visaTypes: z.array(z.enum(['etudes', 'tourisme', 'travail'])).min(1),
  financingSources: z.array(z.enum(['famille', 'garant', 'bourse', 'personnel', 'non_defini'])).nullable().optional(),
  requiresGuarantor: z.boolean().nullable().optional(),
  sourceLabel: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.url({ protocol: /^https$/, message: 'Lien https requis.' }).max(2000).nullable().optional().or(z.literal('').transform(() => null)),
  requiresHumanVerification: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean(),
});

adminChecklistRouter.get('/', async (_req, res) => {
  const [requirements, documentTypes] = await Promise.all([listRequirements(false), listDocumentTypes()]);
  res.json({ requirements, documentTypes });
});

adminChecklistRouter.post('/', writeLimiter, async (req, res) => {
  res.status(201).json({ requirement: await createRequirement(authOf(req).userId, requirementSchema.parse(req.body)) });
});

adminChecklistRouter.put('/:id', writeLimiter, async (req, res) => {
  res.json({ requirement: await updateRequirement(authOf(req).userId, idSchema.parse(req.params.id), requirementSchema.parse(req.body)) });
});

adminChecklistRouter.post('/:id/verify', writeLimiter, async (req, res) => {
  const { verifiedOn } = z
    .strictObject({ verifiedOn: z.iso.date() })
    .refine((input) => input.verifiedOn <= new Date().toISOString().slice(0, 10), { message: 'La date de vérification ne peut pas être dans le futur.', path: ['verifiedOn'] })
    .parse(req.body);
  res.json({ requirement: await markRequirementVerified(authOf(req).userId, idSchema.parse(req.params.id), verifiedOn) });
});

// ── Notifications (§15) ─────────────────────────────────────

export const notificationsRouter = Router();

notificationsRouter.use(...signedIn);

notificationsRouter.get('/', async (req, res) => {
  res.json(await listNotifications(authOf(req).userId));
});

notificationsRouter.post('/read', writeLimiter, async (req, res) => {
  const { ids } = z.strictObject({ ids: z.array(z.uuid()).max(100).optional() }).parse(req.body);
  await markNotificationsRead(authOf(req).userId, ids);
  res.status(204).end();
});

notificationsRouter.get('/preferences', async (req, res) => {
  res.json({ email: await getEmailPreference(authOf(req).userId) });
});

notificationsRouter.put('/preferences', writeLimiter, async (req, res) => {
  const { email } = z.strictObject({ email: z.boolean() }).parse(req.body);
  res.json({ email: await setEmailPreference(authOf(req).userId, email) });
});

// ── CRM : affectation et interactions (EF-61, EF-63) ────────

export const leadInteractionsRouter = Router();

leadInteractionsRouter.use(...adminOnly);

leadInteractionsRouter.get('/assignees', async (_req, res) => {
  res.json({ assignees: await listLeadAssignees() });
});

leadInteractionsRouter.put('/:id/assignee', writeLimiter, async (req, res) => {
  const { assigneeId } = z.strictObject({ assigneeId: z.uuid().nullable() }).parse(req.body);
  res.json({ lead: await assignLead(authOf(req).userId, idSchema.parse(req.params.id), assigneeId) });
});

leadInteractionsRouter.get('/:id/interactions', async (req, res) => {
  res.json({ interactions: await listLeadInteractions(idSchema.parse(req.params.id)) });
});

leadInteractionsRouter.post('/:id/interactions', writeLimiter, async (req, res) => {
  const input = z.strictObject({ kind: z.enum(INTERACTION_KINDS), summary: z.string().trim().min(1).max(2000) }).parse(req.body);
  res.status(201).json({ interactions: await addLeadInteraction(authOf(req).userId, idSchema.parse(req.params.id), input) });
});
