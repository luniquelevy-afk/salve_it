-- Salve Italia — §13 : présence aux séances et devoirs de classe ; §15 : notifications de devoirs ;
-- §16.2 : présence et devoirs non terminés dans le tableau de bord enseignant.

-- ─────────────────────────────────────────────────────────────
-- Présence
-- ─────────────────────────────────────────────────────────────
create table public.class_attendance (
  session_id uuid not null references public.class_sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('present', 'retard', 'absent', 'excuse')),
  note text check (note is null or length(note) <= 300),
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
create index class_attendance_student_idx on public.class_attendance (student_id);

-- ─────────────────────────────────────────────────────────────
-- Devoirs
-- ─────────────────────────────────────────────────────────────
create table public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  instructions text check (instructions is null or length(instructions) <= 5000),
  due_at timestamptz not null,
  course_id uuid references public.courses (id) on delete set null,
  exercise_id uuid references public.exercises (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index homework_assignments_class_due_idx on public.homework_assignments (class_id, due_at);
create index homework_assignments_due_idx on public.homework_assignments (due_at);

create trigger homework_assignments_set_updated_at
  before update on public.homework_assignments
  for each row execute function public.set_updated_at();

create table public.homework_submissions (
  assignment_id uuid not null references public.homework_assignments (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'rendu' check (status in ('rendu', 'valide', 'a_reprendre')),
  answer text check (answer is null or length(answer) <= 5000),
  submitted_at timestamptz not null default now(),
  teacher_comment text check (teacher_comment is null or length(teacher_comment) <= 2000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  primary key (assignment_id, student_id),
  -- Une reprise demandée explique toujours à l'étudiant ce qu'il doit corriger.
  constraint rework_requires_comment check (status <> 'a_reprendre' or teacher_comment is not null)
);
create index homework_submissions_student_idx on public.homework_submissions (student_id);

-- ─────────────────────────────────────────────────────────────
-- RLS : lecture cloisonnée, écritures backend uniquement
-- ─────────────────────────────────────────────────────────────
alter table public.class_attendance     enable row level security;
alter table public.homework_assignments enable row level security;
alter table public.homework_submissions enable row level security;

revoke all on public.class_attendance, public.homework_assignments, public.homework_submissions from anon;
revoke insert, update, delete on public.class_attendance, public.homework_assignments, public.homework_submissions from authenticated;

create policy "class_attendance: étudiant concerné, enseignant de la classe, admin"
  on public.class_attendance for select to authenticated
  using (
    (student_id = (select auth.uid()) and public.current_app_role() = 'student')
    or exists (select 1 from public.class_sessions cs where cs.id = session_id and public.teaches_class(cs.class_id))
    or public.is_admin()
  );

create policy "homework_assignments: membres de la classe, enseignant, admin"
  on public.homework_assignments for select to authenticated
  using (public.in_class(class_id) or public.teaches_class(class_id) or public.is_admin());

create policy "homework_submissions: étudiant concerné, enseignant de la classe, admin"
  on public.homework_submissions for select to authenticated
  using (
    (student_id = (select auth.uid()) and public.current_app_role() = 'student')
    or exists (select 1 from public.homework_assignments ha where ha.id = assignment_id and public.teaches_class(ha.class_id))
    or public.is_admin()
  );

-- ─────────────────────────────────────────────────────────────
-- Notifications de devoirs (§15)
-- ─────────────────────────────────────────────────────────────
alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (type in (
  'document_submitted', 'document_validated', 'document_needs_correction', 'document_expiring',
  'embassy_report_ready', 'announcement', 'lead_follow_up',
  'class_session_scheduled', 'class_session_reminder', 'simulation_recommended',
  'homework_assigned', 'homework_due_soon', 'homework_reviewed'
));

-- ─────────────────────────────────────────────────────────────
-- Tableau de bord enseignant (§16.2) : présence et devoirs non terminés
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
    (select round(avg(es.overall_score)) from public.embassy_sessions es where es.student_id = p.id and es.status = 'completed') as embassy_average,
    -- Présence : présents et retards sur les séances non excusées des 30 derniers jours.
    (
      select round(100.0 * count(*) filter (where ca.status in ('present', 'retard')) / nullif(count(*) filter (where ca.status <> 'excuse'), 0))
      from public.class_attendance ca
      join public.class_sessions css on css.id = ca.session_id
      join my_classes mc on mc.id = css.class_id
      where ca.student_id = p.id and css.starts_at >= now() - interval '30 days'
    ) as attendance_30,
    (
      select count(*)
      from public.homework_assignments ha
      join my_classes mc on mc.id = ha.class_id
      join public.class_students cs on cs.class_id = ha.class_id and cs.student_id = p.id
      where ha.due_at < now() and ha.due_at >= now() - interval '60 days'
        and not exists (select 1 from public.homework_submissions hs where hs.assignment_id = ha.id and hs.student_id = p.id)
    ) as homework_missing
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
      'attendanceRate30', sr.attendance_30,
      'homeworkMissing', sr.homework_missing,
      'inactive', sr.last_activity_at is null or sr.last_activity_at < now() - interval '14 days',
      'atRisk', sr.last_activity_at is null or sr.last_activity_at < now() - interval '14 days' or (sr.answers_30 >= 10 and sr.accuracy_30 < 50)
        or (sr.attendance_30 is not null and sr.attendance_30 < 70) or sr.homework_missing >= 3
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
  ), '[]'::jsonb),
  -- §16.2 « devoirs non terminés » : échéances des 14 derniers et 7 prochains jours.
  'homework', coalesce((
    select jsonb_agg(jsonb_build_object('id', h.id, 'title', h.title, 'classId', h.class_id, 'className', h.class_name, 'dueAt', h.due_at, 'students', h.students, 'submitted', h.submitted, 'toReview', h.to_review) order by h.due_at)
    from (
      select ha.id, ha.title, ha.class_id, mc.name as class_name, ha.due_at,
        (select count(*) from public.class_students cs join public.profiles pr on pr.id = cs.student_id and pr.status = 'active' where cs.class_id = ha.class_id) as students,
        (select count(*) from public.homework_submissions hs where hs.assignment_id = ha.id) as submitted,
        (select count(*) from public.homework_submissions hs where hs.assignment_id = ha.id and hs.status = 'rendu') as to_review
      from public.homework_assignments ha
      join my_classes mc on mc.id = ha.class_id
      where ha.due_at >= now() - interval '14 days' and ha.due_at <= now() + interval '7 days'
      order by ha.due_at
      limit 20
    ) h
  ), '[]'::jsonb)
)
$$;
