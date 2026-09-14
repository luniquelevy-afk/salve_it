import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { authOf, isAdminMfaMissing, requireAuth } from '../middleware/auth.js';
import { completePasswordChange, getAccount } from '../services/accounts.js';
import { getRetentionPolicy } from '../services/retention.js';

export const passwordSchema = z
  .string()
  .min(10, 'Au moins 10 caractères.')
  .max(72, '72 caractères maximum.')
  .regex(/[A-Za-z]/, 'Au moins une lettre.')
  .regex(/\d/, 'Au moins un chiffre.');

const passwordLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/', async (req, res) => {
  const auth = authOf(req);
  const account = await getAccount(auth.userId);
  res.json({ ...account, mfaRequired: isAdminMfaMissing(auth) });
});

// ENF-11 : durées de conservation affichées aux étudiants là où ils confient des données sensibles.
meRouter.get('/retention-policy', async (_req, res) => {
  res.json(await getRetentionPolicy());
});

meRouter.post('/password', passwordLimiter, async (req, res) => {
  const { password } = z.object({ password: passwordSchema }).parse(req.body);
  await completePasswordChange(authOf(req).userId, password);
  res.status(204).end();
});
