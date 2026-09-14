-- Salve Italia — V1.3 : IA avancée
-- Scénarios d'entretien, profil transmis avec consentement, limites de coût administrables.
-- Réf. cahier des charges §10.2, §10.6, EF-54, EF-56, EF-59, ENF-07.

-- ─────────────────────────────────────────────────────────────
-- Scénarios d'entretien (§10.2, EF-54) — administrables, sans redéploiement (ENF-10)
-- ─────────────────────────────────────────────────────────────
create table public.embassy_scenarios (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  label text not null,
  description text not null,
  visa_types text[] not null default array['etudes', 'tourisme', 'travail']
    check (visa_types <@ array['etudes', 'tourisme', 'travail'] and cardinality(visa_types) > 0),
  -- Consignes ajoutées au message de contexte (le prompt système reste figé).
  agent_instructions text not null,
  focus_themes text[] not null default '{}',
  is_active boolean not null default true,
  display_order int not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger embassy_scenarios_set_updated_at
  before update on public.embassy_scenarios
  for each row execute function public.set_updated_at();

insert into public.embassy_scenarios (code, label, description, visa_types, agent_instructions, focus_themes, display_order) values
  ('standard', 'Entretien classique',
   'Un entretien complet qui couvre l’ensemble des thèmes habituels.',
   array['etudes', 'tourisme', 'travail'],
   'Menez un entretien équilibré couvrant tous les thèmes indiqués.',
   '{}', 1),
  ('financement_familial', 'Financement par la famille',
   'Vos études sont financées par votre famille : l’agent approfondit la solidité et l’organisation de ce financement.',
   array['etudes'],
   'Le candidat indique être financé par sa famille. Approfondissez : qui finance, la régularité des ressources, le budget mensuel prévu, la prise en charge des frais imprévus et l’organisation concrète des transferts d’argent.',
   array['origine et régularité du financement', 'budget mensuel', 'frais imprévus'], 2),
  ('garant', 'Financement par un garant',
   'Un garant se porte caution pour vous : l’agent interroge sur ce garant et son engagement.',
   array['etudes', 'tourisme'],
   'Le candidat s’appuie sur un garant. Approfondissez : le lien avec le garant, la nature de son engagement, sa capacité à assumer les frais et la connaissance qu’a le candidat des documents correspondants.',
   array['relation avec le garant', 'engagement du garant', 'documents du garant'], 3),
  ('reorientation', 'Réorientation d’études',
   'Vous changez de domaine d’études : l’agent vérifie que ce choix est cohérent et réfléchi.',
   array['etudes'],
   'Le candidat change de domaine d’études. Demandez-lui de justifier ce changement, le lien avec son parcours antérieur et avec son projet professionnel, et ce qui a motivé le choix de la nouvelle formation.',
   array['raisons de la réorientation', 'lien avec le parcours', 'projet professionnel'], 4),
  ('interruption_etudes', 'Reprise après une interruption',
   'Vous reprenez des études après une interruption : l’agent s’intéresse à cette période et à votre motivation.',
   array['etudes'],
   'Le parcours du candidat comporte une interruption d’études. Interrogez-le avec tact sur ses activités pendant cette période, sur ce qu’elle lui a apporté et sur les raisons de la reprise, sans porter de jugement.',
   array['activités pendant l’interruption', 'motivation de la reprise'], 5),
  ('italien_limite', 'Niveau d’italien encore limité',
   'Votre italien est encore en progression : l’agent vérifie votre plan pour suivre les cours.',
   array['etudes'],
   'Le niveau d’italien du candidat est encore limité. Demandez la langue d’enseignement de la formation, son plan d’apprentissage avant et pendant le séjour. Vous pouvez poser une ou deux questions très simples en italien, puis revenir au français.',
   array['langue d’enseignement', 'plan d’apprentissage de l’italien'], 6),
  ('premiere_demande', 'Première demande de visa',
   'Vous demandez un visa pour la première fois : l’agent vérifie que vous maîtrisez les démarches.',
   array['etudes', 'tourisme', 'travail'],
   'Il s’agit de la première demande de visa du candidat. Vérifiez sa compréhension des démarches, des documents et de l’organisation pratique de son arrivée en Italie.',
   array['démarches et documents', 'organisation de l’arrivée'], 7),
  ('apres_refus', 'Nouvelle demande après un refus',
   'Vous redéposez une demande après un refus : l’agent cherche ce qui a changé dans votre dossier.',
   array['etudes', 'tourisme', 'travail'],
   'Le candidat a déjà essuyé un refus. Demandez-lui, sans jugement, ce qui a évolué dans son projet ou son dossier depuis. Ne spéculez jamais sur les motifs officiels du refus précédent.',
   array['évolutions depuis la précédente demande'], 8),
  ('exigeant', 'Entretien exigeant',
   'Un agent plus bref et plus exigeant, qui relance à chaque réponse imprécise.',
   array['etudes', 'tourisme', 'travail'],
   'Adoptez un ton plus bref et plus exigeant, restez toujours courtois. Relancez systématiquement lorsqu’une réponse manque de précision ou d’exemples concrets.',
   '{}', 9);

-- ─────────────────────────────────────────────────────────────
-- Sessions : scénario, consentement au profil, plafond de coût
-- ─────────────────────────────────────────────────────────────
alter table public.embassy_sessions
  add constraint embassy_sessions_scenario_fkey foreign key (scenario_code) references public.embassy_scenarios (code) on update cascade,
  -- EF-56 : le profil et les entretiens précédents ne sont utilisés qu'avec l'accord de l'étudiant.
  add column uses_profile boolean not null default false,
  -- Données minimisées réellement transmises à l'agent (traçabilité de ce qui a été envoyé).
  add column profile_snapshot jsonb,
  add column cost_limit_reached boolean not null default false,
  add constraint profile_snapshot_requires_consent check (uses_profile or profile_snapshot is null);

-- ─────────────────────────────────────────────────────────────
-- Limites d'usage de l'IA (EF-59, ENF-07)
-- null = valeur par défaut de la configuration serveur.
-- ─────────────────────────────────────────────────────────────
create table public.ai_settings (
  id boolean primary key default true check (id),
  max_turns int check (max_turns between 2 and 30),
  weekly_session_limit int check (weekly_session_limit between 0 and 100),
  monthly_cost_limit_usd numeric(10, 2) check (monthly_cost_limit_usd >= 0),
  session_cost_limit_usd numeric(10, 4) check (session_cost_limit_usd >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_settings (id) values (true);

create trigger ai_settings_set_updated_at
  before update on public.ai_settings
  for each row execute function public.set_updated_at();

-- Exceptions par étudiant (ex. quota élargi avant un entretien réel, ou réduit en cas d'abus).
create table public.student_ai_limits (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  weekly_session_limit int check (weekly_session_limit between 0 and 100),
  monthly_cost_limit_usd numeric(10, 2) check (monthly_cost_limit_usd >= 0),
  note text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint student_ai_limits_not_empty check (weekly_session_limit is not null or monthly_cost_limit_usd is not null)
);

create trigger student_ai_limits_set_updated_at
  before update on public.student_ai_limits
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.embassy_scenarios enable row level security;
alter table public.ai_settings       enable row level security;
alter table public.student_ai_limits enable row level security;

revoke all on public.embassy_scenarios, public.ai_settings, public.student_ai_limits from anon;
revoke insert, update, delete on public.embassy_scenarios, public.ai_settings, public.student_ai_limits from authenticated;

create policy "embassy_scenarios: lecture utilisateurs actifs" on public.embassy_scenarios for select to authenticated using (public.is_active_user());
create policy "ai_settings: lecture admin" on public.ai_settings for select to authenticated using (public.is_admin());
create policy "student_ai_limits: lecture admin" on public.student_ai_limits for select to authenticated using (public.is_admin());
