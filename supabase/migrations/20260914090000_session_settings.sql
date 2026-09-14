-- Salve Italia — Réglage de session administrable (EF-05, §22 #5, ENF-10)
-- La durée d'inactivité avant déconnexion automatique était une variable de build
-- (`VITE_IDLE_TIMEOUT_MINUTES`), donc non modifiable sans redéploiement. Elle devient
-- un réglage administrable, lisible par tout compte actif (le frontend l'applique à la connexion).

create table public.session_settings (
  id boolean primary key default true check (id),
  -- Minutes d'inactivité avant déconnexion (EF-05). NULL = valeur par défaut du serveur.
  idle_timeout_minutes int check (idle_timeout_minutes between 1 and 240),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.session_settings (id, idle_timeout_minutes) values (true, 30);

create trigger session_settings_set_updated_at
  before update on public.session_settings
  for each row execute function public.set_updated_at();

-- RLS (§19.12) : lecture par tout compte actif (le frontend en a besoin dès la connexion) ;
-- écriture réservée au backend (clé de service), l'admin passe par l'API.
alter table public.session_settings enable row level security;
revoke all on public.session_settings from anon;
revoke insert, update, delete on public.session_settings from authenticated;

create policy "session_settings: lecture par un compte actif"
  on public.session_settings for select to authenticated
  using (public.is_active_user());
