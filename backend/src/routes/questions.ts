import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { authOf, requireAdminMfa, requireAuth, requirePasswordChanged, requireRole } from '../middleware/auth.js';
import { MAX_VARIANTS } from '../services/question-variants.js';
import {
  createQuestion,
  generateQuestionVariants,
  getQuestion,
  listCategories,
  listQuestions,
  setQuestionStatus,
  updateQuestion,
} from '../services/questions.js';

const idSchema = z.uuid();
const statusSchema = z.enum(['draft', 'pending_review', 'active', 'archived']);

const optionsSchema = z
  .array(z.strictObject({ key: z.string().regex(/^[A-F]$/), text: z.string().trim().min(1).max(500) }))
  .min(2)
  .max(6)
  .refine((options) => new Set(options.map((option) => option.key)).size === options.length, 'Les clés des options doivent être uniques.');

const fields = {
  category: z.string().trim().min(1).max(60),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  questionText: z.string().trim().min(1).max(4000),
  options: optionsSchema,
  correctAnswer: z.string().regex(/^[A-F]$/),
  explanation: z.string().trim().max(4000).nullable().optional(),
  language: z.string().trim().min(2).max(5).optional(),
};

const createSchema = z
  .strictObject(fields)
  .refine((question) => question.options.some((option) => option.key === question.correctAnswer), {
    message: 'La bonne réponse doit correspondre à une des options.',
    path: ['correctAnswer'],
  });

const updateSchema = z.strictObject({
  category: fields.category.optional(),
  difficulty: fields.difficulty.optional(),
  questionText: fields.questionText.optional(),
  options: fields.options.optional(),
  correctAnswer: fields.correctAnswer.optional(),
  explanation: fields.explanation,
  language: fields.language,
});

const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });
// Chaque génération appelle l'IA (coût direct) : plafond horaire par client.
const generationLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const questionsRouter = Router();

// EF-06 : création et maintenance de la banque réservées aux enseignants et admins.
questionsRouter.use(requireAuth, requirePasswordChanged, requireRole('teacher', 'admin'), requireAdminMfa);

questionsRouter.get('/', async (req, res) => {
  const filters = z
    .object({ category: z.string().trim().min(1).optional(), status: statusSchema.optional() })
    .parse(req.query);
  res.json({ questions: await listQuestions(filters) });
});

questionsRouter.get('/categories', async (_req, res) => {
  res.json({ categories: await listCategories() });
});

questionsRouter.get('/:id', async (req, res) => {
  res.json({ question: await getQuestion(idSchema.parse(req.params.id)) });
});

questionsRouter.post('/', writeLimiter, async (req, res) => {
  const input = createSchema.parse(req.body);
  res.status(201).json({ question: await createQuestion(input, authOf(req).userId) });
});

questionsRouter.patch('/:id', writeLimiter, async (req, res) => {
  const patch = updateSchema.parse(req.body);
  res.json({ question: await updateQuestion(idSchema.parse(req.params.id), patch, authOf(req).userId) });
});

questionsRouter.post('/:id/status', writeLimiter, async (req, res) => {
  const { status } = z.strictObject({ status: statusSchema }).parse(req.body);
  res.json({ question: await setQuestionStatus(idSchema.parse(req.params.id), status, authOf(req).userId) });
});

// EF-07 : variantes générées par IA, créées « à relire » — jamais activées automatiquement.
questionsRouter.post('/:id/variants', generationLimiter, async (req, res) => {
  const { count } = z.strictObject({ count: z.number().int().min(1).max(MAX_VARIANTS).default(3) }).parse(req.body ?? {});
  res.status(201).json(await generateQuestionVariants(idSchema.parse(req.params.id), count, authOf(req).userId));
});
