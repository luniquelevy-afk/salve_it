-- Salve Italia — Phase 5 : site vitrine public
-- Informations du centre, formations publiques, témoignages, FAQ, galerie, prospects (leads).
-- Réf. cahier des charges §4.5 (EF-30 à EF-34), §12.
-- Contenu entièrement administrable : aucune donnée présentée comme réelle n'est inventée par la plateforme.

-- ─────────────────────────────────────────────────────────────
-- Informations du centre (ligne unique)
-- ─────────────────────────────────────────────────────────────
create table public.site_settings (
  id boolean primary key default true check (id),
  centre_name text not null default 'Salve Italia',
  tagline text,
  about text,
  phone text,
  whatsapp text,
  email text,
  address text,
  opening_hours text,
  facebook_url text check (facebook_url is null or facebook_url ~ '^https://'),
  instagram_url text check (instagram_url is null or instagram_url ~ '^https://'),
  map_url text check (map_url is null or map_url ~ '^https://'),
  -- [{ "value": "…", "label": "…" }] — renseigné par le centre, masqué si vide (EF-30).
  key_figures jsonb not null default '[]'::jsonb check (jsonb_typeof(key_figures) = 'array'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Formations : page publique par programme (EF-31)
-- ─────────────────────────────────────────────────────────────
alter table public.programs
  add column slug text unique,
  add column is_public boolean not null default false,
  add column summary text,
  add column duration_label text,
  add column schedule_label text,
  add column audience text,
  add column objectives jsonb not null default '[]'::jsonb,
  add column display_order int not null default 0,
  add constraint programs_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint programs_public_requires_slug check (not is_public or slug is not null),
  add constraint programs_objectives_array check (jsonb_typeof(objectives) = 'array');

-- ─────────────────────────────────────────────────────────────
-- Témoignages, FAQ, galerie (EF-33)
-- ─────────────────────────────────────────────────────────────
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_context text,
  quote text not null check (length(trim(quote)) > 0),
  photo_url text check (photo_url is null or photo_url ~ '^https://'),
  -- Publication impossible sans accord écrit de la personne (nom, citation, photo).
  consent_confirmed boolean not null default false,
  is_published boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint testimonial_publication_requires_consent check (not is_published or consent_confirmed)
);

create table public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null check (length(trim(question)) > 0),
  answer text not null check (length(trim(answer)) > 0),
  is_published boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  image_url text not null check (image_url ~ '^https://'),
  -- Texte alternatif obligatoire (accessibilité).
  alt_text text not null check (length(trim(alt_text)) > 0),
  caption text,
  is_published boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Prospects (EF-32, EF-60 à EF-63 — socle du CRM)
-- ─────────────────────────────────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  desired_program text,
  level_estimate public.cefr_level,
  message text,
  source text not null check (source in ('contact_form', 'level_test')),
  status text not null default 'nouveau'
    check (status in ('nouveau', 'contacte', 'test_realise', 'interesse', 'inscrit', 'non_interesse', 'a_relancer')),
  notes text,
  next_follow_up_at timestamptz,
  assigned_to uuid references public.profiles (id) on delete set null,
  contact_consent boolean not null check (contact_consent),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_reachable check (phone is not null or email is not null)
);
create index leads_status_idx on public.leads (status, created_at desc);

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security : lecture publique servie par le backend, écritures backend uniquement
-- ─────────────────────────────────────────────────────────────
alter table public.site_settings  enable row level security;
alter table public.testimonials   enable row level security;
alter table public.faq_items      enable row level security;
alter table public.gallery_images enable row level security;
alter table public.leads          enable row level security;

revoke all on public.site_settings, public.testimonials, public.faq_items, public.gallery_images, public.leads from anon;
revoke insert, update, delete on public.site_settings, public.testimonials, public.faq_items, public.gallery_images, public.leads from authenticated;

create policy "site_settings: lecture admin" on public.site_settings for select to authenticated using (public.is_admin());
create policy "testimonials: lecture admin" on public.testimonials for select to authenticated using (public.is_admin());
create policy "faq_items: lecture admin" on public.faq_items for select to authenticated using (public.is_admin());
create policy "gallery_images: lecture admin" on public.gallery_images for select to authenticated using (public.is_admin());
-- Coordonnées de prospects : admin uniquement.
create policy "leads: lecture admin" on public.leads for select to authenticated using (public.is_admin());
