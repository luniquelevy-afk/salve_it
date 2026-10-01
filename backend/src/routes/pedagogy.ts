// Phase 4 — contenu pédagogique : cours, exercices, annonces, calendrier, classes, test de niveau.
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RATE_LIMIT_MESSAGE } from '../lib/rate-limit.js';
import { z } from 'zod';
import { adminOnly, authOf, signedIn, staffOnly, studentOnly } from '../middleware/auth.js';
import { createAnnouncement, deleteAnnouncement, listAnnouncements } from '../services/announcements.js';
import { createClassSession, deleteClassSession, listClassSessions, updateClassSession } from '../services/calendar.js';
import {
  addStudentToClass,
  createClass,
  createProgram,
  getClassDetail,
  listClasses,
  listEnrollments,
  listPrograms,
  removeStudentFromClass,
  setEnrollment,
  updateClass,
  updateProgram,
} from '../services/classes.js';
import { createCourse, deleteCourse, getStudentCourse, listManagedCourses, listStudentCourses, previewCourse, previewCourses, updateCourse } from '../services/courses.js';
import { exerciseInputSchema, studentAnswersSchema } from '../services/exercise-grading.js';
import {
  createExercise,
  deleteExercise,
  getStudentExercise,
  listManagedExercises,
  listStudentExercises,
  previewExercise,
  previewExerciseAttempt,
  submitExerciseAttempt,
  updateExercise,
} from '../services/exercises.js';
import { getLevelTest, listLevelTestAttempts, submitLevelTest } from '../services/level-test.js';

const idSchema = z.uuid();
const levelSchema = z.enum(['A1', 'A2', 'B1', 'B2']);
const levelFilterSchema = z.object({ level: z.union([levelSchema, z.literal('all')]).optional(), category: z.string().trim().min(1).max(60).optional() });
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const writeLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

// ── Cours (EF-24, EF-26) ────────────────────────────────────

const courseSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    description: optionalText(1000),
    level: levelSchema,
    category: z.string().trim().min(1).max(60),
    contentType: z.enum(['text', 'pdf', 'video', 'audio', 'link']),
    body: optionalText(50_000),
    contentUrl: z
      .url({ protocol: /^https$/, message: 'Lien https requis.' })
      .max(2000)
      .nullable()
      .optional(),
    classId: z.uuid().nullable().optional(),
    isPublished: z.boolean().default(false),
  })
  .refine((course) => (course.contentType === 'text' ? Boolean(course.body?.trim()) : Boolean(course.contentUrl)), {
    message: 'Un cours texte exige un contenu ; les autres types exigent un lien https.',
    path: ['body'],
  });

export const coursesRouter = Router();

coursesRouter.get('/', ...studentOnly, async (req, res) => {
  res.json(await listStudentCourses(authOf(req).userId, levelFilterSchema.parse(req.query)));
});

coursesRouter.get('/:id', ...studentOnly, async (req, res) => {
  res.json(await getStudentCourse(authOf(req).userId, idSchema.parse(req.params.id)));
});

export const manageCoursesRouter = Router();

manageCoursesRouter.use(...staffOnly);

manageCoursesRouter.get('/', async (req, res) => {
  res.json({ courses: await listManagedCourses(authOf(req)) });
});

// Vue étudiant (aperçu en lecture seule).
manageCoursesRouter.get('/preview', async (req, res) => {
  res.json(await previewCourses(levelFilterSchema.parse(req.query)));
});

manageCoursesRouter.get('/preview/:id', async (req, res) => {
  res.json(await previewCourse(idSchema.parse(req.params.id)));
});

manageCoursesRouter.post('/', writeLimiter, async (req, res) => {
  res.status(201).json({ course: await createCourse(authOf(req), courseSchema.parse(req.body)) });
});

manageCoursesRouter.put('/:id', writeLimiter, async (req, res) => {
  res.json({ course: await updateCourse(authOf(req), idSchema.parse(req.params.id), courseSchema.parse(req.body)) });
});

manageCoursesRouter.delete('/:id', async (req, res) => {
  await deleteCourse(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

// ── Exercices (EF-25) ───────────────────────────────────────

const exerciseSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  level: levelSchema,
  category: z.string().trim().min(1).max(60),
  instructions: optionalText(1000),
  courseId: z.uuid().nullable().optional(),
  isPublished: z.boolean().default(false),
  exercise: exerciseInputSchema,
});

export const exercisesRouter = Router();

exercisesRouter.get('/', ...studentOnly, async (req, res) => {
  res.json(await listStudentExercises(authOf(req).userId, levelFilterSchema.parse(req.query)));
});

exercisesRouter.get('/:id', ...studentOnly, async (req, res) => {
  res.json({ exercise: await getStudentExercise(authOf(req).userId, idSchema.parse(req.params.id)) });
});

exercisesRouter.post('/:id/attempts', ...studentOnly, writeLimiter, async (req, res) => {
  const { answers } = z.strictObject({ answers: studentAnswersSchema }).parse(req.body);
  res.status(201).json(await submitExerciseAttempt(authOf(req).userId, idSchema.parse(req.params.id), answers));
});

export const manageExercisesRouter = Router();

manageExercisesRouter.use(...staffOnly);

manageExercisesRouter.get('/', async (req, res) => {
  res.json({ exercises: await listManagedExercises(authOf(req)) });
});

manageExercisesRouter.get('/preview/:id', async (req, res) => {
  res.json({ exercise: await previewExercise(idSchema.parse(req.params.id)) });
});

// Correction sans tentative enregistrée : l'aperçu ne fausse pas les statistiques.
manageExercisesRouter.post('/preview/:id/attempts', writeLimiter, async (req, res) => {
  const { answers } = z.strictObject({ answers: studentAnswersSchema }).parse(req.body);
  res.json(await previewExerciseAttempt(idSchema.parse(req.params.id), answers));
});

manageExercisesRouter.post('/', writeLimiter, async (req, res) => {
  const { exercise, ...meta } = exerciseSchema.parse(req.body);
  res.status(201).json(await createExercise(authOf(req), meta, exercise));
});

manageExercisesRouter.put('/:id', writeLimiter, async (req, res) => {
  const { exercise, ...meta } = exerciseSchema.parse(req.body);
  res.json(await updateExercise(authOf(req), idSchema.parse(req.params.id), meta, exercise));
});

manageExercisesRouter.delete('/:id', async (req, res) => {
  await deleteExercise(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

// ── Annonces (EF-29) ────────────────────────────────────────

export const announcementsRouter = Router();

announcementsRouter.get('/', ...signedIn, async (req, res) => {
  res.json({ announcements: await listAnnouncements(authOf(req)) });
});

announcementsRouter.post('/', ...staffOnly, writeLimiter, async (req, res) => {
  const input = z
    .strictObject({
      title: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
      target: z.enum(['all', 'students', 'teachers', 'class']),
      classId: z.uuid().nullable().optional(),
    })
    .parse(req.body);
  res.status(201).json(await createAnnouncement(authOf(req), input));
});

announcementsRouter.delete('/:id', ...staffOnly, async (req, res) => {
  await deleteAnnouncement(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

// ── Calendrier (EF-28) ──────────────────────────────────────

const sessionSchema = z.strictObject({
  classId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  location: optionalText(200),
  notes: optionalText(1000),
});

export const calendarRouter = Router();

calendarRouter.get('/', ...signedIn, async (req, res) => {
  const range = z.object({ from: z.iso.datetime({ offset: true }).optional(), to: z.iso.datetime({ offset: true }).optional() }).parse(req.query);
  res.json({ sessions: await listClassSessions(authOf(req), range) });
});

calendarRouter.post('/', ...staffOnly, writeLimiter, async (req, res) => {
  res.status(201).json(await createClassSession(authOf(req), sessionSchema.parse(req.body)));
});

calendarRouter.put('/:id', ...staffOnly, writeLimiter, async (req, res) => {
  await updateClassSession(authOf(req), idSchema.parse(req.params.id), sessionSchema.parse(req.body));
  res.status(204).end();
});

calendarRouter.delete('/:id', ...staffOnly, async (req, res) => {
  await deleteClassSession(authOf(req), idSchema.parse(req.params.id));
  res.status(204).end();
});

// ── Classes, programmes, inscriptions ───────────────────────

export const classesRouter = Router();

classesRouter.get('/', ...signedIn, async (req, res) => {
  res.json({ classes: await listClasses(authOf(req)) });
});

classesRouter.get('/:id', ...staffOnly, async (req, res) => {
  res.json(await getClassDetail(authOf(req), idSchema.parse(req.params.id)));
});

export const adminPedagogyRouter = Router();

adminPedagogyRouter.use(...adminOnly);

const classSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  programId: z.uuid().nullable().optional(),
  teacherId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

adminPedagogyRouter.post('/classes', writeLimiter, async (req, res) => {
  res.status(201).json(await createClass(authOf(req).userId, classSchema.parse(req.body)));
});

adminPedagogyRouter.patch('/classes/:id', writeLimiter, async (req, res) => {
  await updateClass(authOf(req).userId, idSchema.parse(req.params.id), classSchema.partial().parse(req.body));
  res.status(204).end();
});

adminPedagogyRouter.post('/classes/:id/students', writeLimiter, async (req, res) => {
  const { studentId } = z.strictObject({ studentId: z.uuid() }).parse(req.body);
  await addStudentToClass(authOf(req).userId, idSchema.parse(req.params.id), studentId);
  res.status(204).end();
});

adminPedagogyRouter.delete('/classes/:id/students/:studentId', async (req, res) => {
  await removeStudentFromClass(authOf(req).userId, idSchema.parse(req.params.id), idSchema.parse(req.params.studentId));
  res.status(204).end();
});

const programSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  level: levelSchema.nullable().optional(),
  description: optionalText(1000),
  isActive: z.boolean().optional(),
});

adminPedagogyRouter.get('/programs', async (_req, res) => {
  res.json({ programs: await listPrograms() });
});

adminPedagogyRouter.post('/programs', writeLimiter, async (req, res) => {
  res.status(201).json(await createProgram(authOf(req).userId, programSchema.parse(req.body)));
});

adminPedagogyRouter.patch('/programs/:id', writeLimiter, async (req, res) => {
  await updateProgram(authOf(req).userId, idSchema.parse(req.params.id), programSchema.partial().parse(req.body));
  res.status(204).end();
});

adminPedagogyRouter.get('/programs/:id/enrollments', async (req, res) => {
  res.json({ enrollments: await listEnrollments(idSchema.parse(req.params.id)) });
});

adminPedagogyRouter.put('/enrollments', writeLimiter, async (req, res) => {
  const input = z.strictObject({ studentId: z.uuid(), programId: z.uuid(), status: z.enum(['active', 'completed', 'suspended']) }).parse(req.body);
  res.json(await setEnrollment(authOf(req).userId, input));
});

adminPedagogyRouter.get('/level-test-attempts', async (_req, res) => {
  res.json({ attempts: await listLevelTestAttempts() });
});

// ── Test de niveau public (EF-27) ───────────────────────────

// Accessible sans compte : limite stricte par adresse IP.
const levelTestLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE });

export const publicLevelTestRouter = Router();

publicLevelTestRouter.get('/', async (_req, res) => {
  res.json(await getLevelTest());
});

publicLevelTestRouter.post('/', levelTestLimiter, async (req, res) => {
  const input = z
    .strictObject({
      answers: z.record(z.uuid(), z.string().max(2)),
      contact: z
        .strictObject({
          consent: z.literal(true, { message: 'Le consentement est requis pour laisser vos coordonnées.' }),
          fullName: z.string().trim().min(2).max(120),
          email: z.email().max(200).optional().or(z.literal('')),
          phone: z.string().trim().max(30).optional(),
          desiredProgram: z.string().trim().max(120).optional(),
        })
        .refine((contact) => Boolean(contact.email || contact.phone), { message: 'Indiquez un email ou un téléphone.', path: ['phone'] })
        .nullable()
        .optional(),
    })
    .parse(req.body);

  const { contact } = input;
  res.status(201).json(
    await submitLevelTest(
      input.answers,
      contact ? { fullName: contact.fullName, email: contact.email || undefined, phone: contact.phone, desiredProgram: contact.desiredProgram } : null,
    ),
  );
});
