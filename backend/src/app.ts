import cors from 'cors';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { env } from './config/env.js';
import { httpLogger } from './lib/logger.js';
import { RATE_LIMIT_MESSAGE } from './lib/rate-limit.js';
import { errorHandler, notFound } from './middleware/error.js';
import { adminUsersRouter } from './routes/admin-users.js';
import { staffClassWorkRouter, studentClassWorkRouter } from './routes/class-work.js';
import { embassyRouter } from './routes/embassy.js';
import {
  adminChecklistRouter,
  leadInteractionsRouter,
  notificationsRouter,
  staffDocumentsRouter,
  studentDocumentsRouter,
} from './routes/documents.js';
import { adminLearningRouter, studentLearningRouter, teacherRouter } from './routes/learning.js';
import { meRouter } from './routes/me.js';
import {
  adminPedagogyRouter,
  announcementsRouter,
  calendarRouter,
  classesRouter,
  coursesRouter,
  exercisesRouter,
  manageCoursesRouter,
  manageExercisesRouter,
  publicLevelTestRouter,
} from './routes/pedagogy.js';
import { adminSiteRouter, leadsRouter, publicSiteRouter } from './routes/public-site.js';
import { questionsRouter } from './routes/questions.js';
import { adminRetentionRouter } from './routes/retention.js';
import { simulationsRouter, testTemplatesRouter } from './routes/simulations.js';
import { studentDashboardRouter } from './routes/student-dashboard.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  // Auth par en-tête Authorization (pas de cookie) : pas de surface CSRF classique.
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(httpLogger);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: RATE_LIMIT_MESSAGE }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/me', meRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/test-templates', testTemplatesRouter);
  app.use('/api/simulations', simulationsRouter);
  app.use('/api/questions', questionsRouter);
  app.use('/api/embassy', embassyRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/manage/courses', manageCoursesRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/manage/exercises', manageExercisesRouter);
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/calendar', calendarRouter);
  app.use('/api/classes', classesRouter);
  app.use('/api/student/documents', studentDocumentsRouter);
  app.use('/api/staff/documents', staffDocumentsRouter);
  app.use('/api/staff', staffClassWorkRouter);
  app.use('/api/admin/checklist', adminChecklistRouter);
  app.use('/api/admin/leads', leadInteractionsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/student/dashboard', studentDashboardRouter);
  app.use('/api/student/work', studentClassWorkRouter);
  app.use('/api/student', studentLearningRouter);
  app.use('/api/teacher', teacherRouter);
  app.use('/api/admin/learning', adminLearningRouter);
  app.use('/api/admin/site-content', adminSiteRouter);
  app.use('/api/admin/leads', leadsRouter);
  app.use('/api/admin/retention', adminRetentionRouter);
  app.use('/api/admin', adminPedagogyRouter);
  app.use('/api/public/level-test', publicLevelTestRouter);
  app.use('/api/public', publicSiteRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
