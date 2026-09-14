// ENF-09 / ENF-11 : réglages et purge de la conservation des données (admin).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { adminOnly, authOf } from '../middleware/auth.js';
import { getRetentionSettings, previewRetention, runRetention, updateRetentionSettings } from '../services/retention.js';

const months = z.number().int().min(1).max(120).nullable();

const valuesSchema = z.strictObject({
  embassySessionsMonths: months,
  suspendedStudentsMonths: months,
  documentVersionsMonths: months,
  leadsMonths: months,
  notificationsMonths: months,
});

const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });
// Suppression définitive : déclenchement manuel volontairement rare.
const runLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const adminRetentionRouter = Router();

adminRetentionRouter.use(...adminOnly);

adminRetentionRouter.get('/', async (_req, res) => {
  res.json(await getRetentionSettings());
});

adminRetentionRouter.post('/preview', writeLimiter, async (req, res) => {
  res.json({ preview: await previewRetention(valuesSchema.parse(req.body)) });
});

adminRetentionRouter.put('/', writeLimiter, async (req, res) => {
  res.json(await updateRetentionSettings(authOf(req).userId, valuesSchema.parse(req.body)));
});

adminRetentionRouter.post('/run', runLimiter, async (req, res) => {
  res.json({ run: await runRetention(authOf(req).userId) });
});
