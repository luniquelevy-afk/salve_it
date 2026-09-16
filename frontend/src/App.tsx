import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppShell } from './components/AppShell';
import { SessionLayout } from './components/SessionLayout';
import { AdminAiPage } from './pages/admin/AdminAiPage';
import { AdminRetentionPage } from './pages/admin/AdminRetentionPage';
import { AdminSessionSettingsPage } from './pages/admin/AdminSessionSettingsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage';
import { LoginPage } from './pages/auth/LoginPage';
import { MfaPage } from './pages/auth/MfaPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LandingPage } from './pages/public/LandingPage';
import { PublicLayout } from './components/PublicLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { ChecklistPage } from './pages/admin/ChecklistPage';
import { DocumentsProfilPage } from './pages/student/DocumentsProfilPage';
import { ExercicesDevoirsPage } from './pages/student/ExercicesDevoirsPage';
import { SimulationsEntretienPage } from './pages/student/SimulationsEntretienPage';
import { ProspectsPage } from './pages/admin/ProspectsPage';
import { TestTemplatesPage } from './pages/admin/TestTemplatesPage';
import { StaffEmbassyReportPage } from './pages/staff/StaffEmbassyReportPage';
import { StudentFollowUpPage } from './pages/staff/StudentFollowUpPage';
import { SiteContentPage } from './pages/admin/SiteContentPage';
import { ContactPage } from './pages/public/ContactPage';
import { FaqPage, GalleryPage } from './pages/public/FaqGalleryPages';
import { LevelTestPage } from './pages/public/LevelTestPage';
import { ProgramPage, ProgramsPage } from './pages/public/ProgramsPage';
import { AnnouncementsPage } from './pages/shared/AnnouncementsPage';
import { CalendarPage } from './pages/shared/CalendarPage';
import { ClassesPage } from './pages/staff/ClassesPage';
import { ManageCoursesPage } from './pages/staff/ManageCoursesPage';
import { ManageExercisesPage } from './pages/staff/ManageExercisesPage';
import { QuestionsPage } from './pages/staff/QuestionsPage';
import { CoursePage } from './pages/student/CoursePage';
import { CoursesPage } from './pages/student/CoursesPage';
import { ExercisePage } from './pages/student/ExercisePage';
import { EmbassySessionPage } from './pages/student/EmbassySessionPage';
import { SimulationResultsPage } from './pages/student/SimulationResultsPage';
import { SimulationRunPage } from './pages/student/SimulationRunPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<PublicLayout />}>
        <Route path="/formations" element={<ProgramsPage />} />
        <Route path="/formations/:slug" element={<ProgramPage />} />
        <Route path="/test-de-niveau" element={<LevelTestPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/galerie" element={<GalleryPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>
      <Route path="/connexion" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<SessionLayout />}>
          <Route path="/mot-de-passe" element={<ChangePasswordPage />} />
          <Route path="/mfa" element={<MfaPage />} />

          <Route element={<AppShell />}>
            <Route element={<RequireAuth roles={['student']} />}>
              <Route path="/etudiant" element={<StudentDashboard />} />
              <Route path="/etudiant/simulations" element={<SimulationsEntretienPage />} />
              <Route path="/etudiant/simulations/:id" element={<SimulationRunPage />} />
              <Route path="/etudiant/simulations/:id/resultats" element={<SimulationResultsPage />} />
              <Route path="/etudiant/entretien" element={<SimulationsEntretienPage />} />
              <Route path="/etudiant/entretien/:id" element={<EmbassySessionPage />} />
              <Route path="/etudiant/cours" element={<CoursesPage />} />
              <Route path="/etudiant/cours/:id" element={<CoursePage />} />
              <Route path="/etudiant/exercices" element={<ExercicesDevoirsPage />} />
              <Route path="/etudiant/exercices/:id" element={<ExercisePage />} />
              <Route path="/etudiant/devoirs" element={<ExercicesDevoirsPage />} />
              <Route path="/etudiant/profil" element={<DocumentsProfilPage />} />
              <Route path="/etudiant/documents" element={<DocumentsProfilPage />} />
            </Route>
            <Route element={<RequireAuth roles={['teacher', 'admin']} />}>
              <Route path="/banque-questions" element={<QuestionsPage />} />
              <Route path="/gestion/cours" element={<ManageCoursesPage />} />
              <Route path="/gestion/exercices" element={<ManageExercisesPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/suivi/etudiants/:id" element={<StudentFollowUpPage />} />
              <Route path="/suivi/etudiants/:id/entretiens/:sessionId" element={<StaffEmbassyReportPage />} />
            </Route>
            <Route path="/calendrier" element={<CalendarPage />} />
            <Route path="/annonces" element={<AnnouncementsPage />} />
            <Route element={<RequireAuth roles={['teacher']} />}>
              <Route path="/enseignant" element={<TeacherDashboard />} />
            </Route>
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/admin" element={<Navigate to="/admin/comptes" replace />} />
              <Route path="/admin/comptes" element={<AdminUsersPage />} />
              <Route path="/admin/prospects" element={<ProspectsPage />} />
              <Route path="/admin/site" element={<SiteContentPage />} />
              <Route path="/admin/tableau-de-bord" element={<AdminDashboardPage />} />
              <Route path="/admin/modeles-de-test" element={<TestTemplatesPage />} />
              <Route path="/admin/ia" element={<AdminAiPage />} />
              <Route path="/admin/checklist" element={<ChecklistPage />} />
              <Route path="/admin/conservation" element={<AdminRetentionPage />} />
              <Route path="/admin/parametres" element={<AdminSessionSettingsPage />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
