-- Salve Italia — ENF-09 / ENF-11 : conservation limitée des données sensibles.
-- Durées fixées par l'admin ; null = aucune suppression automatique tant que le cadre applicable
-- n'est pas validé avec le centre (CDC §22.7). Le journal d'audit n'est jamais purgé (ENF-08).

-- ─────────────────────────────────────────────────────────────
-- Date de suspension : point de départ de la conservation des comptes suspendus
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column suspended_at timestamptz;

-- Comptes déjà suspendus : le délai démarre à l'application de la migration (jamais de purge rétroactive).
update public.profiles set suspended_at = now() where status = 'suspended';

create or replace function public.track_suspension()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.suspended_at := case when new.status = 'suspended' then now() else null end;
  end if;
  return new;
end;
$$;

create trigger profiles_track_suspension
  before update of status on public.profiles
  for each row execute function public.track_suspension();

-- ─────────────────────────────────────────────────────────────
-- Réglages de conservation (ligne unique)
-- ─────────────────────────────────────────────────────────────
create table public.retention_settings (
  id boolean primary key default true check (id),
  embassy_sessions_months int check (embassy_sessions_months between 1 and 120),
  suspended_students_months int check (suspended_students_months between 1 and 120),
  document_versions_months int check (document_versions_months between 1 and 120),
  leads_months int check (leads_months between 1 and 120),
  notifications_months int check (notifications_months between 1 and 120),
  updated_by uuid references public.profiles (id) on delete set null,
  -- Mis à jour par le backend uniquement lors d'un changement de durée (pas à chaque purge).
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_run_result jsonb
);

insert into public.retention_settings (id) values (true);

-- Index utiles aux purges
create index profiles_suspended_at_idx on public.profiles (suspended_at) where status = 'suspended';
create index student_document_versions_uploaded_idx on public.student_document_versions (uploaded_at);
create index leads_updated_idx on public.leads (updated_at);
create index level_test_attempts_contact_idx on public.level_test_attempts (created_at) where contact_consent;
create index notifications_read_created_idx on public.notifications (created_at) where read_at is not null;
create index email_outbox_processed_created_idx on public.email_outbox (created_at) where status <> 'pending';

-- ─────────────────────────────────────────────────────────────
-- RLS : lecture admin, écritures backend uniquement
-- ─────────────────────────────────────────────────────────────
alter table public.retention_settings enable row level security;

revoke all on public.retention_settings from anon;
revoke insert, update, delete on public.retention_settings from authenticated;

create policy "retention_settings: lecture admin" on public.retention_settings for select to authenticated using (public.is_admin());
