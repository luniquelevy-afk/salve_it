-- Salve Italia — Phase 4 : contenu pédagogique
-- Cours, exercices interactifs, test de niveau gratuit, calendrier des cours.
-- Réf. cahier des charges §4.4 (EF-24 à EF-29), §19.5.
-- Toutes les écritures passent par le backend ; la RLS reste une défense en profondeur.

-- ─────────────────────────────────────────────────────────────
-- Cours (EF-24, EF-26)
-- ─────────────────────────────────────────────────────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  level public.cefr_level not null,
  category text not null,
  content_type text not null check (content_type in ('text', 'pdf', 'video', 'audio', 'link')),
  body text,
  content_url text,
  -- null : visible par tous les étudiants ; sinon réservé à une classe.
  class_id uuid references public.classes (id) on delete set null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_content_present check (
    (content_type = 'text' and body is not null and length(trim(body)) > 0)
    or (content_type <> 'text' and content_url is not null)
  ),
  constraint course_url_https check (content_url is null or content_url ~ '^https://')
);
create index courses_level_idx on public.courses (level, category) where is_published;

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Exercices interactifs (EF-25) : la solution n'est jamais lisible par un étudiant
-- ─────────────────────────────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  level public.cefr_level not null,
  category text not null,
  exercise_type text not null check (exercise_type in ('qcm', 'texte_a_trous', 'appariement')),
  instructions text,
  -- Partie affichée à l'étudiant (énoncés, options, éléments à apparier).
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  -- Réponses attendues, utilisées uniquement par le backend pour corriger.
  solution jsonb not null check (jsonb_typeof(solution) = 'object'),
  is_published boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exercises_level_idx on public.exercises (level, category) where is_published;
create index exercises_course_idx on public.exercises (course_id);

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null,
  score int not null check (score >= 0),
  max_score int not null check (max_score > 0 and score <= max_score),
  created_at timestamptz not null default now()
);
create index exercise_attempts_student_idx on public.exercise_attempts (student_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Test de niveau gratuit, sans compte (EF-27)
-- ─────────────────────────────────────────────────────────────
create table public.level_test_questions (
  id uuid primary key default gen_random_uuid(),
  level public.cefr_level not null,
  question_text text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_answer text not null,
  order_index int not null,
  is_active boolean not null default true,
  constraint level_test_answer_is_an_option
    check (jsonb_path_exists(options, '$[*] ? (@.key == $k)', jsonb_build_object('k', correct_answer)))
);
create unique index level_test_questions_order_idx on public.level_test_questions (order_index);

-- Coordonnées facultatives, uniquement avec consentement : alimenteront le CRM prospects (V1.2).
create table public.level_test_attempts (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null,
  score int not null,
  total int not null check (total > 0),
  estimated_level public.cefr_level,
  full_name text,
  email text,
  phone text,
  desired_program text,
  contact_consent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_requires_consent check (
    contact_consent or (full_name is null and email is null and phone is null)
  )
);
create index level_test_attempts_created_idx on public.level_test_attempts (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Calendrier des cours (EF-28)
-- ─────────────────────────────────────────────────────────────
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint class_session_duration check (ends_at > starts_at)
);
create index class_sessions_class_idx on public.class_sessions (class_id, starts_at);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.courses              enable row level security;
alter table public.exercises            enable row level security;
alter table public.exercise_attempts    enable row level security;
alter table public.level_test_questions enable row level security;
alter table public.level_test_attempts  enable row level security;
alter table public.class_sessions       enable row level security;

revoke all on
  public.courses, public.exercises, public.exercise_attempts,
  public.level_test_questions, public.level_test_attempts, public.class_sessions
from anon;

revoke insert, update, delete on
  public.courses, public.exercises, public.exercise_attempts,
  public.level_test_questions, public.level_test_attempts, public.class_sessions
from authenticated;

create policy "courses: lecture staff, ou étudiant pour un cours publié qui le concerne"
  on public.courses for select to authenticated
  using (
    public.is_staff()
    or (
      is_published
      and public.current_app_role() = 'student'
      and (class_id is null or public.in_class(class_id))
    )
  );

-- Pas de lecture étudiant : la colonne solution serait exposée. Le backend sert la partie publique.
create policy "exercises: lecture staff"
  on public.exercises for select to authenticated
  using (public.is_staff());

create policy "exercise_attempts: lecture étudiant concerné, enseignant de sa classe, admin"
  on public.exercise_attempts for select to authenticated
  using (
    (student_id = (select auth.uid()) and public.current_app_role() = 'student')
    or public.teaches_student(student_id)
    or public.is_admin()
  );

create policy "level_test_questions: lecture staff"
  on public.level_test_questions for select to authenticated
  using (public.is_staff());

-- Coordonnées de prospects : admin uniquement.
create policy "level_test_attempts: lecture admin"
  on public.level_test_attempts for select to authenticated
  using (public.is_admin());

create policy "class_sessions: lecture admin, enseignant titulaire, étudiant membre"
  on public.class_sessions for select to authenticated
  using (public.is_admin() or public.teaches_class(class_id) or public.in_class(class_id));
