import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { authOf, requireAuth, requirePasswordChanged, requireRole } from '../middleware/auth.js';
import {
  deleteEmbassySession,
  endEmbassySession,
  getEmbassyConfig,
  getEmbassyProgress,
  getEmbassySession,
  listEmbassySessions,
  sendStudentMessage,
  startEmbassySession,
} from '../services/embassy.js';

const idSchema = z.uuid();

const startSchema = z.strictObject({
  visaType: z.enum(['etudes', 'tourisme', 'travail']),
  inputMode: z.enum(['voice', 'text']).default('text'),
  scenarioCode: z.string().regex(/^[a-z0-9_]+$/).max(60).default('standard'),
  // EF-56 : consentement explicite, désactivé par défaut.
  useProfile: z.boolean().default(false),
});

const messageSchema = z.strictObject({
  text: z.string().trim().min(1, 'Réponse vide.').max(2000),
  expectedSequence: z.number().int().min(0),
  responseTimeSeconds: z.number().int().min(0).max(3600).optional(),
});

// Chaque tour déclenche un appel à l'API Claude : limite stricte par client (checklist sécurité IA).
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const embassyRouter = Router();

embassyRouter.use(requireAuth, requirePasswordChanged, requireRole('student'));

embassyRouter.get('/config', async (req, res) => {
  res.json(await getEmbassyConfig(authOf(req).userId));
});

embassyRouter.get('/progress', async (req, res) => {
  res.json(await getEmbassyProgress(authOf(req).userId));
});

embassyRouter.get('/sessions', async (req, res) => {
  res.json({ sessions: await listEmbassySessions(authOf(req).userId) });
});

embassyRouter.post('/sessions', aiLimiter, async (req, res) => {
  const input = startSchema.parse(req.body);
  res.status(201).json(await startEmbassySession(authOf(req).userId, input));
});

embassyRouter.get('/sessions/:id', async (req, res) => {
  res.json(await getEmbassySession(authOf(req).userId, idSchema.parse(req.params.id)));
});

embassyRouter.post('/sessions/:id/messages', aiLimiter, async (req, res) => {
  const input = messageSchema.parse(req.body);
  res.json(await sendStudentMessage(authOf(req).userId, idSchema.parse(req.params.id), input));
});

embassyRouter.post('/sessions/:id/end', async (req, res) => {
  res.json(await endEmbassySession(authOf(req).userId, idSchema.parse(req.params.id)));
});

embassyRouter.delete('/sessions/:id', async (req, res) => {
  await deleteEmbassySession(authOf(req).userId, idSchema.parse(req.params.id));
  res.status(204).end();
});
