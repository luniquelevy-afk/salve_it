-- Salve Italia — §15 : notifications de séance programmée, rappel de cours et simulation recommandée.
-- (« devoir à réaliser » attend le module devoirs du §13 ; « message de l'enseignant » reste à valider,
-- le commentaire enseignant étant privé par conception — EF-53.)

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check check (type in (
  'document_submitted', 'document_validated', 'document_needs_correction', 'document_expiring',
  'embassy_report_ready', 'announcement', 'lead_follow_up',
  'class_session_scheduled', 'class_session_reminder', 'simulation_recommended'
));

-- Balayage horaire des séances qui commencent dans les 24 heures.
create index class_sessions_starts_at_idx on public.class_sessions (starts_at);
