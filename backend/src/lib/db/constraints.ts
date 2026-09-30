// Contraintes CHECK et déclencheurs portés des migrations SQL : Firestore ne les applique pas,
// la couche d'accès les vérifie à chaque écriture (code d'erreur Postgres 23514 conservé).
import type { Row } from './types.js';

type Check = [name: string, predicate: (row: Row) => boolean];

const present = (value: unknown) => value !== null && value !== undefined;
const nonBlank = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const httpsOrNull = (value: unknown) => !present(value) || (typeof value === 'string' && value.startsWith('https://'));
const between = (value: unknown, min: number, max: number) => !present(value) || (typeof value === 'number' && value >= min && value <= max);
const CODE = /^[a-z0-9_]+$/;
const VISA_TYPES = ['etudes', 'tourisme', 'travail'];

function isOption(options: unknown, key: unknown): boolean {
  return Array.isArray(options) && options.some((option) => (option as { key?: unknown } | null)?.key === key);
}

export const CHECKS: Record<string, Check[]> = {
  profiles: [
    ['profiles_full_name_check', (r) => nonBlank(r.full_name)],
    ['level_only_for_students', (r) => r.role === 'student' || !present(r.level)],
  ],
  programs: [
    ['programs_slug_format', (r) => !present(r.slug) || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(r.slug))],
    ['programs_public_requires_slug', (r) => !r.is_public || present(r.slug)],
    ['programs_objectives_array', (r) => Array.isArray(r.objectives)],
  ],
  announcements: [['class_target_consistency', (r) => (r.target === 'class') === present(r.target_class_id)]],
  test_templates: [
    ['test_templates_total_duration_seconds_check', (r) => typeof r.total_duration_seconds === 'number' && r.total_duration_seconds > 0],
    ['test_templates_scoring_rules_check', (r) => ['correct', 'wrong', 'blank'].every((key) => typeof r.scoring_rules === 'object' && r.scoring_rules !== null && key in r.scoring_rules)],
  ],
  test_sections: [['test_sections_question_count_check', (r) => typeof r.question_count === 'number' && r.question_count > 0]],
  questions: [
    ['questions_difficulty_check', (r) => between(r.difficulty, 1, 3)],
    ['questions_question_text_check', (r) => nonBlank(r.question_text)],
    ['questions_options_check', (r) => Array.isArray(r.options) && r.options.length >= 2 && r.options.length <= 6],
    ['correct_answer_is_an_option', (r) => isOption(r.options, r.correct_answer)],
    ['ai_question_requires_validation', (r) => r.source === 'manual' || r.validation_status !== 'active' || present(r.validated_by)],
    ['generated_from_requires_ai', (r) => !present(r.generated_from) || r.source === 'ai_generated'],
  ],
  simulations: [
    ['simulations_total_questions_check', (r) => typeof r.total_questions === 'number' && r.total_questions > 0],
    ['deadline_after_start', (r) => String(r.deadline_at) > String(r.started_at)],
    ['simulation_template_required', (r) => r.mode === 'revision' || (present(r.test_template_id) && present(r.template_version))],
  ],
  simulation_questions: [['simulation_questions_position_check', (r) => typeof r.position === 'number' && r.position >= 0]],
  simulation_answers: [['simulation_answers_time_spent_seconds_check', (r) => typeof r.time_spent_seconds === 'number' && r.time_spent_seconds >= 0]],
  embassy_sessions: [
    ['embassy_sessions_max_turns_check', (r) => between(r.max_turns, 1, 30)],
    ['embassy_sessions_overall_score_check', (r) => between(r.overall_score, 0, 100)],
    ['report_only_when_completed', (r) => (r.status === 'completed') === present(r.ai_report)],
    ['profile_snapshot_requires_consent', (r) => Boolean(r.uses_profile) || !present(r.profile_snapshot)],
  ],
  embassy_messages: [['embassy_messages_sequence_number_check', (r) => typeof r.sequence_number === 'number' && r.sequence_number >= 0]],
  courses: [
    ['courses_title_check', (r) => nonBlank(r.title)],
    ['course_content_present', (r) => (r.content_type === 'text' ? nonBlank(r.body) : present(r.content_url))],
    ['course_url_https', (r) => httpsOrNull(r.content_url)],
  ],
  exercises: [
    ['exercises_title_check', (r) => nonBlank(r.title)],
    ['exercises_content_check', (r) => typeof r.content === 'object' && r.content !== null && !Array.isArray(r.content)],
    ['exercises_solution_check', (r) => typeof r.solution === 'object' && r.solution !== null && !Array.isArray(r.solution)],
  ],
  exercise_attempts: [
    ['exercise_attempts_score_check', (r) => typeof r.score === 'number' && r.score >= 0],
    ['exercise_attempts_max_score_check', (r) => typeof r.max_score === 'number' && r.max_score > 0 && (r.score as number) <= r.max_score],
  ],
  level_test_questions: [['level_test_answer_is_an_option', (r) => isOption(r.options, r.correct_answer)]],
  level_test_attempts: [['contact_requires_consent', (r) => Boolean(r.contact_consent) || (!present(r.full_name) && !present(r.email) && !present(r.phone))]],
  class_sessions: [['class_session_duration', (r) => String(r.ends_at) > String(r.starts_at)]],
  site_settings: [['site_settings_urls_https', (r) => httpsOrNull(r.facebook_url) && httpsOrNull(r.instagram_url) && httpsOrNull(r.map_url)]],
  testimonials: [
    ['testimonials_quote_check', (r) => nonBlank(r.quote)],
    ['testimonials_photo_url_check', (r) => httpsOrNull(r.photo_url)],
    ['testimonial_publication_requires_consent', (r) => !r.is_published || Boolean(r.consent_confirmed)],
  ],
  faq_items: [['faq_items_text_check', (r) => nonBlank(r.question) && nonBlank(r.answer)]],
  gallery_images: [['gallery_images_check', (r) => typeof r.image_url === 'string' && r.image_url.startsWith('https://') && nonBlank(r.alt_text)]],
  leads: [
    ['leads_contact_consent_check', (r) => r.contact_consent === true],
    ['lead_reachable', (r) => present(r.phone) || present(r.email)],
  ],
  student_question_stats: [['student_question_stats_correct_count_check', (r) => (r.correct_count as number) >= 0 && (r.correct_count as number) <= (r.attempts_count as number)]],
  learning_paths: [['learning_paths_progress_percent_check', (r) => between(r.progress_percent, 0, 100)]],
  teacher_feedback: [['teacher_feedback_comment_check', (r) => nonBlank(r.comment)]],
  document_types: [['document_types_code_check', (r) => CODE.test(String(r.code))]],
  checklist_requirements: [
    ['checklist_requirements_code_check', (r) => CODE.test(String(r.code))],
    ['checklist_requirements_source_url_check', (r) => httpsOrNull(r.source_url)],
    ['checklist_requirements_visa_types_check', (r) => Array.isArray(r.visa_types) && r.visa_types.length > 0 && r.visa_types.every((v) => VISA_TYPES.includes(v as string))],
  ],
  student_documents: [
    ['student_documents_size_bytes_check', (r) => typeof r.size_bytes === 'number' && r.size_bytes > 0 && r.size_bytes <= 10_485_760],
    ['correction_requires_comment', (r) => r.status !== 'needs_correction' || present(r.reviewer_comment)],
  ],
  notifications: [['notifications_link_check', (r) => !present(r.link) || /^\/[^/]/.test(String(r.link))]],
  embassy_scenarios: [
    ['embassy_scenarios_code_check', (r) => CODE.test(String(r.code))],
    ['embassy_scenarios_visa_types_check', (r) => Array.isArray(r.visa_types) && r.visa_types.length > 0 && r.visa_types.every((v) => VISA_TYPES.includes(v as string))],
  ],
  ai_settings: [['ai_settings_max_turns_check', (r) => between(r.max_turns, 2, 30) && between(r.weekly_session_limit, 0, 100)]],
  student_ai_limits: [['student_ai_limits_not_empty', (r) => present(r.weekly_session_limit) || present(r.monthly_cost_limit_usd)]],
  retention_settings: [
    [
      'retention_settings_months_check',
      (r) => ['embassy_sessions_months', 'suspended_students_months', 'document_versions_months', 'leads_months', 'notifications_months'].every((key) => between(r[key], 1, 120)),
    ],
  ],
  class_attendance: [['class_attendance_note_check', (r) => !present(r.note) || String(r.note).length <= 300]],
  homework_assignments: [['homework_assignments_title_check', (r) => nonBlank(r.title) && String(r.title).trim().length <= 200]],
  homework_submissions: [['rework_requires_comment', (r) => r.status !== 'a_reprendre' || present(r.teacher_comment)]],
  session_settings: [['session_settings_idle_timeout_minutes_check', (r) => between(r.idle_timeout_minutes, 1, 240)]],
};

// Tables munies du déclencheur set_updated_at() : updated_at = now() à chaque mise à jour.
export const TOUCH_UPDATED_AT = new Set([
  'profiles', 'test_templates', 'questions', 'courses', 'exercises', 'site_settings', 'leads', 'student_profiles',
  'teacher_feedback', 'checklist_requirements', 'student_documents', 'embassy_scenarios', 'ai_settings',
  'student_ai_limits', 'homework_assignments', 'session_settings',
]);

// Déclencheurs BEFORE UPDATE spécifiques.
export function beforeUpdate(table: string, previous: Row, next: Row, now: string): void {
  if (TOUCH_UPDATED_AT.has(table)) next.updated_at = now;
  // profiles_track_suspension : date de suspension, base des durées de conservation (ENF-09).
  if (table === 'profiles' && next.status !== previous.status) {
    next.suspended_at = next.status === 'suspended' ? now : null;
  }
}

// Déclencheurs AFTER DELETE : suppressions liées sans clé étrangère (cible polymorphe).
export const DELETE_TRIGGERS: Record<string, { table: string; match: (deleted: Row) => Record<string, unknown> }[]> = {
  embassy_sessions: [{ table: 'teacher_feedback', match: (deleted) => ({ target_type: 'embassy_session', target_id: deleted.id }) }],
};
