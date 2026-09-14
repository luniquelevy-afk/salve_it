import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { authOf, requireAuth, requirePasswordChanged, requireRole } from '../middleware/auth.js';
import {
  getSimulationResults,
  getSimulationState,
  listActiveTemplates,
  listSimulations,
  startSimulation,
  submitAnswer,
} from '../services/test-engine.js';

const idSchema = z.uuid();

const startSchema = z
  .strictObject({
    templateId: z.uuid().optional(),
    mode: z.enum(['entrainement', 'examen', 'revision', 'defi']).default('examen'),
  })
  .refine((input) => input.mode === 'revision' || Boolean(input.templateId), { message: 'Modèle de test requis.', path: ['templateId'] });

const answerSchema = z.strictObject({
  position: z.number().int().min(0),
  answer: z.string().max(4).nullable(),
});

const answerLimiter = rateLimit({ windowMs: 60_000, limit: 90, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const testTemplatesRouter = Router();

testTemplatesRouter.use(requireAuth, requirePasswordChanged);

testTemplatesRouter.get('/', async (_req, res) => {
  res.json({ templates: await listActiveTemplates() });
});

export const simulationsRouter = Router();

simulationsRouter.use(requireAuth, requirePasswordChanged, requireRole('student'));

simulationsRouter.get('/', async (req, res) => {
  res.json({ simulations: await listSimulations(authOf(req).userId) });
});

simulationsRouter.post('/', async (req, res) => {
  res.status(201).json(await startSimulation(authOf(req).userId, startSchema.parse(req.body)));
});

simulationsRouter.get('/:id', async (req, res) => {
  res.json(await getSimulationState(authOf(req).userId, idSchema.parse(req.params.id)));
});

simulationsRouter.post('/:id/answers', answerLimiter, async (req, res) => {
  const input = answerSchema.parse(req.body);
  res.json(await submitAnswer(authOf(req).userId, idSchema.parse(req.params.id), input));
});

simulationsRouter.get('/:id/results', async (req, res) => {
  res.json(await getSimulationResults(authOf(req).userId, idSchema.parse(req.params.id)));
});
