-- Salve Italia — V1.2 : préparation administrative
-- Documents étudiants (stockage privé, versions, historique), checklist dynamique sourcée et datée,
-- notifications in-app + file d'emails, historique des interactions prospects.
-- Réf. cahier des charges §11, §12, §15, §19.6 ; ENF-02, ENF-12 ; checklist sécurité (documents).

-- ─────────────────────────────────────────────────────────────
-- Compléments profil
-- ─────────────────────────────────────────────────────────────
alter table public.student_profiles
  add column visa_type text check (visa_type in ('etudes', 'tourisme', 'travail')),
  add column has_guarantor boolean;

alter table public.profiles
  add column email_notifications boolean not null default true;

-- ─────────────────────────────────────────────────────────────
-- Référentiel : types de documents et exigences de la checklist
-- ─────────────────────────────────────────────────────────────
create table public.document_types (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  label text not null,
  description text,
  requires_expiry boolean not null default false,
  display_order int not null default 0,
  is_active boolean not null default true
);

-- §11.2 / EF-48 / ENF-12 : chaque exigence renvoie à sa source officielle et porte sa date de dernière
-- vérification par le centre. Null = jamais vérifiée : affichée comme telle, jamais présentée comme sûre.
create table public.checklist_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  label text not null,
  description text,
  document_type text references public.document_types (code) on delete set null,
  visa_types text[] not null default array['etudes', 'tourisme', 'travail']
    check (visa_types <@ array['etudes', 'tourisme', 'travail'] and cardinality(visa_types) > 0),
  -- null : quel que soit le financement ; sinon seulement pour ces sources.
  financing_sources text[] check (financing_sources is null or financing_sources <@ array['famille', 'garant', 'bourse', 'personnel', 'non_defini']),
  -- true : seulement si l'étudiant a un garant ; null : indifférent.
  requires_guarantor boolean,
  source_label text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  last_verified_at date,
  requires_human_verification boolean not null default true,
  display_order int not null default 0,
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger checklist_requirements_set_updated_at
  before update on public.checklist_requirements
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Documents étudiants (§11.1, §19.6, EF-44 à EF-46)
-- Fichiers dans le bucket privé « student-documents », accès par URL signée courte uniquement.
-- ─────────────────────────────────────────────────────────────
create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null references public.document_types (code) on delete restrict,
  -- « manquant » = aucune ligne ; calculé par la checklist.
  status text not null default 'submitted' check (status in ('submitted', 'needs_correction', 'validated')),
  current_version int not null default 1 check (current_version >= 1),
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  expires_at date,
  reviewer_comment text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  expiry_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, document_type),
  constraint correction_requires_comment check (status <> 'needs_correction' or reviewer_comment is not null)
);
create index student_documents_status_idx on public.student_documents (status, updated_at);
create index student_documents_expiry_idx on public.student_documents (expires_at) where expires_at is not null;

create trigger student_documents_set_updated_at
  before update on public.student_documents
  for each row execute function public.set_updated_at();

create table public.student_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.student_documents (id) on delete cascade,
  version int not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  unique (document_id, version)
);

create table public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.student_documents (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('upload', 'validate', 'request_correction', 'set_expiry')),
  version int,
  comment text,
  created_at timestamptz not null default now()
);
create index document_events_document_idx on public.document_events (document_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Notifications (§15) : in-app + file d'emails
-- ─────────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'document_submitted', 'document_validated', 'document_needs_correction', 'document_expiring',
    'embassy_report_ready', 'announcement', 'lead_follow_up'
  )),
  title text not null,
  body text,
  -- Lien interne uniquement (pas de redirection externe depuis une notification).
  link text check (link is null or link ~ '^/[^/]'),
  -- Évite les doublons (ex. un seul rappel d'expiration par document et par échéance).
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  to_email text not null,
  subject text not null,
  body_text text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox (next_attempt_at) where status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- CRM : historique des interactions (EF-61, EF-63)
-- ─────────────────────────────────────────────────────────────
create table public.lead_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('appel', 'whatsapp', 'email', 'rendez_vous', 'note', 'changement_statut', 'assignation')),
  summary text not null check (length(trim(summary)) > 0),
  created_at timestamptz not null default now()
);
create index lead_interactions_lead_idx on public.lead_interactions (lead_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Agrégat documents pour les tableaux de bord (backend uniquement)
-- ─────────────────────────────────────────────────────────────
create or replace function public.documents_overview(p_teacher_id uuid)
returns jsonb
language sql stable
set search_path = ''
as $$
with scope as (
  select p.id, p.full_name
  from public.profiles p
  where p.role = 'student' and p.status = 'active'
    and (
      p_teacher_id is null
      or exists (
        select 1 from public.class_students cs join public.classes c on c.id = cs.class_id
        where cs.student_id = p.id and c.teacher_id = p_teacher_id and c.is_active
      )
    )
)
select jsonb_build_object(
  'toReviewCount', (select count(*) from public.student_documents d join scope s on s.id = d.student_id where d.status = 'submitted'),
  'expiringCount', (
    select count(*) from public.student_documents d join scope s on s.id = d.student_id
    where d.expires_at is not null and d.expires_at <= current_date + 30
  ),
  'toReview', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'studentId', r.student_id, 'studentName', r.full_name, 'documentType', r.label,
      'version', r.current_version, 'updatedAt', r.updated_at
    ) order by r.updated_at)
    from (
      select d.id, d.student_id, s.full_name, t.label, d.current_version, d.updated_at
      from public.student_documents d
      join scope s on s.id = d.student_id
      join public.document_types t on t.code = d.document_type
      where d.status = 'submitted'
      order by d.updated_at
      limit 20
    ) r
  ), '[]'::jsonb),
  'expiring', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'studentId', e.student_id, 'studentName', e.full_name, 'documentType', e.label, 'expiresAt', e.expires_at
    ) order by e.expires_at)
    from (
      select d.id, d.student_id, s.full_name, t.label, d.expires_at
      from public.student_documents d
      join scope s on s.id = d.student_id
      join public.document_types t on t.code = d.document_type
      where d.expires_at is not null and d.expires_at <= current_date + 30
      order by d.expires_at
      limit 20
    ) e
  ), '[]'::jsonb)
)
$$;

revoke execute on function public.documents_overview(uuid) from public, anon, authenticated;
grant execute on function public.documents_overview(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.document_types            enable row level security;
alter table public.checklist_requirements    enable row level security;
alter table public.student_documents         enable row level security;
alter table public.student_document_versions enable row level security;
alter table public.document_events           enable row level security;
alter table public.notifications             enable row level security;
alter table public.email_outbox              enable row level security;
alter table public.lead_interactions         enable row level security;

revoke all on
  public.document_types, public.checklist_requirements, public.student_documents, public.student_document_versions,
  public.document_events, public.notifications, public.email_outbox, public.lead_interactions
from anon;

revoke insert, update, delete on
  public.document_types, public.checklist_requirements, public.student_documents, public.student_document_versions,
  public.document_events, public.notifications, public.email_outbox, public.lead_interactions
from authenticated;

create policy "document_types: lecture utilisateurs actifs" on public.document_types for select to authenticated using (public.is_active_user());
create policy "checklist_requirements: lecture utilisateurs actifs" on public.checklist_requirements for select to authenticated using (public.is_active_user());

-- ENF-02 : documents lisibles par l'étudiant, l'enseignant de sa classe et l'admin.
create policy "student_documents: étudiant concerné, enseignant de sa classe, admin"
  on public.student_documents for select to authenticated
  using ((student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(student_id) or public.is_admin());

create policy "student_document_versions: si le document est lisible"
  on public.student_document_versions for select to authenticated
  using (exists (
    select 1 from public.student_documents d where d.id = document_id
      and ((d.student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(d.student_id) or public.is_admin())
  ));

create policy "document_events: si le document est lisible"
  on public.document_events for select to authenticated
  using (exists (
    select 1 from public.student_documents d where d.id = document_id
      and ((d.student_id = (select auth.uid()) and public.current_app_role() = 'student') or public.teaches_student(d.student_id) or public.is_admin())
  ));

create policy "notifications: destinataire uniquement"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_user());

-- email_outbox : aucune policy, backend uniquement (adresses et contenus d'emails).
create policy "lead_interactions: lecture admin" on public.lead_interactions for select to authenticated using (public.is_admin());

-- ─────────────────────────────────────────────────────────────
-- Données de référence (nécessaires en production)
-- Les listes réelles varient : elles doivent être vérifiées et datées par le centre.
-- ─────────────────────────────────────────────────────────────
insert into public.document_types (code, label, description, requires_expiry, display_order) values
  ('passeport', 'Passeport', 'Pages d’identité, en cours de validité.', true, 1),
  ('formulaire_visa', 'Formulaire de demande de visa', 'Formulaire rempli et signé.', false, 2),
  ('photo_identite', 'Photo d’identité', 'Photo récente au format demandé.', false, 3),
  ('preinscription_universitaly', 'Préinscription Universitaly', 'Récapitulatif de la préinscription.', false, 4),
  ('diplomes_releves', 'Diplômes et relevés de notes', 'Diplômes et relevés du parcours antérieur.', false, 5),
  ('traductions', 'Traductions et légalisations', 'Traductions des documents académiques, le cas échéant.', false, 6),
  ('certificat_langue', 'Certificat de langue', 'Certificat d’italien ou d’anglais, selon la formation.', false, 7),
  ('justificatifs_financiers', 'Justificatifs de ressources', 'Documents prouvant les moyens financiers pour le séjour.', false, 8),
  ('documents_garant', 'Documents du garant', 'Engagement et justificatifs du garant.', false, 9),
  ('assurance_sante', 'Assurance santé', 'Attestation d’assurance couvrant le séjour.', true, 10),
  ('hebergement', 'Justificatif d’hébergement', 'Réservation, contrat ou attestation de logement.', false, 11),
  ('reservation_voyage', 'Réservation de voyage', 'Réservation aller-retour ou itinéraire.', false, 12),
  ('contrat_travail', 'Contrat ou autorisation de travail', 'Contrat de travail et autorisation délivrée à l’employeur.', false, 13);

insert into public.checklist_requirements (code, label, description, document_type, visa_types, financing_sources, requires_guarantor, source_label, source_url, display_order) values
  ('passeport', 'Passeport valide', 'Généralement demandé pour toute demande de visa, avec une validité couvrant le séjour.', 'passeport', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 1),
  ('formulaire_visa', 'Formulaire de demande de visa', 'Formulaire officiel à remplir et signer.', 'formulaire_visa', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 2),
  ('photo_identite', 'Photo d’identité', 'Format et nombre de photos à vérifier sur le site officiel.', 'photo_identite', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 3),
  ('preinscription_universitaly', 'Préinscription universitaire (Universitaly)', 'Préinscription auprès de l’établissement italien via le portail Universitaly.', 'preinscription_universitaly', array['etudes'], null, null,
   'Universitaly', 'https://www.universitaly.it/', 4),
  ('diplomes_releves', 'Diplômes et relevés de notes', 'Justificatifs du parcours académique, souvent avec traduction et légalisation.', 'diplomes_releves', array['etudes'], null, null,
   'Ambassade d’Italie — visa pour études', 'https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/', 5),
  ('traductions', 'Traductions et légalisations', 'Selon les exigences de l’établissement et de l’ambassade.', 'traductions', array['etudes'], null, null,
   'Ambassade d’Italie — visa pour études', 'https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/', 6),
  ('certificat_langue', 'Certificat de langue', 'Selon la langue d’enseignement de la formation visée.', 'certificat_langue', array['etudes'], null, null,
   'Ambassade d’Italie — visa pour études', 'https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/', 7),
  ('justificatifs_financiers', 'Justificatifs de ressources', 'Preuve des moyens financiers pour la durée du séjour.', 'justificatifs_financiers', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 8),
  ('documents_garant', 'Documents du garant', 'Si vos études sont financées par un garant.', 'documents_garant', array['etudes', 'tourisme'], null, true,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 9),
  ('assurance_sante', 'Assurance santé', 'Couverture médicale pour la durée du séjour.', 'assurance_sante', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 10),
  ('hebergement', 'Justificatif d’hébergement', 'Logement prévu pendant le séjour.', 'hebergement', array['etudes', 'tourisme', 'travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 11),
  ('reservation_voyage', 'Réservation de voyage', 'Généralement demandée pour un séjour touristique.', 'reservation_voyage', array['tourisme'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 12),
  ('contrat_travail', 'Contrat et autorisation de travail', 'Autorisation obtenue par l’employeur en Italie et contrat.', 'contrat_travail', array['travail'], null, null,
   'Ambassade d’Italie à Brazzaville', 'https://ambbrazzaville.esteri.it/', 13);
