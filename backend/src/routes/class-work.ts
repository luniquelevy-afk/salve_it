// §13 : présence, devoirs et rapport de classe.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { authOf, staffOnly, studentOnly } from '../middleware/auth.js';
import { ATTENDANCE_STATUSES, getClassAttendance, getMyAttendance, getSessionAttendance, saveSessionAttendance } from '../services/attendance.js';
import { exportClassReport } from '../services/class-report.js';
import {
  createHomework,
  deleteHomework,
  getHomeworkDetail,
  listClassHomework,
  listMyHomework,
  reviewSubmission,
  submitHomework,
  updateHomework,
} from '../services/homework.js';

const idSchema = z.uuid();
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

const homeworkSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(5000).nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }),
  courseId: z.uuid().nullable().optional(),
  exerciseId: z.uuid().nullable().optional(),
});

// ── Enseignant titulaire ou admin ───────────────────────────

export const staffClassWorkRouter = Router();

staffClassWorkRouter.use(...staffOnly);

staffClassWorkRouter.get('/classes/:classId/homework', async (req, res) => {
  res.json({ homework: await listClassHomework(authOf(req), idSchema.parse(req.params.classId)) });
});

staffClassWorkRouter.post('/classes/:classId/homework', writeLimiter, async (req, res) => {
  res.status(201).json({ homework: await createHomework(authOf(req), idSchema.parse(req.params.classId), homeworkSchema.parse(req.body)) });
});

staffClassWorkRouter.get('/homework/:id', async (req, res) => {
  res.json(await getHomeworkDetail(authOf(req), idSchema.parse(req.params.id)));
});

staffClassWorkRouter.put('/homework/:id', writeLimiter, async (req, res) => {
  res.json({ homework: await updateHomework(authOf(req), idSchema.parse(req.params.id), homeworkSchema.parse(req.body)) });
});

staffClassWorkRouter.delete('/homework/:id', async (req, res) => {
  await deleteHomework(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

staffClassWorkRouter.put('/homework/:id/submissions/:studentId', writeLimiter, async (req, res) => {
  const input = z.strictObject({ status: z.enum(['valide', 'a_reprendre']), comment: z.string().trim().max(2000).nullable().optional() }).parse(req.body);
  res.json(await reviewSubmission(authOf(req), idSchema.parse(req.params.id), idSchema.parse(req.params.studentId), input));
});

staffClassWorkRouter.get('/classes/:classId/attendance', async (req, res) => {
  res.json(await getClassAttendance(authOf(req), idSchema.parse(req.params.classId)));
});

staffClassWorkRouter.get('/sessions/:sessionId/attendance', async (req, res) => {
  res.json(await getSessionAttendance(authOf(req), idSchema.parse(req.params.sessionId)));
});

staffClassWorkRouter.put('/sessions/:sessionId/attendance', writeLimiter, async (req, res) => {
  const { entries } = z
    .strictObject({
      entries: z
        .array(z.strictObject({ studentId: z.uuid(), status: z.enum(ATTENDANCE_STATUSES), note: z.string().trim().max(300).nullable().optional() }))
        .max(200)
        .refine((items) => new Set(items.map((item) => item.studentId)).size === items.length, 'Un étudiant apparaît deux fois.'),
    })
    .parse(req.body);
  res.json(await saveSessionAttendance(authOf(req), idSchema.parse(req.params.sessionId), entries));
});

staffClassWorkRouter.get('/classes/:classId/report', async (req, res) => {
  const file = await exportClassReport(authOf(req), idSchema.parse(req.params.classId));
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.fileName}"`, 'Cache-Control': 'no-store' });
  res.send(file.body);
});

// ── Étudiant ────────────────────────────────────────────────

export const studentClassWorkRouter = Router();

studentClassWorkRouter.use(...studentOnly);

studentClassWorkRouter.get('/homework', async (req, res) => {
  res.json({ homework: await listMyHomework(authOf(req).userId) });
});

studentClassWorkRouter.put('/homework/:id/submission', writeLimiter, async (req, res) => {
  const { answer } = z.strictObject({ answer: z.string().trim().max(5000).nullable().optional() }).parse(req.body ?? {});
  res.json({ homework: await submitHomework(authOf(req).userId, idSchema.parse(req.params.id), answer) });
});

studentClassWorkRouter.get('/attendance', async (req, res) => {
  res.json(await getMyAttendance(authOf(req).userId));
});
