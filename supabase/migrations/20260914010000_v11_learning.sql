-- Salve Italia — V1.1 : socle pédagogique élargi
-- Profil étudiant, révision espacée, modes révision/défi, parcours personnalisé, feedback enseignant,
-- statistiques par question et agrégats des tableaux de bord.
-- Réf. cahier des charges §8, §8.1, §9, §13, §16, §19.4, §19.8.

-- ─────────────────────────────────────────────────────────────
-- Profil étudiant (§9.1, EF-39) — aucun montant exact, uniquement des fourchettes
-- ─────────────────────────────────────────────────────────────
create table public.student_profiles (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  current_education_level text
    check (current_education_level in ('lycee', 'baccalaureat', 'licence_en_cours', 'licence', 'master', 'autre')),
  diplomas jsonb not null default '[]'::jsonb check (jsonb_typeof(diplomas) = 'array'),
  english_level text check (english_level in ('aucun', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  desired_field text,
  preferred_cities jsonb not null default '[]'::jsonb check (jsonb_typeof(preferred_cities) = 'array'),
  institution_type_preference text check (institution_type_preference in ('public', 'prive', 'indifferent')),
  study_objective text check (study_objective in ('licence', 'master', 'formation_pro', 'mobilite')),
  -- Budget mensuel en fourchette (€), jamais un montant précis (§9.1, checklist données).
  budget_range text check (budget_range in ('moins_500', '500_800', '800_1200', 'plus_1200', 'non_defini')),
  financing_source text check (financing_source in ('famille', 'garant', 'bourse', 'personnel', 'non_defini')),
  project_stage text check (project_stage in ('exploration', 'choix_formation', 'preparation_tests', 'preinscription', 'visa', 'depart')),
  target_intake text,
  target_template_id uuid references public.test_templates (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger student_profiles_set_updated_at
  before update on public.student_profiles
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Révision espacée (§8.1, EF-51)
-- ─────────────────────────────────────────────────────────────
create table public.student_question_stats (
  student_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  attempts_count int not null default 0 check (attempts_count >= 0),
  correct_count int not null default 0 check (correct_count >= 0 and correct_count <= attempts_count),
  mastery_score numeric(4, 3) not null default 0 check (mastery_score between 0 and 1),
  interval_days int not null default 0 check (interval_days >= 0),
  last_correct boolean,
  last_answered_at timestamptz,
  next_review_at timestamptz not null default now(),
  primary key (student_id, question_id)
);
create index student_question_stats_due_idx on public.student_question_stats (student_id, next_review_at);

-- Modes révision (questions tirées des erreurs, sans modèle) et défi (série courte d'un modèle).
alter table public.simulations
  alter column test_template_id drop not null,
  alter column template_version drop not null,
  add constraint simulation_template_required
    check (mode = 'revision' or (test_template_id is not null and template_version is not null));

-- ─────────────────────────────────────────────────────────────
-- Parcours personnalisé (§9.2, EF-41)
-- ─────────────────────────────────────────────────────────────
create table public.learning_paths (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  objective text,
  target_template_id uuid references public.test_templates (id) on delete set null,
  weekly_goals jsonb not null default '[]'::jsonb check (jsonb_typeof(weekly_goals) = 'array'),
  recommended_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_actions) = 'array'),
  progress_percent int not null default 0 check (progress_percent between 0 and 100),
  generated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Feedback enseignant privé (§13, §19.8, EF-53) — jamais visible par l'étudiant
-- ─────────────────────────────────────────────────────────────
create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('simulation', 'embassy_session')),
  -- Référence polymorphe (simulations.id ou embassy_sessions.id), vérifiée par le backend.
  target_id uuid not null,
  teacher_id uuid references public.profiles (id) on delete set null,
  comment text not null check (length(trim(comment)) > 0),
  follow_up_at date,
  status text not null default 'a_revoir' check (status in ('a_revoir', 'traite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teacher_feedback_target_idx on public.teacher_feedback (target_type, target_id);
create index teacher_feedback_student_idx on public.teacher_feedback (student_id, created_at desc);

create trigger teacher_feedback_set_updated_at
  before update on public.teacher_feedback
  for each row execute function public.set_updated_at();

-- EF-58 : supprimer un entretien supprime aussi les commentaires qui s'y rapportent.
create or replace function public.delete_embassy_feedback()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.teacher_feedback where target_type = 'embassy_session' and target_id = old.id;
  return old;
end;
$$;

create trigger embassy_sessions_delete_feedback
  after delete on public.embassy_sessions
  for each row execute function public.delete_embassy_feedback();

-- ─────────────────────────────────────────────────────────────
-- Statistiques par question (EF-14)
-- ─────────────────────────────────────────────────────────────
create view public.question_success_stats with (security_invoker = true) as
select
  sa.question_id,
  count(*)::int as answers_count,
  (count(*) filter (where sa.is_correct))::int as correct_count,
  (count(*) filter (where sa.answer_given is null))::int as blank_count,
  round(avg(sa.time_spent_seconds))::int as avg_time_seconds
from public.simulation_answers sa
join public.simulations s on s.id = sa.simulation_id
where s.status = 'completed'
group by sa.question_id;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.student_profiles       enable row level security;
alter table public.student_question_stats enable row level security;
alter table public.learning_paths         enable row level security;
alter table public.teacher_feedback       enable row level security;

revoke all on public.student_profiles, public.student_question_stats, public.learning_paths, public.teacher_feedback from anon;
revoke insert, update, delete on public.student_profiles, public.student_question_stats, public.learning_paths, public.teacher_feedback from authenticated;
revoke all on public.question_success_stats from anon, authenticated;

create policy "student_profiles: étudiant concerné, enseignant de sa classe, admin"
  on public.student_profiles for select to authenticated
  using ((student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(student_id) or public.is_admin());

create policy "student_question_stats: étudiant concerné, enseignant de sa classe, admin"
  on public.student_question_stats for select to authenticated
  using ((student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(student_id) or public.is_admin());

create policy "learning_paths: étudiant concerné, enseignant de sa classe, admin"
  on public.learning_paths for select to authenticated
  using ((student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(student_id) or public.is_admin());

-- Feedback privé : enseignants de l'étudiant et admin uniquement.
create policy "teacher_feedback: enseignant de la classe ou admin"
  on public.teacher_feedback for select to authenticated
  using (public.teaches_student(student_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Agrégats des tableaux de bord (§16) — exécutables par le backend uniquement
-- ─────────────────────────────────────────────────────────────
create or replace function public.teacher_overview(p_teacher_id uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
with my_classes as (
  select c.id, c.name
  from public.classes c
  where c.is_active and (p_teacher_id is null or c.teacher_id = p_teacher_id)
),
my_students as (
  select distinct cs.student_id from public.class_students cs join my_classes mc on mc.id = cs.class_id
),
recent_answers as (
  select s.student_id, sa.question_id, sa.is_correct, q.category
  from public.simulation_answers sa
  join public.simulations s on s.id = sa.simulation_id
  join public.questions q on q.id = sa.question_id
  join my_students ms on ms.student_id = s.student_id
  where s.status = 'completed' and s.completed_at >= now() - interval '30 days'
),
student_rows as (
  select
    p.id,
    p.full_name,
    p.level,
    greatest(
      (select max(s.started_at) from public.simulations s where s.student_id = p.id),
      (select max(e.created_at) from public.exercise_attempts e where e.student_id = p.id),
      (select max(es.started_at) from public.embassy_sessions es where es.student_id = p.id)
    ) as last_activity_at,
    (select string_agg(mc.name, ', ' order by mc.name) from public.class_students cs join my_classes mc on mc.id = cs.class_id where cs.student_id = p.id) as class_names,
    (select count(*) from recent_answers ra where ra.student_id = p.id) as answers_30,
    (select round(100.0 * avg(case when ra.is_correct then 1 else 0 end)) from recent_answers ra where ra.student_id = p.id) as accuracy_30,
    (select count(*) from public.simulations s where s.student_id = p.id and s.status = 'completed' and s.completed_at >= now() - interval '30 days') as simulations_30,
    (select round(avg(es.overall_score)) from public.embassy_sessions es where es.student_id = p.id and es.status = 'completed') as embassy_average
  from my_students ms
  join public.profiles p on p.id = ms.student_id
  where p.status = 'active'
)
select jsonb_build_object(
  'classes', coalesce((
    select jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'studentCount', (select count(*) from public.class_students cs where cs.class_id = mc.id)) order by mc.name)
    from my_classes mc
  ), '[]'::jsonb),
  'students', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sr.id,
      'fullName', sr.full_name,
      'level', sr.level,
      'classNames', sr.class_names,
      'lastActivityAt', sr.last_activity_at,
      'simulations30', sr.simulations_30,
      'answers30', sr.answers_30,
      'accuracy30', sr.accuracy_30,
      'embassyAverage', sr.embassy_average,
      'inactive', sr.last_activity_at is null or sr.last_activity_at < now() - interval '14 days',
      'atRisk', sr.last_activity_at is null or sr.last_activity_at < now() - interval '14 days' or (sr.answers_30 >= 10 and sr.accuracy_30 < 50)
    ) order by sr.full_name)
    from student_rows sr
  ), '[]'::jsonb),
  'weakCategories', coalesce((
    select jsonb_agg(jsonb_build_object('category', w.category, 'answers', w.answers, 'accuracy', w.accuracy) order by w.accuracy, w.category)
    from (
      select ra.category, count(*) as answers, round(100.0 * avg(case when ra.is_correct then 1 else 0 end)) as accuracy
      from recent_answers ra
      group by ra.category
      having count(*) >= 5
      order by accuracy
      limit 5
    ) w
  ), '[]'::jsonb),
  'hardestQuestions', coalesce((
    select jsonb_agg(jsonb_build_object('id', h.question_id, 'text', q.question_text, 'category', q.category, 'answers', h.answers, 'successRate', h.success_rate) order by h.success_rate, h.answers desc)
    from (
      select ra.question_id, count(*) as answers, round(100.0 * avg(case when ra.is_correct then 1 else 0 end)) as success_rate
      from recent_answers ra
      group by ra.question_id
      having count(*) >= 3
      order by success_rate
      limit 8
    ) h
    join public.questions q on q.id = h.question_id
  ), '[]'::jsonb),
  -- §16.2 : rapports et examens récents sans commentaire enseignant.
  'toReview', coalesce((
    select jsonb_agg(jsonb_build_object('type', r.item_type, 'id', r.id, 'studentId', r.student_id, 'studentName', r.full_name, 'completedAt', r.completed_at, 'score', r.score, 'label', r.label) order by r.completed_at desc)
    from (
      select 'embassy_session' as item_type, es.id, es.student_id, p.full_name, es.completed_at, es.overall_score::numeric as score, es.visa_type as label
      from public.embassy_sessions es
      join my_students ms on ms.student_id = es.student_id
      join public.profiles p on p.id = es.student_id
      where es.status = 'completed' and es.completed_at >= now() - interval '30 days'
        and not exists (select 1 from public.teacher_feedback tf where tf.target_type = 'embassy_session' and tf.target_id = es.id)
      union all
      select 'simulation', s.id, s.student_id, p.full_name, s.completed_at, s.score, s.mode
      from public.simulations s
      join my_students ms on ms.student_id = s.student_id
      join public.profiles p on p.id = s.student_id
      where s.status = 'completed' and s.mode = 'examen' and s.completed_at >= now() - interval '14 days'
        and not exists (select 1 from public.teacher_feedback tf where tf.target_type = 'simulation' and tf.target_id = s.id)
      order by completed_at desc
      limit 20
    ) r
  ), '[]'::jsonb),
  'followUps', coalesce((
    select jsonb_agg(jsonb_build_object('id', tf.id, 'studentId', tf.student_id, 'studentName', p.full_name, 'comment', tf.comment, 'followUpAt', tf.follow_up_at) order by tf.follow_up_at)
    from public.teacher_feedback tf
    join my_students ms on ms.student_id = tf.student_id
    join public.profiles p on p.id = tf.student_id
    where tf.status = 'a_revoir' and tf.follow_up_at is not null and tf.follow_up_at <= current_date + 7
      and (p_teacher_id is null or tf.teacher_id = p_teacher_id)
  ), '[]'::jsonb)
)
$$;

create or replace function public.admin_overview()
returns jsonb
language sql stable
set search_path = ''
as $$
with activity as (
  select a.student_id, max(a.at) as last_at
  from (
    select student_id, started_at as at from public.simulations
    union all select student_id, created_at from public.exercise_attempts
    union all select student_id, started_at from public.embassy_sessions
  ) a
  join public.profiles p on p.id = a.student_id and p.status = 'active'
  group by a.student_id
),
month_usage as (
  select * from public.ai_usage_logs where created_at >= date_trunc('month', now())
),
embassy_30 as (
  select * from public.embassy_sessions where started_at >= now() - interval '30 days'
)
select jsonb_build_object(
  'students', jsonb_build_object(
    'total', (select count(*) from public.profiles where role = 'student' and status = 'active'),
    'active7', (select count(*) from activity where last_at >= now() - interval '7 days'),
    'active30', (select count(*) from activity where last_at >= now() - interval '30 days'),
    'active90', (select count(*) from activity where last_at >= now() - interval '90 days')
  ),
  'simulations', jsonb_build_object(
    'completed30', (select count(*) from public.simulations where status = 'completed' and completed_at >= now() - interval '30 days'),
    'accuracy30', (
      select round(100.0 * avg(case when sa.is_correct then 1 else 0 end))
      from public.simulation_answers sa join public.simulations s on s.id = sa.simulation_id
      where s.status = 'completed' and s.completed_at >= now() - interval '30 days'
    )
  ),
  'exercises', jsonb_build_object('attempts30', (select count(*) from public.exercise_attempts where created_at >= now() - interval '30 days')),
  'embassy', jsonb_build_object(
    'sessions30', (select count(*) from embassy_30),
    'completed30', (select count(*) from embassy_30 where status = 'completed'),
    'failureRate30', (select round(100.0 * count(*) filter (where status = 'failed') / nullif(count(*), 0)) from embassy_30),
    'textModeShare30', (select round(100.0 * count(*) filter (where input_mode = 'text') / nullif(count(*), 0)) from embassy_30),
    'averageScore', (select round(avg(overall_score)) from public.embassy_sessions where status = 'completed'),
    'averageDurationMinutes', (select round(avg(extract(epoch from (ended_at - started_at)) / 60)) from embassy_30 where ended_at is not null)
  ),
  'ai', jsonb_build_object(
    'monthCost', (select coalesce(round(sum(estimated_cost), 4), 0) from month_usage),
    'monthCalls', (select count(*) from month_usage),
    'costPerStudent', (select round(sum(estimated_cost) / nullif(count(distinct student_id), 0), 4) from month_usage),
    'byOperation', coalesce((
      select jsonb_agg(jsonb_build_object('operation', o.operation, 'calls', o.calls, 'cost', o.cost) order by o.cost desc)
      from (select operation, count(*) as calls, round(sum(estimated_cost), 4) as cost from month_usage group by operation) o
    ), '[]'::jsonb)
  ),
  'leads', jsonb_build_object(
    'total', (select count(*) from public.leads),
    'new30', (select count(*) from public.leads where created_at >= now() - interval '30 days'),
    'converted', (select count(*) from public.leads where status = 'inscrit'),
    'toFollowUp', (select count(*) from public.leads where next_follow_up_at <= now() and status not in ('inscrit', 'non_interesse')),
    'bySource', coalesce((
      select jsonb_agg(jsonb_build_object('source', l.source, 'total', l.total))
      from (select source, count(*) as total from public.leads group by source) l
    ), '[]'::jsonb)
  ),
  'hardestQuestions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.question_text, 'category', q.category, 'answers', st.answers_count,
      'successRate', round(100.0 * st.correct_count / st.answers_count)
    ) order by st.correct_count::numeric / st.answers_count, st.answers_count desc)
    from (
      select * from public.question_success_stats
      where answers_count >= 5
      order by correct_count::numeric / answers_count
      limit 10
    ) st
    join public.questions q on q.id = st.question_id
  ), '[]'::jsonb)
)
$$;

revoke execute on function public.teacher_overview(uuid) from public, anon, authenticated;
revoke execute on function public.admin_overview() from public, anon, authenticated;
grant execute on function public.teacher_overview(uuid) to service_role;
grant execute on function public.admin_overview() to service_role;
