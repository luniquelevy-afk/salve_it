export type AppRole = 'student' | 'teacher' | 'admin';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type AccountStatus = 'active' | 'suspended';

export interface Account {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
  phone: string | null;
  level: CefrLevel | null;
  status: AccountStatus;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface Me extends Account {
  mfaRequired: boolean;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Étudiant',
  teacher: 'Enseignant',
  admin: 'Admin',
};

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];

// ── Moteur de test ──────────────────────────────────────────
export type SimulationMode = 'entrainement' | 'examen' | 'revision' | 'defi';
export type QuestionStatus = 'draft' | 'pending_review' | 'active' | 'archived';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface TestTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  totalDurationSeconds: number;
  totalQuestions: number;
  sections: { id: string; name: string; category: string; questionCount: number }[];
}

export interface SimulationState {
  id: string;
  mode: SimulationMode;
  status: 'in_progress' | 'completed' | 'abandoned';
  startedAt: string;
  deadlineAt: string;
  serverNow: string;
  totalQuestions: number;
  position: number;
  question: { position: number; sectionName: string; text: string; options: QuestionOption[] } | null;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
}

export interface AnswerResult {
  finished: boolean;
  feedback: AnswerFeedback | null;
}

export interface SimulationSummary {
  id: string;
  mode: SimulationMode;
  status: 'in_progress' | 'completed' | 'abandoned' | 'expired';
  template: { name: string; code: string } | null;
  startedAt: string;
  completedAt: string | null;
  deadlineAt: string;
  totalQuestions: number;
  score: number | null;
  correct: number | null;
}

export interface SectionTally {
  name: string;
  correct: number;
  wrong: number;
  blank: number;
  total: number;
  points: number;
}

export interface SimulationResults {
  id: string;
  mode: SimulationMode;
  template: { name: string; code: string };
  scoringRules: { correct: number; wrong: number; blank: number };
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  score: number | null;
  bySection: Record<string, SectionTally>;
  challenge: { target: number; correct: number; succeeded: boolean } | null;
  previous: { id: string; score: number | null; correct: number; completedAt: string } | null;
  questions: {
    position: number;
    sectionName: string;
    text: string;
    options: QuestionOption[];
    answerGiven: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string | null;
    timeSpentSeconds: number;
  }[];
}

export interface Question {
  id: string;
  category: string;
  difficulty: 1 | 2 | 3;
  questionText: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string | null;
  language: string;
  source: 'manual' | 'ai_generated';
  status: QuestionStatus;
  // EF-07 : question d'origine d'une variante générée par IA.
  generatedFrom: string | null;
  // Extrait de l'énoncé d'origine (renvoyé par la liste, même si la source est hors filtre).
  generatedFromText?: string | null;
  stats: { answers: number; successRate: number; avgTimeSeconds: number | null } | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const MODE_LABELS: Record<SimulationMode, string> = {
  entrainement: 'Entraînement',
  examen: 'Examen',
  revision: 'Révision',
  defi: 'Défi',
};

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'À relire',
  active: 'Active',
  archived: 'Archivée',
};

// ── Agent ambassade ─────────────────────────────────────────
export type VisaType = 'etudes' | 'tourisme' | 'travail';
export type EmbassyInputMode = 'voice' | 'text';
export type EmbassyStatus = 'in_progress' | 'report_pending' | 'completed' | 'failed' | 'abandoned';
export type ReportLevel = 'faible' | 'intermediaire' | 'satisfaisante';

export const VISA_LABELS: Record<VisaType, string> = {
  etudes: 'Visa études',
  tourisme: 'Visa touristique',
  travail: 'Visa travail',
};

export const EMBASSY_STATUS_LABELS: Record<EmbassyStatus, string> = {
  in_progress: 'En cours',
  report_pending: 'Rapport en préparation',
  completed: 'Terminé',
  failed: 'Interrompu',
  abandoned: 'Trop court pour un rapport',
};

export interface EmbassyScenarioOption {
  code: string;
  label: string;
  description: string;
  visaTypes: VisaType[];
}

export interface EmbassyConfig {
  aiAvailable: boolean;
  maxTurns: number;
  weeklyLimit: number;
  weeklyUsed: number;
  budgetReached: boolean;
  profileAvailable: boolean;
  scenarios: EmbassyScenarioOption[];
}

export interface EmbassyMessage {
  sequenceNumber: number;
  speaker: 'agent' | 'student';
  text: string;
  createdAt?: string;
}

export type ReportDimension = 'coherence_project' | 'knowledge_university' | 'financial_clarity' | 'language_confidence' | 'return_plan' | 'document_awareness';

export const REPORT_DIMENSION_LABELS: Record<ReportDimension, string> = {
  coherence_project: 'Cohérence du projet',
  knowledge_university: 'Connaissance de l’établissement / destination',
  financial_clarity: 'Clarté du financement',
  language_confidence: 'Aisance d’expression',
  return_plan: 'Projet après le séjour',
  document_awareness: 'Connaissance des démarches',
};

export type InconsistencySource = 'profil' | 'entretien_precedent' | 'meme_entretien';

export interface EmbassyInconsistency {
  topic: string;
  source: InconsistencySource;
  declared: string;
  stated: string;
  advice: string;
}

export type KeyFactKey = 'field_of_study' | 'institution' | 'city' | 'financing' | 'monthly_budget' | 'accommodation' | 'intake' | 'after_studies';

export interface EmbassyReport {
  level: ReportLevel;
  overall_score: number;
  dimensions: Record<ReportDimension, number>;
  summary: string;
  strengths: string[];
  critical_risks: string[];
  recommended_actions: string[];
  // Absents des rapports antérieurs à la V1.3.
  inconsistencies?: EmbassyInconsistency[];
  key_facts?: Record<KeyFactKey, string>;
  // Vue enseignant : jamais renvoyée à l'étudiant.
  teacher_view?: { summary: string; follow_up_questions: string[]; class_activities: string[] };
  notices: { administrative: string; evaluationLimits: string; inconsistencies?: string };
  prompt_version: string;
  model: string;
}

export interface EmbassySession {
  id: string;
  visaType: VisaType;
  scenario: { code: string; label: string | null };
  inputMode: EmbassyInputMode;
  status: EmbassyStatus;
  usesProfile: boolean;
  costLimitReached: boolean;
  maxTurns: number;
  turnCount: number;
  startedAt: string;
  endedAt: string | null;
  completedAt: string | null;
  overallScore: number | null;
  report: EmbassyReport | null;
  messages: EmbassyMessage[];
}

export interface EmbassySessionSummary {
  id: string;
  visaType: VisaType;
  scenarioLabel: string | null;
  inputMode: EmbassyInputMode;
  status: EmbassyStatus;
  turnCount: number;
  maxTurns: number;
  startedAt: string;
  completedAt: string | null;
  overallScore: number | null;
  level: ReportLevel | null;
  inconsistencyCount: number;
}

export interface EmbassyTurnResult {
  agentMessage: EmbassyMessage;
  ended: boolean;
  turnCount: number;
  maxTurns: number;
}

export interface EmbassyProgressDimension {
  key: ReportDimension;
  first: number | null;
  previous: number | null;
  latest: number | null;
  deltaFromPrevious: number | null;
  deltaFromFirst: number | null;
}

export interface EmbassyProgress {
  sessions: {
    sessionId: string;
    completedAt: string;
    visaType: VisaType;
    scenarioLabel: string | null;
    overallScore: number;
    dimensions: Partial<Record<ReportDimension, number>>;
    inconsistencyTopics: string[];
  }[];
  summary: {
    count: number;
    overall: { first: number; previous: number | null; latest: number; deltaFromPrevious: number | null; deltaFromFirst: number | null };
    dimensions: EmbassyProgressDimension[];
    weakestDimension: { key: ReportDimension; score: number } | null;
    recurringInconsistencies: { topic: string; sessions: number }[];
    latestInconsistencyTopics: string[];
  } | null;
}

// ── Agent IA : administration (EF-54, EF-59) ────────────────
export type AiLimitKey = 'maxTurns' | 'weeklySessionLimit' | 'monthlyCostLimitUsd' | 'sessionCostLimitUsd';
export type AiLimitSource = 'serveur' | 'centre' | 'etudiant';
export type EffectiveAiLimits = Record<AiLimitKey, number> & { sources: Record<AiLimitKey, AiLimitSource> };

export interface AiSettings {
  provider: string;
  model: string;
  costTracked: boolean;
  defaults: Record<AiLimitKey, number>;
  settings: Record<AiLimitKey, number | null>;
  effective: EffectiveAiLimits;
  updatedAt: string;
}

export interface StudentAiUsage {
  studentId: string;
  fullName: string;
  level: CefrLevel | null;
  monthCostUsd: number;
  monthSessions: number;
  weekSessions: number;
  costLimitHits: number;
  override: { weeklySessionLimit: number | null; monthlyCostLimitUsd: number | null; note: string | null } | null;
  effective: EffectiveAiLimits;
  budgetUsedPercent: number | null;
}

export interface AdminEmbassyScenario extends EmbassyScenarioOption {
  agentInstructions: string;
  focusThemes: string[];
  isActive: boolean;
  displayOrder: number;
}

// ── Contenu pédagogique ─────────────────────────────────────
export type CourseContentType = 'text' | 'pdf' | 'video' | 'audio' | 'link';
export type ExerciseType = 'qcm' | 'texte_a_trous' | 'appariement';
export type AnnouncementTarget = 'all' | 'students' | 'teachers' | 'class';

export const COURSE_TYPE_LABELS: Record<CourseContentType, string> = {
  text: 'Texte',
  pdf: 'PDF',
  video: 'Vidéo',
  audio: 'Audio',
  link: 'Lien',
};

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  qcm: 'QCM',
  texte_a_trous: 'Texte à trous',
  appariement: 'Appariement',
};

export const ANNOUNCEMENT_TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all: 'Tout le centre',
  students: 'Tous les étudiants',
  teachers: 'Tous les enseignants',
  class: 'Une classe',
};

export interface Course {
  id: string;
  title: string;
  description: string | null;
  level: CefrLevel;
  category: string;
  contentType: CourseContentType;
  body: string | null;
  contentUrl: string | null;
  classId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  canEdit?: boolean;
}

export interface QcmContent {
  questions: { id: string; text: string; options: QuestionOption[] }[];
}

export interface GapFillContent {
  segments: ({ type: 'text'; value: string } | { type: 'gap'; id: string })[];
}

export interface MatchingContent {
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
}

export interface ExerciseSummary {
  id: string;
  courseId: string | null;
  title: string;
  level: CefrLevel;
  category: string;
  exerciseType: ExerciseType;
  bestScore: { score: number; maxScore: number } | null;
}

export interface ExerciseDetail {
  id: string;
  courseId: string | null;
  title: string;
  level: CefrLevel;
  category: string;
  exerciseType: ExerciseType;
  instructions: string | null;
  content: QcmContent | GapFillContent | MatchingContent;
  updatedAt: string;
}

export interface GradeResult {
  score: number;
  maxScore: number;
  items: { id: string; correct: boolean; given: string | null; expected: string }[];
}

export type ExerciseInput =
  | { type: 'qcm'; questions: { text: string; options: string[]; correctIndex: number }[] }
  | { type: 'texte_a_trous'; text: string }
  | { type: 'appariement'; pairs: { left: string; right: string }[] };

export interface ManagedExercise extends ExerciseDetail {
  isPublished: boolean;
  input: ExerciseInput;
  canEdit: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target: AnnouncementTarget;
  classId: string | null;
  className: string | null;
  authorName: string | null;
  publishedAt: string;
  canDelete: boolean;
}

export interface ClassSession {
  id: string;
  classId: string;
  className: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
  canManage: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  isActive: boolean;
  programId: string | null;
  programName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  studentCount: number;
}

export interface ClassDetail {
  class: ClassSummary;
  students: { id: string; fullName: string; level: CefrLevel | null; status: string }[];
}

export interface Program {
  id: string;
  name: string;
  level: CefrLevel | null;
  description: string | null;
  isActive: boolean;
  enrollmentCount: number;
}

export interface LevelTestQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
}

export interface LevelTestResult {
  score: number;
  total: number;
  estimatedLevel: CefrLevel | null;
  byLevel: Partial<Record<CefrLevel, { correct: number; total: number }>>;
  contactSaved: boolean;
}

export interface LevelTestAttempt {
  id: string;
  score: number;
  total: number;
  estimatedLevel: CefrLevel | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  desiredProgram: string | null;
  contactConsent: boolean;
  createdAt: string;
}

// ── Site vitrine ────────────────────────────────────────────
export interface KeyFigure {
  value: string;
  label: string;
}

export interface SiteSettings {
  centreName: string;
  tagline: string | null;
  about: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  openingHours: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  mapUrl: string | null;
  keyFigures: KeyFigure[];
}

export interface PublicProgram {
  id: string;
  name: string;
  level: CefrLevel | null;
  description: string | null;
  slug: string;
  summary: string | null;
  durationLabel: string | null;
  scheduleLabel: string | null;
  audience: string | null;
  objectives: string[];
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorContext: string | null;
  quote: string;
  photoUrl: string | null;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  altText: string;
  caption: string | null;
}

export interface PublicSite {
  settings: SiteSettings;
  programs: PublicProgram[];
  testimonials: Testimonial[];
  faq: FaqItem[];
  gallery: GalleryImage[];
}

export interface AdminProgram extends Omit<PublicProgram, 'slug'> {
  slug: string | null;
  isActive: boolean;
  isPublic: boolean;
  displayOrder: number;
}

export type LeadStatus = 'nouveau' | 'contacte' | 'test_realise' | 'interesse' | 'inscrit' | 'non_interesse' | 'a_relancer';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  test_realise: 'Test réalisé',
  interesse: 'Intéressé',
  inscrit: 'Inscrit',
  non_interesse: 'Non intéressé',
  a_relancer: 'À relancer',
};

export interface Lead {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  desiredProgram: string | null;
  levelEstimate: CefrLevel | null;
  message: string | null;
  source: 'contact_form' | 'level_test';
  status: LeadStatus;
  notes: string | null;
  nextFollowUpAt: string | null;
  assignedTo: { id: string; fullName: string } | null;
  createdAt: string;
}

// ── V1.1 : profil, préparation, parcours, suivi ─────────────
export interface StudentProfile {
  exists: boolean;
  currentEducationLevel: string | null;
  diplomas: string[];
  englishLevel: string | null;
  desiredField: string | null;
  preferredCities: string[];
  institutionTypePreference: string | null;
  studyObjective: string | null;
  budgetRange: string | null;
  financingSource: string | null;
  projectStage: string | null;
  targetIntake: string | null;
  targetTemplate: { id: string; name: string } | null;
  visaType: VisaType | null;
  hasGuarantor: boolean | null;
  updatedAt: string | null;
}

// ── V1.2 : documents, checklist, notifications, CRM ─────────
export type DocumentStatus = 'submitted' | 'needs_correction' | 'validated';
export type ChecklistItemStatus = 'missing' | DocumentStatus | 'expired';

export interface StudentDocument {
  id: string;
  documentType: string;
  documentTypeLabel: string;
  requiresExpiry: boolean;
  status: DocumentStatus;
  currentVersion: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
  reviewerComment: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  code: string;
  label: string;
  description: string | null;
  documentType: string | null;
  status: ChecklistItemStatus;
  document: { id: string; status: DocumentStatus; expiresAt: string | null; currentVersion: number; reviewerComment: string | null; updatedAt: string } | null;
  expiringSoon: boolean;
  sourceLabel: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  requiresHumanVerification: boolean;
}

export interface DocumentEvent {
  id: string;
  documentId: string;
  action: 'upload' | 'validate' | 'request_correction' | 'set_expiry';
  version: number | null;
  comment: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface DocumentsSpace {
  checklist: {
    visaType: VisaType | null;
    items: ChecklistItem[];
    progress: { validated: number; total: number };
    oldestVerificationAt: string | null;
    unverifiedCount: number;
    notice: string;
  };
  documents: StudentDocument[];
  documentTypes: { code: string; label: string; description: string | null; requiresExpiry: boolean }[];
  history: DocumentEvent[];
}

export interface DocumentsOverview {
  toReviewCount: number;
  expiringCount: number;
  toReview: { id: string; studentId: string; studentName: string; documentType: string; version: number; updatedAt: string }[];
  expiring: { id: string; studentId: string; studentName: string; documentType: string; expiresAt: string }[];
}

export interface ChecklistRequirement {
  id: string;
  code: string;
  label: string;
  description: string | null;
  documentType: string | null;
  visaTypes: VisaType[];
  financingSources: string[] | null;
  requiresGuarantor: boolean | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  requiresHumanVerification: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export type InteractionKind = 'appel' | 'whatsapp' | 'email' | 'rendez_vous' | 'note' | 'changement_statut' | 'assignation';

export const INTERACTION_LABELS: Record<InteractionKind, string> = {
  appel: 'Appel',
  whatsapp: 'WhatsApp',
  email: 'Email',
  rendez_vous: 'Rendez-vous',
  note: 'Note',
  changement_statut: 'Statut',
  assignation: 'Affectation',
};

export interface LeadInteraction {
  id: string;
  kind: InteractionKind;
  summary: string;
  actorName: string | null;
  createdAt: string;
}

export interface Readiness {
  academic: number | null;
  language: number | null;
  financial: number | null;
  visa: number | null;
  overall: number | null;
  basis: { simulations: number; exercises: number; embassySessions: number; targetTemplate: string | null };
  notice: string;
}

export interface PathAction {
  id: string;
  priority: number;
  title: string;
  description: string;
  link: string;
}

export interface WeeklyGoal {
  id: string;
  label: string;
  target: number;
  done: number;
}

export interface CategoryMastery {
  category: string;
  attempts: number;
  accuracy: number;
  mastery: number;
}

export interface LearningPath {
  objective: string | null;
  targetTemplate: { id: string; name: string } | null;
  weeklyGoals: WeeklyGoal[];
  actions: PathAction[];
  progressPercent: number;
  reviews: { dueCount: number; nextReviewAt: string | null; categories: CategoryMastery[] };
  generatedAt: string;
}

export interface ReviewSummary {
  dueCount: number;
  trackedCount: number;
  retryableCount: number;
  nextReviewAt: string | null;
  categories: CategoryMastery[];
  weakCategories: CategoryMastery[];
}

export interface TeacherOverview {
  classes: { id: string; name: string; studentCount: number }[];
  students: {
    id: string;
    fullName: string;
    level: CefrLevel | null;
    classNames: string | null;
    lastActivityAt: string | null;
    simulations30: number;
    answers30: number;
    accuracy30: number | null;
    embassyAverage: number | null;
    attendanceRate30: number | null;
    homeworkMissing: number;
    inactive: boolean;
    atRisk: boolean;
  }[];
  weakCategories: { category: string; answers: number; accuracy: number }[];
  hardestQuestions: { id: string; text: string; category: string; answers: number; successRate: number }[];
  toReview: { type: 'simulation' | 'embassy_session'; id: string; studentId: string; studentName: string; completedAt: string; score: number | null; label: string }[];
  followUps: { id: string; studentId: string; studentName: string; comment: string; followUpAt: string }[];
  homework: { id: string; title: string; classId: string; className: string; dueAt: string; students: number; submitted: number; toReview: number }[];
}

// ── Présence et devoirs (§13) ───────────────────────────────
export type AttendanceStatus = 'present' | 'retard' | 'absent' | 'excuse';

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Présent',
  retard: 'En retard',
  absent: 'Absent',
  excuse: 'Excusé',
};

export interface AttendanceSummary {
  recorded: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  ratePercent: number | null;
}

export interface SessionAttendance {
  session: { id: string; classId: string; className: string | null; title: string; startsAt: string; endsAt: string };
  students: { id: string; fullName: string; level: CefrLevel | null; status: string; attendance: AttendanceStatus | null; note: string | null; recordedAt: string | null }[];
}

export interface ClassAttendance {
  pastSessions: number;
  students: ({ id: string; fullName: string; level: CefrLevel | null; status: string } & AttendanceSummary)[];
}

export interface MyAttendance {
  summary: AttendanceSummary;
  records: { title: string; startsAt: string; className: string | null; attendance: AttendanceStatus; note: string | null }[];
}

export type HomeworkState = 'a_faire' | 'en_retard' | 'rendu' | 'valide' | 'a_reprendre';

export const HOMEWORK_STATE_LABELS: Record<HomeworkState, string> = {
  a_faire: 'À faire',
  en_retard: 'Non rendu, échéance passée',
  rendu: 'Rendu, en attente de correction',
  valide: 'Validé',
  a_reprendre: 'À reprendre',
};

export interface HomeworkAssignment {
  id: string;
  classId: string;
  className: string | null;
  title: string;
  instructions: string | null;
  dueAt: string;
  course: { id: string; title: string | null } | null;
  exercise: { id: string; title: string | null } | null;
  createdAt: string;
}

export interface ClassHomework extends HomeworkAssignment {
  counts: { students: number; submitted: number; toReview: number; validated: number; toRework: number };
}

export interface HomeworkDetail {
  assignment: HomeworkAssignment;
  students: {
    id: string;
    fullName: string;
    level: CefrLevel | null;
    status: string;
    state: HomeworkState;
    answer: string | null;
    submittedAt: string | null;
    late: boolean;
    teacherComment: string | null;
    reviewedAt: string | null;
  }[];
}

export interface MyHomework extends HomeworkAssignment {
  state: HomeworkState;
  submission: { answer: string | null; submittedAt: string; late: boolean; teacherComment: string | null; reviewedAt: string | null } | null;
}

export interface TeacherFeedback {
  id: string;
  studentId: string;
  targetType: 'simulation' | 'embassy_session';
  targetId: string;
  teacherName: string | null;
  comment: string;
  followUpAt: string | null;
  status: 'a_revoir' | 'traite';
  createdAt: string;
  canEdit: boolean;
}

export interface StudentFollowUp {
  student: { id: string; fullName: string; level: CefrLevel | null; status: string };
  profile: StudentProfile;
  readiness: Readiness;
  learningPath: { objective: string | null; weeklyGoals: WeeklyGoal[]; actions: PathAction[]; progressPercent: number; generatedAt: string } | null;
  simulations: SimulationSummary[];
  embassySessions: EmbassySessionSummary[];
  feedback: TeacherFeedback[];
}

export interface AdminOverview {
  students: { total: number; active7: number; active30: number; active90: number };
  simulations: { completed30: number; accuracy30: number | null };
  exercises: { attempts30: number };
  embassy: {
    sessions30: number;
    completed30: number;
    failureRate30: number | null;
    textModeShare30: number | null;
    averageScore: number | null;
    averageDurationMinutes: number | null;
  };
  ai: { monthCost: number; monthCalls: number; costPerStudent: number | null; byOperation: { operation: string; calls: number; cost: number }[] };
  leads: { total: number; new30: number; converted: number; toFollowUp: number; bySource: { source: string; total: number }[] };
  hardestQuestions: { id: string; text: string; category: string; answers: number; successRate: number }[];
  analytics: DashboardAnalytics;
}

export type DashboardDays = 7 | 30 | 90 | 365;

export interface DashboardKpi {
  value: number | null;
  previous: number | null;
}

// Analyses de la période choisie (comparées à la période précédente de même durée).
export interface DashboardAnalytics {
  period: { days: DashboardDays; start: string; end: string; granularity: 'day' | 'week' };
  kpis: Record<'activeStudents' | 'simulations' | 'accuracy' | 'exercises' | 'interviews' | 'interviewScore' | 'newLeads' | 'aiCost', DashboardKpi>;
  series: {
    date: string;
    simulations: number;
    exercises: number;
    interviews: number;
    activeStudents: number;
    accuracy: number | null;
    leads: number;
    aiCost: number;
  }[];
  breakdowns: {
    studentsByLevel: { level: string | null; count: number }[];
    leadsByStatus: { status: string; count: number }[];
    simulationsByMode: { mode: string; count: number }[];
    embassyByStatus: { status: string; count: number }[];
    categoryAccuracy: { category: string; answers: number; accuracy: number | null }[];
  };
}

export interface AdminTestTemplate {
  id: string;
  code: string;
  name: string;
  description: string | null;
  language: string;
  totalDurationSeconds: number;
  scoringRules: { correct: number; wrong: number; blank: number };
  isActive: boolean;
  version: number;
  updatedAt: string;
  simulationCount: number;
  sections: { id: string; name: string; category: string; questionCount: number; activeQuestions: number }[];
  missingQuestions: { category: string; missing: number }[];
}

// ── Tableau de bord étudiant (§16.1) ────────────────────────
export interface StudentDashboardSummary {
  simulations: {
    count: number;
    latest: { percent: number; templateName: string | null; completedAt: string } | null;
    averagePercent: number | null;
    firstPercent: number | null;
    progressionPoints: number | null;
  };
  embassy: { count: number; averageScore: number | null; averageCoherence: number | null; latestInconsistencies: number | null };
  documents: { total: number; validated: number; missing: number; needsCorrection: number; expired: number; expiringSoon: number };
  upcoming: { kind: 'class_session' | 'document_expiry'; date: string; title: string; detail: string | null; link: string }[];
  generatedAt: string;
}

// ── Conservation des données (ENF-09, ENF-11) ───────────────
export type RetentionKey = 'embassySessionsMonths' | 'suspendedStudentsMonths' | 'documentVersionsMonths' | 'leadsMonths' | 'notificationsMonths';

export interface RetentionRun {
  ranAt: string;
  trigger: 'manuel' | 'automatique';
  rules: { rule: RetentionKey; deleted: number; error?: string }[];
}

export interface RetentionSettings {
  rules: { key: RetentionKey; label: string; description: string; unit: string; months: number | null }[];
  preview: Partial<Record<RetentionKey, number>>;
  updatedAt: string;
  lastRunAt: string | null;
  lastRunResult: RetentionRun | null;
}

export interface RetentionPolicy {
  embassySessionsMonths: number | null;
  suspendedStudentsMonths: number | null;
  documentVersionsMonths: number | null;
}

// ── Réglages de session (EF-05, §22 #5) ─────────────────────
export interface SessionSettings {
  idleTimeoutMinutes: number;
  configured: boolean;
  defaultMinutes: number;
  updatedAt: string;
}

// ── Gamification (§14) ──────────────────────────────────────
export interface GamificationBadge {
  code: string;
  label: string;
  description: string;
  earned: boolean;
  awardedAt: string | null;
}

export interface Gamification {
  streakDays: number;
  weeklyGoal: { target: number; done: number; reached: boolean };
  badges: GamificationBadge[];
  earnedCount: number;
  generatedAt: string;
}

export function homeFor(role: AppRole): string {
  return { student: '/etudiant', teacher: '/enseignant', admin: '/admin/tableau-de-bord' }[role];
}
