// §16.1 : tableau de bord étudiant.
import { Router } from 'express';
import { authOf, studentOnly } from '../middleware/auth.js';
import { getStudentDashboard } from '../services/student-dashboard.js';
import { getStudentGamification } from '../services/gamification.js';

export const studentDashboardRouter = Router();

studentDashboardRouter.use(...studentOnly);

studentDashboardRouter.get('/', async (req, res) => {
  res.json(await getStudentDashboard(authOf(req)));
});

// §14 : gamification (séries de jours actifs, objectif hebdomadaire, badges).
studentDashboardRouter.get('/gamification', async (req, res) => {
  res.json(await getStudentGamification(authOf(req)));
});
