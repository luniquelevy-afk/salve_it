-- Salve Italia — Phase 1 : fondations
-- Profils à 3 rôles, programmes, classes, inscriptions, annonces, journal d'audit.
-- Réf. cahier des charges §3, §19.1, §19.10, §19.12.

-- ─────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────
create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.account_status as enum ('active', 'suspended');
create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role public.app_role not null,
  full_name text not null check (length(trim(full_name)) > 0),
  phone text,
  level public.cefr_level,
  status public.account_status not null default 'active',
  must_change_password boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint level_only_for_students check (role = 'student' or level is null)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level public.cefr_level,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  program_id uuid references public.programs (id) on delete set null,
  teacher_id uuid references public.profiles (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index classes_teacher_id_idx on public.classes (teacher_id);
create index classes_program_id_idx on public.classes (program_id);

create table public.class_students (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_students_student_id_idx on public.class_students (student_id);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'completed', 'suspended')),
  enrolled_at timestamptz not null default now(),
  unique (student_id, program_id)
);
create index enrollments_program_id_idx on public.enrollments (program_id);

-- 'class' ajouté aux cibles du §19.1 : annonce d'un enseignant limitée à une classe (EF-29).
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target text not null default 'all' check (target in ('all', 'students', 'teachers', 'class')),
  target_class_id uuid references public.classes (id) on delete cascade,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  constraint class_target_consistency check ((target = 'class') = (target_class_id is not null))
);
create index announcements_target_class_id_idx on public.announcements (target_class_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────
-- Fonctions d'aide RLS
-- security definer : lisent profiles/classes sans repasser par leurs propres policies
-- (évite la récursion). Un compte suspendu n'obtient aucun rôle → perte d'accès
-- immédiate en base, sans attendre l'expiration du JWT (EF-03).
-- ─────────────────────────────────────────────────────────────
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = (select auth.uid()) and p.status = 'active'
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_app_role() is not null
$$;

-- Les privilèges admin en base exigent une session MFA (aal2).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    public.current_app_role() = 'admin' and (select auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;

create or replace function public.teaches_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false)
    and exists (
      select 1 from public.classes c
      where c.id = p_class_id and c.teacher_id = (select auth.uid()) and c.is_active
    )
$$;

create or replace function public.teaches_student(p_student_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'teacher', false)
    and exists (
      select 1
      from public.class_students cs
      join public.classes c on c.id = cs.class_id
      where cs.student_id = p_student_id
        and c.teacher_id = (select auth.uid())
        and c.is_active
    )
$$;

create or replace function public.in_class(p_class_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'student', false)
    and exists (
      select 1 from public.class_students cs
      where cs.class_id = p_class_id and cs.student_id = (select auth.uid())
    )
$$;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — activée sur toutes les tables, sans exception
-- ─────────────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.programs       enable row level security;
alter table public.classes        enable row level security;
alter table public.class_students enable row level security;
alter table public.enrollments    enable row level security;
alter table public.announcements  enable row level security;
alter table public.audit_logs     enable row level security;

-- Défense en profondeur : le rôle anon n'a aucun accès à ces tables.
revoke all on
  public.profiles, public.programs, public.classes, public.class_students,
  public.enrollments, public.announcements, public.audit_logs
from anon;

-- Profils et audit : écriture uniquement via le backend (clé service + audit_logs).
revoke insert, update, delete on public.profiles, public.audit_logs from authenticated;

-- profiles
create policy "profiles: lecture de son propre profil"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) and public.is_active_user());

create policy "profiles: lecture admin"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "profiles: enseignant lit les étudiants de ses classes"
  on public.profiles for select to authenticated
  using (role = 'student' and public.teaches_student(id));

-- programs
create policy "programs: lecture par tout utilisateur actif"
  on public.programs for select to authenticated
  using (public.is_active_user());

create policy "programs: écriture admin"
  on public.programs for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- classes
create policy "classes: lecture admin, enseignant titulaire, étudiant membre"
  on public.classes for select to authenticated
  using (public.is_admin() or public.teaches_class(id) or public.in_class(id));

create policy "classes: écriture admin"
  on public.classes for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- class_students
create policy "class_students: lecture admin, enseignant de la classe, étudiant concerné"
  on public.class_students for select to authenticated
  using (
    public.is_admin()
    or public.teaches_class(class_id)
    or (student_id = (select auth.uid()) and public.is_active_user())
  );

create policy "class_students: écriture admin"
  on public.class_students for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- enrollments
create policy "enrollments: lecture admin, étudiant concerné, enseignant de ses classes"
  on public.enrollments for select to authenticated
  using (
    public.is_admin()
    or (student_id = (select auth.uid()) and public.is_active_user())
    or public.teaches_student(student_id)
  );

create policy "enrollments: écriture admin"
  on public.enrollments for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- announcements
create policy "announcements: lecture selon la cible"
  on public.announcements for select to authenticated
  using (
    public.is_admin()
    or (
      public.is_active_user()
      and (
        published_by = (select auth.uid())
        or target = 'all'
        or (target = 'students' and public.current_app_role() = 'student')
        or (target = 'teachers' and public.current_app_role() = 'teacher')
        or (target = 'class' and (public.in_class(target_class_id) or public.teaches_class(target_class_id)))
      )
    )
  );

create policy "announcements: publication admin ou enseignant pour sa classe"
  on public.announcements for insert to authenticated
  with check (
    public.is_admin()
    or (target = 'class' and public.teaches_class(target_class_id) and published_by = (select auth.uid()))
  );

create policy "announcements: modification par l'auteur enseignant ou admin"
  on public.announcements for update to authenticated
  using (public.is_admin() or (published_by = (select auth.uid()) and public.current_app_role() = 'teacher'))
  with check (
    public.is_admin()
    or (target = 'class' and public.teaches_class(target_class_id) and published_by = (select auth.uid()))
  );

create policy "announcements: suppression par l'auteur enseignant ou admin"
  on public.announcements for delete to authenticated
  using (public.is_admin() or (published_by = (select auth.uid()) and public.current_app_role() = 'teacher'));

-- audit_logs
create policy "audit_logs: lecture admin"
  on public.audit_logs for select to authenticated
  using (public.is_admin());
