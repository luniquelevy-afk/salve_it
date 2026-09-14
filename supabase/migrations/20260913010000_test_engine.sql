-- Salve Italia — Phase 2 : moteur de test configurable
-- Modèles de test, sections, banque de questions, simulations et réponses.
-- Réf. cahier des charges §4.2, §7, §8, §19.2 ; checklist « Intégrité des tests & anti-triche ».

-- ─────────────────────────────────────────────────────────────
-- Modèles de test (§7) — barèmes versionnés (§19.11)
-- ─────────────────────────────────────────────────────────────
create table public.test_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  language text not null default 'it',
  description text,
  total_duration_seconds int not null check (total_duration_seconds > 0),
  -- Points par bonne / mauvaise / absence de réponse (ex. TOLC : 1 / -0.25 / 0, à vérifier au règlement en vigueur).
  scoring_rules jsonb not null default '{"correct": 1, "wrong": 0, "blank": 0}'::jsonb
    check (scoring_rules ?& array['correct', 'wrong', 'blank']),
  is_active boolean not null default true,
  version int not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger test_templates_set_updated_at
  before update on public.test_templates
  for each row execute function public.set_updated_at();

create table public.test_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.test_templates (id) on delete cascade,
  name text not null,
  category text not null,
  question_count int not null check (question_count > 0),
  order_index int not null,
  unique (template_id, order_index)
);
create index test_sections_category_idx on public.test_sections (category);

-- ─────────────────────────────────────────────────────────────
-- Banque de questions (§19.2) — nombre d'options variable (TOLC : 5)
-- ─────────────────────────────────────────────────────────────
create type public.question_status as enum ('draft', 'pending_review', 'active', 'archived');

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  question_text text not null check (length(trim(question_text)) > 0),
  -- [{ "key": "A", "text": "..." }, ...]
  options jsonb not null
    check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  correct_answer text not null,
  explanation text,
  language text not null default 'it',
  source text not null default 'manual' check (source in ('manual', 'ai_generated')),
  validation_status public.question_status not null default 'draft',
  validated_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint correct_answer_is_an_option
    check (jsonb_path_exists(options, '$[*] ? (@.key == $k)', jsonb_build_object('k', correct_answer))),
  -- EF-07 : une question générée par IA n'entre jamais dans la banque active sans relecture humaine.
  constraint ai_question_requires_validation
    check (source = 'manual' or validation_status <> 'active' or validated_by is not null)
);
create index questions_draw_idx on public.questions (category, difficulty) where validation_status = 'active';

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Simulations (§8) — état conservé côté serveur pour la reprise (EF-11)
-- ─────────────────────────────────────────────────────────────
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  test_template_id uuid not null references public.test_templates (id) on delete restrict,
  template_version int not null,
  mode text not null default 'examen' check (mode in ('entrainement', 'examen', 'revision', 'defi')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  -- Le chronomètre fait autorité côté serveur : jamais recalculé depuis l'horloge du navigateur.
  deadline_at timestamptz not null,
  completed_at timestamptz,
  total_questions int not null check (total_questions > 0),
  current_position int not null default 0,
  score numeric,
  score_by_section jsonb,
  constraint deadline_after_start check (deadline_at > started_at)
);
create index simulations_student_idx on public.simulations (student_id, started_at desc);
-- Une seule simulation en cours par étudiant.
create unique index simulations_one_in_progress_idx on public.simulations (student_id) where status = 'in_progress';

-- Tirage figé au lancement : l'ordre ne peut pas être rejoué ou modifié côté client.
create table public.simulation_questions (
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  position int not null check (position >= 0),
  question_id uuid not null references public.questions (id) on delete restrict,
  section_id uuid references public.test_sections (id) on delete set null,
  primary key (simulation_id, position),
  unique (simulation_id, question_id)
);

-- Clé primaire (simulation, position) : une question déjà répondue ne peut pas être resoumise (EF-09).
create table public.simulation_answers (
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  position int not null,
  question_id uuid not null references public.questions (id) on delete restrict,
  answer_given text,
  is_correct boolean not null,
  time_spent_seconds int not null default 0 check (time_spent_seconds >= 0),
  answered_at timestamptz not null default now(),
  primary key (simulation_id, position),
  foreign key (simulation_id, position) references public.simulation_questions (simulation_id, position) on delete cascade
);
create index simulation_answers_question_idx on public.simulation_answers (question_id);

-- ─────────────────────────────────────────────────────────────
-- Fonctions d'aide RLS
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false) or public.is_admin()
$$;

create or replace function public.owns_simulation(p_simulation_id uuid, p_completed_only boolean default false)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'student', false)
    and exists (
      select 1 from public.simulations s
      where s.id = p_simulation_id
        and s.student_id = (select auth.uid())
        and (not p_completed_only or s.status <> 'in_progress')
    )
$$;

create or replace function public.can_review_simulation(p_simulation_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin()
    or exists (
      select 1 from public.simulations s
      where s.id = p_simulation_id and public.teaches_student(s.student_id)
    )
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- Toutes les écritures sur simulations / réponses passent par le backend
-- (tirage, chronomètre et correction calculés serveur).
-- ─────────────────────────────────────────────────────────────
alter table public.test_templates       enable row level security;
alter table public.test_sections        enable row level security;
alter table public.questions            enable row level security;
alter table public.simulations          enable row level security;
alter table public.simulation_questions enable row level security;
alter table public.simulation_answers   enable row level security;

revoke all on
  public.test_templates, public.test_sections, public.questions,
  public.simulations, public.simulation_questions, public.simulation_answers
from anon;

revoke insert, update, delete on
  public.simulations, public.simulation_questions, public.simulation_answers
from authenticated;

-- test_templates / test_sections
create policy "test_templates: lecture des modèles actifs, tout pour le staff"
  on public.test_templates for select to authenticated
  using ((is_active and public.is_active_user()) or public.is_staff());

create policy "test_templates: écriture admin"
  on public.test_templates for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "test_sections: lecture si le modèle est lisible"
  on public.test_sections for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.test_templates t
      where t.id = template_id and t.is_active and public.is_active_user()
    )
  );

create policy "test_sections: écriture admin"
  on public.test_sections for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- questions : jamais lisibles par un étudiant (correct_answer resterait visible via l'API).
create policy "questions: lecture staff"
  on public.questions for select to authenticated
  using (public.is_staff());

create policy "questions: création staff"
  on public.questions for insert to authenticated
  with check (public.is_staff() and created_by = (select auth.uid()));

create policy "questions: modification staff"
  on public.questions for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "questions: suppression admin"
  on public.questions for delete to authenticated
  using (public.is_admin());

-- simulations
create policy "simulations: lecture étudiant concerné, enseignant de sa classe, admin"
  on public.simulations for select to authenticated
  using (
    (student_id = (select auth.uid()) and public.current_app_role() = 'student')
    or public.teaches_student(student_id)
    or public.is_admin()
  );

create policy "simulation_questions: lecture étudiant concerné ou relecteur"
  on public.simulation_questions for select to authenticated
  using (public.owns_simulation(simulation_id) or public.can_review_simulation(simulation_id));

-- Pendant l'épreuve, l'étudiant ne lit pas is_correct : correction visible seulement une fois terminée.
create policy "simulation_answers: lecture après la fin ou par un relecteur"
  on public.simulation_answers for select to authenticated
  using (public.owns_simulation(simulation_id, true) or public.can_review_simulation(simulation_id));
