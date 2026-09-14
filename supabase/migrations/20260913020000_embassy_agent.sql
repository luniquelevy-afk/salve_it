-- Salve Italia — Phase 3 : agent ambassade IA
-- Sessions d'entretien consulaire, échanges tour par tour, journal d'usage IA.
-- Réf. cahier des charges §4.3, §10, §19.3, §19.10 ; checklist « Sécurité IA ».

create table public.embassy_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  visa_type text not null check (visa_type in ('etudes', 'tourisme', 'travail')),
  scenario_code text not null default 'standard',
  input_mode text not null default 'text' check (input_mode in ('voice', 'text')),
  -- in_progress → report_pending → completed ; failed = incident technique, aucun rapport (EF-23).
  status text not null default 'in_progress'
    check (status in ('in_progress', 'report_pending', 'completed', 'failed', 'abandoned')),
  prompt_version text not null,
  model text not null,
  max_turns int not null check (max_turns between 1 and 30),
  turn_count int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed_at timestamptz,
  overall_score int check (overall_score between 0 and 100),
  ai_report jsonb,
  report_attempts int not null default 0,
  -- File de génération (§17.4) : une tentative réclamée n'est reprise qu'après expiration du délai.
  report_claimed_at timestamptz,
  failure_reason text,
  constraint report_only_when_completed check ((status = 'completed') = (ai_report is not null))
);
create index embassy_sessions_student_idx on public.embassy_sessions (student_id, started_at desc);
create index embassy_sessions_report_queue_idx on public.embassy_sessions (ended_at) where status = 'report_pending';
-- Une seule session d'entretien active par étudiant.
create unique index embassy_sessions_one_active_idx on public.embassy_sessions (student_id) where status = 'in_progress';

-- Une ligne par tour (plutôt qu'un JSONB unique) : analyse, statistiques et suppression ciblée (§10.2).
create table public.embassy_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.embassy_sessions (id) on delete cascade,
  speaker text not null check (speaker in ('agent', 'student')),
  sequence_number int not null check (sequence_number >= 0),
  text_content text not null,
  -- Contenu brut renvoyé par l'API pour les tours de l'agent, rejoué tel quel au tour suivant.
  api_content jsonb,
  response_time_seconds int check (response_time_seconds >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_number)
);

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles (id) on delete set null,
  -- Pas de clé étrangère : le journal de coût survit à la suppression d'une session (EF-58).
  session_id uuid,
  operation text not null check (operation in ('embassy_turn', 'embassy_report', 'question_generation')),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_input_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0,
  estimated_cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_logs_student_idx on public.ai_usage_logs (student_id, created_at desc);
create index ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security — écritures exclusivement via le backend
-- ─────────────────────────────────────────────────────────────
alter table public.embassy_sessions enable row level security;
alter table public.embassy_messages enable row level security;
alter table public.ai_usage_logs    enable row level security;

revoke all on public.embassy_sessions, public.embassy_messages, public.ai_usage_logs from anon;
revoke insert, update, delete on public.embassy_sessions, public.embassy_messages, public.ai_usage_logs from authenticated;

-- ENF-02 : transcripts et rapports accessibles à l'étudiant, à l'enseignant de sa classe et à l'admin.
create policy "embassy_sessions: lecture étudiant concerné, enseignant de sa classe, admin"
  on public.embassy_sessions for select to authenticated
  using (
    (student_id = (select auth.uid()) and public.current_app_role() = 'student')
    or public.teaches_student(student_id)
    or public.is_admin()
  );

create policy "embassy_messages: lecture si la session est lisible"
  on public.embassy_messages for select to authenticated
  using (
    exists (
      select 1 from public.embassy_sessions s
      where s.id = session_id
        and (
          (s.student_id = (select auth.uid()) and public.current_app_role() = 'student')
          or public.teaches_student(s.student_id)
          or public.is_admin()
        )
    )
  );

create policy "ai_usage_logs: lecture admin"
  on public.ai_usage_logs for select to authenticated
  using (public.is_admin());
