-- Salve Italia — Gamification légère (§14, §19.9)
-- Catalogue de badges défini par le centre + badges obtenus par étudiant.
-- Volontairement léger : pas de classement global public (§14) ; les séries de jours
-- actifs et l'objectif hebdomadaire sont dérivés de l'activité existante côté service,
-- seuls les badges obtenus sont persistés (date du premier déblocage).

-- ─────────────────────────────────────────────────────────────
-- Catalogue de badges (récompenses définies par le centre)
-- ─────────────────────────────────────────────────────────────
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- ─────────────────────────────────────────────────────────────
-- Badges obtenus par étudiant — la date marque le premier déblocage
-- ─────────────────────────────────────────────────────────────
create table public.student_badges (
  student_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (student_id, badge_id)
);

-- ─────────────────────────────────────────────────────────────
-- RLS (§19.12) : catalogue lisible par tout compte actif ; les badges obtenus
-- suivent le même cloisonnement que les autres données étudiant (étudiant concerné,
-- enseignant de sa classe, admin). Écritures backend uniquement (clé de service).
-- ─────────────────────────────────────────────────────────────
alter table public.badges         enable row level security;
alter table public.student_badges enable row level security;

revoke all on public.badges, public.student_badges from anon;
revoke insert, update, delete on public.badges, public.student_badges from authenticated;

create policy "badges: catalogue lisible par un compte actif"
  on public.badges for select to authenticated
  using (is_active and public.is_active_user());

create policy "student_badges: étudiant concerné, enseignant de sa classe, admin"
  on public.student_badges for select to authenticated
  using ((student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(student_id) or public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Catalogue initial (§14) — modifiable par le centre
-- ─────────────────────────────────────────────────────────────
insert into public.badges (code, label, description, sort_order) values
  ('first_simulation', 'Première simulation',   'Vous avez terminé votre première simulation de test.',        10),
  ('section_80',       '80 % dans une section', 'Vous avez atteint 80 % de bonnes réponses dans une section.', 20),
  ('week_streak',      '7 jours d''activité',   'Vous avez été actif 7 jours de suite.',                        30),
  ('five_interviews',  '5 entretiens réalisés', 'Vous avez réalisé 5 simulations d''entretien consulaire.',    40),
  ('documents_complete', 'Documents complets',  'Tous vos documents requis sont validés.',                     50);
