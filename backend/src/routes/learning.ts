// V1.1 — profil, préparation, parcours, révisions (étudiant) ; suivi et tableaux de bord (enseignant, admin).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { adminOnly, authOf, staffOnly, studentOnly } from '../middleware/auth.js';
import { assertCanFollowStudent } from '../services/access.js';
import { getAiSettings, listStudentAiUsage, setStudentAiLimits, updateAiSettings } from '../services/ai-limits.js';
import { recordAudit } from '../services/audit.js';
import { getEmbassyProgress, getEmbassySessionForStaff } from '../services/embassy.js';
import { createScenario, listScenarios, updateScenario } from '../services/embassy-scenarios.js';
import { getLearningPath, getReadiness, getStudentProfile, saveStudentProfile } from '../services/student-profile.js';
import { createFeedback, getAdminOverview, getStudentFollowUp, getTeacherOverview, updateFeedback } from '../services/teacher-dashboard.js';
import { getReviewSummary } from '../services/test-engine.js';
import { createTemplate, listTemplatesForAdmin, updateTemplate } from '../services/test-templates.js';

const idSchema = z.uuid();
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });
const nullableEnum = <T extends [string, ...string[]]>(values: T) => z.enum(values).nullable().optional();
const shortList = z.array(z.string().trim().max(120)).max(10).default([]);

// ── Étudiant ────────────────────────────────────────────────

export const studentLearningRouter = Router();

studentLearningRouter.use(...studentOnly);

const profileSchema = z.strictObject({
  currentEducationLevel: nullableEnum(['lycee', 'baccalaureat', 'licence_en_cours', 'licence', 'master', 'autre']),
  diplomas: shortList,
  englishLevel: nullableEnum(['aucun', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  desiredField: z.string().trim().max(120).nullable().optional(),
  preferredCities: shortList,
  institutionTypePreference: nullableEnum(['public', 'prive', 'indifferent']),
  studyObjective: nullableEnum(['licence', 'master', 'formation_pro', 'mobilite']),
  budgetRange: nullableEnum(['moins_500', '500_800', '800_1200', 'plus_1200', 'non_defini']),
  financingSource: nullableEnum(['famille', 'garant', 'bourse', 'personnel', 'non_defini']),
  projectStage: nullableEnum(['exploration', 'choix_formation', 'preparation_tests', 'preinscription', 'visa', 'depart']),
  targetIntake: z.string().trim().max(60).nullable().optional(),
  targetTemplateId: z.uuid().nullable().optional(),
  visaType: nullableEnum(['etudes', 'tourisme', 'travail']),
  hasGuarantor: z.boolean().nullable().optional(),
});

studentLearningRouter.get('/profile', async (req, res) => {
  res.json({ profile: await getStudentProfile(authOf(req).userId) });
});

studentLearningRouter.put('/profile', writeLimiter, async (req, res) => {
  res.json({ profile: await saveStudentProfile(authOf(req).userId, profileSchema.parse(req.body)) });
});

studentLearningRouter.get('/readiness', async (req, res) => {
  res.json(await getReadiness(authOf(req).userId));
});

studentLearningRouter.get('/learning-path', async (req, res) => {
  res.json(await getLearningPath(authOf(req).userId));
});

studentLearningRouter.get('/reviews', async (req, res) => {
  res.json(await getReviewSummary(authOf(req).userId));
});

// ── Enseignant (§16.2, EF-53) ───────────────────────────────

export const teacherRouter = Router();

teacherRouter.use(...staffOnly);

teacherRouter.get('/overview', async (req, res) => {
  res.json(await getTeacherOverview(authOf(req)));
});

teacherRouter.get('/students/:id', async (req, res) => {
  res.json(await getStudentFollowUp(authOf(req), idSchema.parse(req.params.id)));
});

// V1.3 : rapport enseignant dédié (transcript, rapport complet avec vue enseignant, progression).
teacherRouter.get('/students/:id/embassy-sessions/:sessionId', async (req, res) => {
  const auth = authOf(req);
  const studentId = idSchema.parse(req.params.id);
  const sessionId = idSchema.parse(req.params.sessionId);
  await assertCanFollowStudent(auth, studentId);
  const [session, progress] = await Promise.all([getEmbassySessionForStaff(studentId, sessionId), getEmbassyProgress(studentId)]);
  // ENF-02 / ENF-08 : consultation d'un transcript d'entretien tracée.
  await recordAudit({ actorId: auth.userId, action: 'embassy_session.staff_view', entityType: 'embassy_session', entityId: sessionId });
  res.set('Cache-Control', 'no-store');
  res.json({ session, progress });
});

teacherRouter.post('/feedback', writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      studentId: z.uuid(),
      targetType: z.enum(['simulation', 'embassy_session']),
      targetId: z.uuid(),
      comment: z.string().trim().min(1).max(3000),
      followUpAt: z.iso.date().nullable().optional(),
    })
    .parse(req.body);
  res.status(201).json({ feedback: await createFeedback(authOf(req), input) });
});

teacherRouter.patch('/feedback/:id', writeLimiter, async (req, res) => {
  const patch = z
    .strictObject({
      comment: z.string().trim().min(1).max(3000).optional(),
      status: z.enum(['a_revoir', 'traite']).optional(),
      followUpAt: z.iso.date().nullable().optional(),
    })
    .parse(req.body);
  res.json({ feedback: await updateFeedback(authOf(req), idSchema.parse(req.params.id), patch) });
});

// ── Admin (§16.3, EF-42) ────────────────────────────────────

export const adminLearningRouter = Router();

adminLearningRouter.use(...adminOnly);

adminLearningRouter.get('/dashboard', async (_req, res) => {
  res.json(await getAdminOverview());
});

const templateSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'Code en majuscules, chiffres et tirets (ex. TOLC-E).'),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  language: z.string().trim().min(2).max(5).default('it'),
  totalDurationSeconds: z.number().int().min(60).max(6 * 3600),
  scoringRules: z.strictObject({ correct: z.number().min(0).max(10), wrong: z.number().min(-10).max(0), blank: z.number().min(-10).max(10) }),
  isActive: z.boolean(),
  sections: z
    .array(z.strictObject({ name: z.string().trim().min(1).max(120), category: z.string().trim().min(1).max(60), questionCount: z.number().int().min(1).max(200) }))
    .min(1)
    .max(20),
});

// ── IA : limites (EF-59) et scénarios (EF-54) ───────────────

const nullableNumber = (min: number, max: number, integer = false) => (integer ? z.number().int().min(min).max(max) : z.number().min(min).max(max)).nullable();

adminLearningRouter.get('/ai-settings', async (_req, res) => {
  res.json(await getAiSettings());
});

adminLearningRouter.put('/ai-settings', writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      maxTurns: nullableNumber(2, 30, true),
      weeklySessionLimit: nullableNumber(0, 100, true),
      monthlyCostLimitUsd: nullableNumber(0, 1000),
      sessionCostLimitUsd: nullableNumber(0, 100),
    })
    .parse(req.body);
  res.json(await updateAiSettings(authOf(req).userId, input));
});

adminLearningRouter.get('/ai-usage', async (_req, res) => {
  res.json({ students: await listStudentAiUsage() });
});

adminLearningRouter.put('/ai-usage/:studentId', writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      weeklySessionLimit: nullableNumber(0, 100, true),
      monthlyCostLimitUsd: nullableNumber(0, 1000),
      note: z.string().trim().max(300).nullable().optional(),
    })
    .parse(req.body);
  res.json({ effective: await setStudentAiLimits(authOf(req).userId, idSchema.parse(req.params.studentId), input) });
});

const scenarioSchema = z.strictObject({
  code: z.string().trim().regex(/^[a-z0-9_]+$/).min(2).max(60),
  label: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(500),
  visaTypes: z.array(z.enum(['etudes', 'tourisme', 'travail'])).min(1),
  agentInstructions: z.string().trim().min(10).max(2000),
  focusThemes: z.array(z.string().trim().max(160)).max(8).default([]),
  isActive: z.boolean(),
  displayOrder: z.number().int().min(0).max(10_000).default(0),
});

adminLearningRouter.get('/embassy-scenarios', async (_req, res) => {
  res.json({ scenarios: await listScenarios(false) });
});

adminLearningRouter.post('/embassy-scenarios', writeLimiter, async (req, res) => {
  res.status(201).json({ scenario: await createScenario(authOf(req).userId, scenarioSchema.parse(req.body)) });
});

adminLearningRouter.put('/embassy-scenarios/:code', writeLimiter, async (req, res) => {
  const code = z.string().regex(/^[a-z0-9_]+$/).max(60).parse(req.params.code);
  res.json({ scenario: await updateScenario(authOf(req).userId, code, scenarioSchema.parse(req.body)) });
});

adminLearningRouter.get('/test-templates', async (_req, res) => {
  res.json({ templates: await listTemplatesForAdmin() });
});

adminLearningRouter.post('/test-templates', writeLimiter, async (req, res) => {
  res.status(201).json(await createTemplate(authOf(req).userId, templateSchema.parse(req.body)));
});

adminLearningRouter.put('/test-templates/:id', writeLimiter, async (req, res) => {
  res.json(await updateTemplate(authOf(req).userId, idSchema.parse(req.params.id), templateSchema.parse(req.body)));
});
