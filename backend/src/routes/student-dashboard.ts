// §16.1 : tableau de bord étudiant.
import { Router } from 'express';
import { authOf, studentOnly } from '../middleware/auth.js';
import { getStudentDashboard } from '../services/student-dashboard.js';

export const studentDashboardRouter = Router();

studentDashboardRouter.use(...studentOnly);

studentDashboardRouter.get('/', async (req, res) => {
  res.json(await getStudentDashboard(authOf(req)));
});
