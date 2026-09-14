-- Données initiales de développement (aucun compte : le premier admin se crée via
-- `pnpm --filter @salve/backend bootstrap:admin`, cf. README).

insert into public.programs (name, level, description) values
  ('Italien A1 — Découverte', 'A1', 'Premiers pas en italien : se présenter, vie quotidienne.'),
  ('Italien A2 — Élémentaire', 'A2', 'Communication simple dans les situations courantes.'),
  ('Italien B1 — Intermédiaire', 'B1', 'Autonomie à l''oral et à l''écrit, préparation aux études.'),
  ('Italien B2 — Avancé', 'B2', 'Niveau universitaire : compréhension de cours, rédaction académique.');

-- Modèle de démonstration (barème indicatif de type TOLC : +1 / -0,25 / 0 — à confronter au règlement en vigueur).
with template as (
  insert into public.test_templates (code, name, language, description, total_duration_seconds, scoring_rules)
  values (
    'CENTRE-DEMO',
    'Simulation de type TOLC — démonstration',
    'it',
    'Format court pour découvrir la plateforme : logique et mathématiques, 5 options par question.',
    20 * 60,
    '{"correct": 1, "wrong": -0.25, "blank": 0}'
  )
  returning id
)
insert into public.test_sections (template_id, name, category, question_count, order_index)
select template.id, section.name, section.category, section.question_count, section.order_index
from template,
  (values ('Logica', 'logica', 3, 0), ('Matematica', 'matematica', 3, 1)) as section(name, category, question_count, order_index);

insert into public.questions (category, difficulty, question_text, options, correct_answer, explanation, validation_status) values
  ('logica', 1,
   'Se tutti i gatti sono felini e alcuni felini sono neri, quale affermazione è necessariamente vera?',
   '[{"key":"A","text":"Tutti i gatti sono neri"},{"key":"B","text":"Alcuni gatti sono neri"},{"key":"C","text":"Tutti i gatti sono felini"},{"key":"D","text":"Nessun gatto è nero"},{"key":"E","text":"Tutti i felini sono gatti"}]',
   'C', 'È l''unica affermazione garantita dalla prima premessa ; i felini neri potrebbero non essere gatti.', 'active'),
  ('logica', 2,
   'Quale numero completa la successione 2, 6, 12, 20, 30, … ?',
   '[{"key":"A","text":"40"},{"key":"B","text":"42"},{"key":"C","text":"44"},{"key":"D","text":"36"},{"key":"E","text":"48"}]',
   'B', 'Le differenze crescono di 2 : +4, +6, +8, +10, quindi +12 → 42.', 'active'),
  ('logica', 1,
   'Marco è più alto di Luca. Luca è più alto di Paolo. Chi è il più basso?',
   '[{"key":"A","text":"Marco"},{"key":"B","text":"Luca"},{"key":"C","text":"Paolo"},{"key":"D","text":"Non si può stabilire"},{"key":"E","text":"Marco e Luca"}]',
   'C', 'Marco > Luca > Paolo : Paolo è il più basso.', 'active'),
  ('logica', 2,
   'La negazione di «Tutti gli studenti hanno superato l''esame» è:',
   '[{"key":"A","text":"Nessuno studente ha superato l''esame"},{"key":"B","text":"Almeno uno studente non ha superato l''esame"},{"key":"C","text":"Alcuni studenti hanno superato l''esame"},{"key":"D","text":"Tutti gli studenti sono stati bocciati"},{"key":"E","text":"Nessuna delle precedenti"}]',
   'B', 'Per negare «tutti» basta un controesempio : almeno uno non l''ha superato.', 'active'),
  ('logica', 1,
   'Quale numero completa la successione 3, 9, 27, 81, … ?',
   '[{"key":"A","text":"162"},{"key":"B","text":"243"},{"key":"C","text":"324"},{"key":"D","text":"108"},{"key":"E","text":"729"}]',
   'B', 'Ogni termine è il triplo del precedente : 81 × 3 = 243.', 'active'),
  ('matematica', 1,
   'Quanto vale il 15% di 240?',
   '[{"key":"A","text":"24"},{"key":"B","text":"32"},{"key":"C","text":"36"},{"key":"D","text":"40"},{"key":"E","text":"48"}]',
   'C', '240 × 0,15 = 36.', 'active'),
  ('matematica', 1,
   'Se 3x + 7 = 22, allora x vale:',
   '[{"key":"A","text":"3"},{"key":"B","text":"4"},{"key":"C","text":"5"},{"key":"D","text":"6"},{"key":"E","text":"7"}]',
   'C', '3x = 15, quindi x = 5.', 'active'),
  ('matematica', 1,
   'Qual è l''area di un rettangolo con lati di 8 cm e 5 cm?',
   '[{"key":"A","text":"13 cm²"},{"key":"B","text":"26 cm²"},{"key":"C","text":"40 cm²"},{"key":"D","text":"45 cm²"},{"key":"E","text":"80 cm²"}]',
   'C', 'Area = base × altezza = 8 × 5 = 40 cm².', 'active'),
  ('matematica', 2,
   'Quanto vale √144 + 2³?',
   '[{"key":"A","text":"18"},{"key":"B","text":"20"},{"key":"C","text":"22"},{"key":"D","text":"24"},{"key":"E","text":"16"}]',
   'B', '√144 = 12 e 2³ = 8 : 12 + 8 = 20.', 'active'),
  ('matematica', 3,
   'Un prezzo di 50 € aumenta del 20% e poi diminuisce del 20%. Qual è il prezzo finale?',
   '[{"key":"A","text":"50 €"},{"key":"B","text":"48 €"},{"key":"C","text":"52 €"},{"key":"D","text":"46 €"},{"key":"E","text":"40 €"}]',
   'B', '50 × 1,2 = 60 ; 60 × 0,8 = 48 €. Le percentuali non si compensano.', 'active');

-- Site vitrine (Phase 5) : pages publiques des formations. Durées, horaires et contacts
-- sont laissés vides : ils doivent être renseignés par le centre depuis le back-office.
update public.programs set slug = 'italien-a1', is_public = true, display_order = 1,
  summary = 'Premiers pas en italien pour les grands débutants.',
  audience = 'Personnes qui découvrent l''italien.',
  objectives = '["Comprendre et utiliser des expressions familières et quotidiennes", "Se présenter et poser des questions simples", "Communiquer de façon simple si l''interlocuteur parle lentement"]'
  where level = 'A1';
update public.programs set slug = 'italien-a2', is_public = true, display_order = 2,
  summary = 'Communiquer dans les situations courantes de la vie quotidienne.',
  audience = 'Personnes ayant acquis les bases (niveau A1).',
  objectives = '["Comprendre des phrases sur des sujets familiers", "Échanger des informations simples sur des activités courantes", "Décrire son environnement et sa formation"]'
  where level = 'A2';
update public.programs set slug = 'italien-b1', is_public = true, display_order = 3,
  summary = 'Devenir autonome à l''oral et à l''écrit, et commencer la préparation aux études.',
  audience = 'Futurs étudiants en Italie ayant un niveau A2.',
  objectives = '["Comprendre l''essentiel d''un discours clair sur des sujets familiers", "Se débrouiller dans la plupart des situations de voyage et d''études", "Présenter et justifier un projet d''études"]'
  where level = 'B1';
update public.programs set slug = 'italien-b2', is_public = true, display_order = 4,
  summary = 'Atteindre un niveau proche des exigences universitaires.',
  audience = 'Candidats aux études universitaires en italien.',
  objectives = '["Comprendre des textes complexes et des cours", "S''exprimer de façon claire et détaillée", "Argumenter à l''écrit et à l''oral dans un cadre académique"]'
  where level = 'B2';

-- FAQ : uniquement des informations exactes sur la plateforme elle-même.
insert into public.faq_items (question, answer, display_order) values
  ('Le test de niveau est-il gratuit ?',
   'Oui. Le test en ligne est gratuit et sans inscription. Il donne une estimation indicative de votre niveau (du A1 au B2), qui peut être complétée par un échange avec le centre.', 1),
  ('Qu''est-ce qu''une simulation de type TOLC ?',
   'Beaucoup d''universités italiennes demandent un test d''admission de type TOLC, organisé par le CISIA. Nos simulations en reproduisent les conditions : questions à choix multiples, chronomètre, pas de retour en arrière et correction détaillée. Elles sont indépendantes du CISIA.', 2),
  ('L''entretien consulaire simulé remplace-t-il l''entretien réel ?',
   'Non. C''est un outil d''entraînement qui vous aide à préparer et clarifier vos réponses. Il ne préjuge en rien de la décision de l''ambassade.', 3),
  ('Comment obtenir un accès à la plateforme ?',
   'Les comptes sont créés par le centre lors de votre inscription à une formation. Utilisez le formulaire de contact pour connaître les prochaines sessions.', 4),
  ('Les informations sur les visas sont-elles officielles ?',
   'Non. Les procédures et documents requis doivent toujours être vérifiés sur le site officiel de l''ambassade d''Italie et auprès de l''établissement concerné.', 5);

-- Test de niveau gratuit (EF-27) : 3 questions par niveau, du plus simple au plus avancé.
insert into public.level_test_questions (level, order_index, question_text, options, correct_answer) values
  ('A1', 1, 'Completa: Io ___ Marco.',
   '[{"key":"A","text":"sono"},{"key":"B","text":"sei"},{"key":"C","text":"è"},{"key":"D","text":"siamo"}]', 'A'),
  ('A1', 2, 'Qual è il plurale di «libro»?',
   '[{"key":"A","text":"libri"},{"key":"B","text":"libre"},{"key":"C","text":"libros"},{"key":"D","text":"libra"}]', 'A'),
  ('A1', 3, '«Buongiorno» si dice…',
   '[{"key":"A","text":"la mattina"},{"key":"B","text":"prima di dormire"},{"key":"C","text":"per chiedere scusa"},{"key":"D","text":"per dire grazie"}]', 'A'),
  ('A2', 4, 'Ieri io ___ al cinema.',
   '[{"key":"A","text":"vado"},{"key":"B","text":"sono andato"},{"key":"C","text":"andrò"},{"key":"D","text":"vada"}]', 'B'),
  ('A2', 5, 'Abito ___ Brazzaville.',
   '[{"key":"A","text":"a"},{"key":"B","text":"in"},{"key":"C","text":"da"},{"key":"D","text":"su"}]', 'A'),
  ('A2', 6, '«Mi piacciono» si usa con…',
   '[{"key":"A","text":"un nome plurale"},{"key":"B","text":"un verbo all''infinito"},{"key":"C","text":"un nome singolare"},{"key":"D","text":"un avverbio"}]', 'A'),
  ('B1', 7, 'Se avessi più tempo, ___ l''italiano ogni giorno.',
   '[{"key":"A","text":"studio"},{"key":"B","text":"studierei"},{"key":"C","text":"studiavo"},{"key":"D","text":"studierò"}]', 'B'),
  ('B1', 8, 'Penso che Marco ___ ragione.',
   '[{"key":"A","text":"ha"},{"key":"B","text":"abbia"},{"key":"C","text":"avrà"},{"key":"D","text":"aveva"}]', 'B'),
  ('B1', 9, 'Dopo «nonostante» si usa…',
   '[{"key":"A","text":"il congiuntivo"},{"key":"B","text":"il futuro"},{"key":"C","text":"l''infinito passato"},{"key":"D","text":"il gerundio"}]', 'A'),
  ('B2', 10, 'Scegli la frase corretta.',
   '[{"key":"A","text":"Se l''avessi saputo, sarei venuto."},{"key":"B","text":"Se lo sapevo, venirei."},{"key":"C","text":"Se l''avrei saputo, sarei venuto."},{"key":"D","text":"Se lo sapessi, sono venuto."}]', 'A'),
  ('B2', 11, '«Ciononostante» significa…',
   '[{"key":"A","text":"tuttavia"},{"key":"B","text":"perciò"},{"key":"C","text":"infatti"},{"key":"D","text":"cioè"}]', 'A'),
  ('B2', 12, 'Il progetto ___ approvato dal consiglio la settimana scorsa.',
   '[{"key":"A","text":"è stato"},{"key":"B","text":"ha stato"},{"key":"C","text":"è stata"},{"key":"D","text":"ha stati"}]', 'A');

-- Contenu de démonstration : un cours publié et son exercice (format compilé par le backend).
with course as (
  insert into public.courses (title, description, level, category, content_type, body, is_published, published_at)
  values (
    'Salutations et présentations',
    'Se présenter et saluer en italien.',
    'A1',
    'vocabulaire',
    'text',
    E'Ciao ! — Salut (informel)\nBuongiorno — Bonjour (le matin)\nBuonasera — Bonsoir\nMi chiamo… — Je m''appelle…\nSono congolese / congolese — Je suis congolais(e)\nPiacere ! — Enchanté(e) !',
    true,
    now()
  )
  returning id
)
insert into public.exercises (course_id, title, level, category, exercise_type, instructions, content, solution, is_published)
select course.id, 'Quiz : les salutations', 'A1', 'vocabulaire', 'qcm', 'Choisissez la bonne réponse.',
  '{"questions":[{"id":"q1","text":"Comment dit-on « bonsoir » ?","options":[{"key":"A","text":"Buongiorno"},{"key":"B","text":"Buonasera"},{"key":"C","text":"Arrivederci"}]},{"id":"q2","text":"« Mi chiamo Grâce » signifie…","options":[{"key":"A","text":"J''appelle Grâce"},{"key":"B","text":"Je m''appelle Grâce"},{"key":"C","text":"Grâce m''appelle"}]}]}',
  '{"answers":{"q1":"B","q2":"B"}}',
  true
from course;
