import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { authOf, requireAdminMfa, requireAuth, requirePasswordChanged, requireRole } from '../middleware/auth.js';
import {
  createAccount,
  getAccount,
  listAccounts,
  resetTemporaryPassword,
  setAccountStatus,
  updateAccount,
} from '../services/accounts.js';
import { exportStudentData } from '../services/student-export.js';

const roleSchema = z.enum(['student', 'teacher', 'admin']);
const levelSchema = z.enum(['A1', 'A2', 'B1', 'B2']);
const idSchema = z.uuid();

const createSchema = z.strictObject({
  email: z.email(),
  fullName: z.string().trim().min(2).max(120),
  role: roleSchema,
  phone: z.string().trim().max(30).optional(),
  level: levelSchema.optional(),
});

const updateSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  level: levelSchema.nullable().optional(),
});

const writeLimiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });
// Export massif de données sensibles : plafond volontairement bas.
const exportLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const adminUsersRouter = Router();

adminUsersRouter.use(requireAuth, requirePasswordChanged, requireRole('admin'), requireAdminMfa);

adminUsersRouter.get('/', async (req, res) => {
  const role = roleSchema.optional().parse(req.query.role);
  res.json({ accounts: await listAccounts(role) });
});

adminUsersRouter.get('/:id', async (req, res) => {
  res.json({ account: await getAccount(idSchema.parse(req.params.id)) });
});

// EF-38 : export des données d'un étudiant (CSV des résultats ou JSON complet).
adminUsersRouter.get('/:id/export', exportLimiter, async (req, res) => {
  const format = z.enum(['csv', 'json']).default('csv').parse(req.query.format);
  const file = await exportStudentData(authOf(req).userId, idSchema.parse(req.params.id), format);
  res.set({
    'Content-Type': file.contentType,
    'Content-Disposition': `attachment; filename="${file.fileName}"`,
    'Cache-Control': 'no-store',
  });
  res.send(file.body);
});

adminUsersRouter.post('/', writeLimiter, async (req, res) => {
  const input = createSchema.parse(req.body);
  res.status(201).json(await createAccount(input, authOf(req).userId));
});

adminUsersRouter.patch('/:id', writeLimiter, async (req, res) => {
  const patch = updateSchema.parse(req.body);
  res.json({ account: await updateAccount(idSchema.parse(req.params.id), patch, authOf(req).userId) });
});

adminUsersRouter.post('/:id/suspend', writeLimiter, async (req, res) => {
  res.json({ account: await setAccountStatus(idSchema.parse(req.params.id), 'suspended', authOf(req).userId) });
});

adminUsersRouter.post('/:id/reactivate', writeLimiter, async (req, res) => {
  res.json({ account: await setAccountStatus(idSchema.parse(req.params.id), 'active', authOf(req).userId) });
});

adminUsersRouter.post('/:id/reset-password', writeLimiter, async (req, res) => {
  res.json(await resetTemporaryPassword(idSchema.parse(req.params.id), authOf(req).userId));
});
