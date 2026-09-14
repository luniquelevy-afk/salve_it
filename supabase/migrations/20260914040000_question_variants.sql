-- Salve Italia — EF-07 : variantes de questions générées par IA.
-- Une variante garde le lien vers sa question d'origine pour la relecture ; elle reste « à relire »
-- tant qu'un enseignant ne l'a pas activée (contrainte ai_question_requires_validation existante).

alter table public.questions
  add column generated_from uuid references public.questions (id) on delete set null,
  add constraint generated_from_requires_ai check (generated_from is null or source = 'ai_generated');

create index questions_generated_from_idx on public.questions (generated_from) where generated_from is not null;
