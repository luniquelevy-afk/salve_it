// Contenu de démonstration (ex-supabase/seed.sql) : développement et recette uniquement.
// Durées, horaires et contacts sont laissés vides : ils sont renseignés par le centre (back-office).

export const DEMO_PROGRAMS = [
  {
    "name": "Italien A1 — Découverte",
    "level": "A1",
    "description": "Premiers pas en italien : se présenter, vie quotidienne.",
    "is_public": true,
    "slug": "italien-a1",
    "display_order": 1,
    "summary": "Premiers pas en italien pour les grands débutants.",
    "audience": "Personnes qui découvrent l'italien.",
    "objectives": [
      "Comprendre et utiliser des expressions familières et quotidiennes",
      "Se présenter et poser des questions simples",
      "Communiquer de façon simple si l'interlocuteur parle lentement"
    ]
  },
  {
    "name": "Italien A2 — Élémentaire",
    "level": "A2",
    "description": "Communication simple dans les situations courantes.",
    "is_public": true,
    "slug": "italien-a2",
    "display_order": 2,
    "summary": "Communiquer dans les situations courantes de la vie quotidienne.",
    "audience": "Personnes ayant acquis les bases (niveau A1).",
    "objectives": [
      "Comprendre des phrases sur des sujets familiers",
      "Échanger des informations simples sur des activités courantes",
      "Décrire son environnement et sa formation"
    ]
  },
  {
    "name": "Italien B1 — Intermédiaire",
    "level": "B1",
    "description": "Autonomie à l'oral et à l'écrit, préparation aux études.",
    "is_public": true,
    "slug": "italien-b1",
    "display_order": 3,
    "summary": "Devenir autonome à l'oral et à l'écrit, et commencer la préparation aux études.",
    "audience": "Futurs étudiants en Italie ayant un niveau A2.",
    "objectives": [
      "Comprendre l'essentiel d'un discours clair sur des sujets familiers",
      "Se débrouiller dans la plupart des situations de voyage et d'études",
      "Présenter et justifier un projet d'études"
    ]
  },
  {
    "name": "Italien B2 — Avancé",
    "level": "B2",
    "description": "Niveau universitaire : compréhension de cours, rédaction académique.",
    "is_public": true,
    "slug": "italien-b2",
    "display_order": 4,
    "summary": "Atteindre un niveau proche des exigences universitaires.",
    "audience": "Candidats aux études universitaires en italien.",
    "objectives": [
      "Comprendre des textes complexes et des cours",
      "S'exprimer de façon claire et détaillée",
      "Argumenter à l'écrit et à l'oral dans un cadre académique"
    ]
  }
];

// Barème indicatif de type TOLC : +1 / -0,25 / 0 — à confronter au règlement en vigueur.
export const DEMO_TEMPLATE = {
  "code": "CENTRE-DEMO",
  "name": "Simulation de type TOLC — démonstration",
  "language": "it",
  "description": "Format court pour découvrir la plateforme : logique et mathématiques, 5 options par question.",
  "total_duration_seconds": 1200,
  "scoring_rules": {
    "correct": 1,
    "wrong": -0.25,
    "blank": 0
  }
};

export const DEMO_SECTIONS = [
  {
    "name": "Logica",
    "category": "logica",
    "question_count": 3,
    "order_index": 0
  },
  {
    "name": "Matematica",
    "category": "matematica",
    "question_count": 3,
    "order_index": 1
  }
];

export const DEMO_QUESTIONS = [
  {
    "category": "logica",
    "difficulty": 1,
    "question_text": "Se tutti i gatti sono felini e alcuni felini sono neri, quale affermazione è necessariamente vera?",
    "options": [{"key":"A","text":"Tutti i gatti sono neri"},{"key":"B","text":"Alcuni gatti sono neri"},{"key":"C","text":"Tutti i gatti sono felini"},{"key":"D","text":"Nessun gatto è nero"},{"key":"E","text":"Tutti i felini sono gatti"}],
    "correct_answer": "C",
    "explanation": "È l'unica affermazione garantita dalla prima premessa ; i felini neri potrebbero non essere gatti.",
    "validation_status": "active"
  },
  {
    "category": "logica",
    "difficulty": 2,
    "question_text": "Quale numero completa la successione 2, 6, 12, 20, 30, … ?",
    "options": [{"key":"A","text":"40"},{"key":"B","text":"42"},{"key":"C","text":"44"},{"key":"D","text":"36"},{"key":"E","text":"48"}],
    "correct_answer": "B",
    "explanation": "Le differenze crescono di 2 : +4, +6, +8, +10, quindi +12 → 42.",
    "validation_status": "active"
  },
  {
    "category": "logica",
    "difficulty": 1,
    "question_text": "Marco è più alto di Luca. Luca è più alto di Paolo. Chi è il più basso?",
    "options": [{"key":"A","text":"Marco"},{"key":"B","text":"Luca"},{"key":"C","text":"Paolo"},{"key":"D","text":"Non si può stabilire"},{"key":"E","text":"Marco e Luca"}],
    "correct_answer": "C",
    "explanation": "Marco > Luca > Paolo : Paolo è il più basso.",
    "validation_status": "active"
  },
  {
    "category": "logica",
    "difficulty": 2,
    "question_text": "La negazione di «Tutti gli studenti hanno superato l'esame» è:",
    "options": [{"key":"A","text":"Nessuno studente ha superato l'esame"},{"key":"B","text":"Almeno uno studente non ha superato l'esame"},{"key":"C","text":"Alcuni studenti hanno superato l'esame"},{"key":"D","text":"Tutti gli studenti sono stati bocciati"},{"key":"E","text":"Nessuna delle precedenti"}],
    "correct_answer": "B",
    "explanation": "Per negare «tutti» basta un controesempio : almeno uno non l'ha superato.",
    "validation_status": "active"
  },
  {
    "category": "logica",
    "difficulty": 1,
    "question_text": "Quale numero completa la successione 3, 9, 27, 81, … ?",
    "options": [{"key":"A","text":"162"},{"key":"B","text":"243"},{"key":"C","text":"324"},{"key":"D","text":"108"},{"key":"E","text":"729"}],
    "correct_answer": "B",
    "explanation": "Ogni termine è il triplo del precedente : 81 × 3 = 243.",
    "validation_status": "active"
  },
  {
    "category": "matematica",
    "difficulty": 1,
    "question_text": "Quanto vale il 15% di 240?",
    "options": [{"key":"A","text":"24"},{"key":"B","text":"32"},{"key":"C","text":"36"},{"key":"D","text":"40"},{"key":"E","text":"48"}],
    "correct_answer": "C",
    "explanation": "240 × 0,15 = 36.",
    "validation_status": "active"
  },
  {
    "category": "matematica",
    "difficulty": 1,
    "question_text": "Se 3x + 7 = 22, allora x vale:",
    "options": [{"key":"A","text":"3"},{"key":"B","text":"4"},{"key":"C","text":"5"},{"key":"D","text":"6"},{"key":"E","text":"7"}],
    "correct_answer": "C",
    "explanation": "3x = 15, quindi x = 5.",
    "validation_status": "active"
  },
  {
    "category": "matematica",
    "difficulty": 1,
    "question_text": "Qual è l'area di un rettangolo con lati di 8 cm e 5 cm?",
    "options": [{"key":"A","text":"13 cm²"},{"key":"B","text":"26 cm²"},{"key":"C","text":"40 cm²"},{"key":"D","text":"45 cm²"},{"key":"E","text":"80 cm²"}],
    "correct_answer": "C",
    "explanation": "Area = base × altezza = 8 × 5 = 40 cm².",
    "validation_status": "active"
  },
  {
    "category": "matematica",
    "difficulty": 2,
    "question_text": "Quanto vale √144 + 2³?",
    "options": [{"key":"A","text":"18"},{"key":"B","text":"20"},{"key":"C","text":"22"},{"key":"D","text":"24"},{"key":"E","text":"16"}],
    "correct_answer": "B",
    "explanation": "√144 = 12 e 2³ = 8 : 12 + 8 = 20.",
    "validation_status": "active"
  },
  {
    "category": "matematica",
    "difficulty": 3,
    "question_text": "Un prezzo di 50 € aumenta del 20% e poi diminuisce del 20%. Qual è il prezzo finale?",
    "options": [{"key":"A","text":"50 €"},{"key":"B","text":"48 €"},{"key":"C","text":"52 €"},{"key":"D","text":"46 €"},{"key":"E","text":"40 €"}],
    "correct_answer": "B",
    "explanation": "50 × 1,2 = 60 ; 60 × 0,8 = 48 €. Le percentuali non si compensano.",
    "validation_status": "active"
  }
];

// FAQ : uniquement des informations exactes sur la plateforme elle-même.
export const DEMO_FAQ = [
  {
    "question": "Le test de niveau est-il gratuit ?",
    "answer": "Oui. Le test en ligne est gratuit et sans inscription. Il donne une estimation indicative de votre niveau (du A1 au B2), qui peut être complétée par un échange avec le centre.",
    "display_order": 1
  },
  {
    "question": "Qu'est-ce qu'une simulation de type TOLC ?",
    "answer": "Beaucoup d'universités italiennes demandent un test d'admission de type TOLC, organisé par le CISIA. Nos simulations en reproduisent les conditions : questions à choix multiples, chronomètre, pas de retour en arrière et correction détaillée. Elles sont indépendantes du CISIA.",
    "display_order": 2
  },
  {
    "question": "L'entretien consulaire simulé remplace-t-il l'entretien réel ?",
    "answer": "Non. C'est un outil d'entraînement qui vous aide à préparer et clarifier vos réponses. Il ne préjuge en rien de la décision de l'ambassade.",
    "display_order": 3
  },
  {
    "question": "Comment obtenir un accès à la plateforme ?",
    "answer": "Les comptes sont créés par le centre lors de votre inscription à une formation. Utilisez le formulaire de contact pour connaître les prochaines sessions.",
    "display_order": 4
  },
  {
    "question": "Les informations sur les visas sont-elles officielles ?",
    "answer": "Non. Les procédures et documents requis doivent toujours être vérifiés sur le site officiel de l'ambassade d'Italie et auprès de l'établissement concerné.",
    "display_order": 5
  }
];

// Test de niveau gratuit (EF-27) : 3 questions par niveau, du plus simple au plus avancé.
export const LEVEL_TEST_QUESTIONS = [
  {
    "level": "A1",
    "order_index": 1,
    "question_text": "Completa: Io ___ Marco.",
    "options": [{"key":"A","text":"sono"},{"key":"B","text":"sei"},{"key":"C","text":"è"},{"key":"D","text":"siamo"}],
    "correct_answer": "A"
  },
  {
    "level": "A1",
    "order_index": 2,
    "question_text": "Qual è il plurale di «libro»?",
    "options": [{"key":"A","text":"libri"},{"key":"B","text":"libre"},{"key":"C","text":"libros"},{"key":"D","text":"libra"}],
    "correct_answer": "A"
  },
  {
    "level": "A1",
    "order_index": 3,
    "question_text": "«Buongiorno» si dice…",
    "options": [{"key":"A","text":"la mattina"},{"key":"B","text":"prima di dormire"},{"key":"C","text":"per chiedere scusa"},{"key":"D","text":"per dire grazie"}],
    "correct_answer": "A"
  },
  {
    "level": "A2",
    "order_index": 4,
    "question_text": "Ieri io ___ al cinema.",
    "options": [{"key":"A","text":"vado"},{"key":"B","text":"sono andato"},{"key":"C","text":"andrò"},{"key":"D","text":"vada"}],
    "correct_answer": "B"
  },
  {
    "level": "A2",
    "order_index": 5,
    "question_text": "Abito ___ Brazzaville.",
    "options": [{"key":"A","text":"a"},{"key":"B","text":"in"},{"key":"C","text":"da"},{"key":"D","text":"su"}],
    "correct_answer": "A"
  },
  {
    "level": "A2",
    "order_index": 6,
    "question_text": "«Mi piacciono» si usa con…",
    "options": [{"key":"A","text":"un nome plurale"},{"key":"B","text":"un verbo all'infinito"},{"key":"C","text":"un nome singolare"},{"key":"D","text":"un avverbio"}],
    "correct_answer": "A"
  },
  {
    "level": "B1",
    "order_index": 7,
    "question_text": "Se avessi più tempo, ___ l'italiano ogni giorno.",
    "options": [{"key":"A","text":"studio"},{"key":"B","text":"studierei"},{"key":"C","text":"studiavo"},{"key":"D","text":"studierò"}],
    "correct_answer": "B"
  },
  {
    "level": "B1",
    "order_index": 8,
    "question_text": "Penso che Marco ___ ragione.",
    "options": [{"key":"A","text":"ha"},{"key":"B","text":"abbia"},{"key":"C","text":"avrà"},{"key":"D","text":"aveva"}],
    "correct_answer": "B"
  },
  {
    "level": "B1",
    "order_index": 9,
    "question_text": "Dopo «nonostante» si usa…",
    "options": [{"key":"A","text":"il congiuntivo"},{"key":"B","text":"il futuro"},{"key":"C","text":"l'infinito passato"},{"key":"D","text":"il gerundio"}],
    "correct_answer": "A"
  },
  {
    "level": "B2",
    "order_index": 10,
    "question_text": "Scegli la frase corretta.",
    "options": [{"key":"A","text":"Se l'avessi saputo, sarei venuto."},{"key":"B","text":"Se lo sapevo, venirei."},{"key":"C","text":"Se l'avrei saputo, sarei venuto."},{"key":"D","text":"Se lo sapessi, sono venuto."}],
    "correct_answer": "A"
  },
  {
    "level": "B2",
    "order_index": 11,
    "question_text": "«Ciononostante» significa…",
    "options": [{"key":"A","text":"tuttavia"},{"key":"B","text":"perciò"},{"key":"C","text":"infatti"},{"key":"D","text":"cioè"}],
    "correct_answer": "A"
  },
  {
    "level": "B2",
    "order_index": 12,
    "question_text": "Il progetto ___ approvato dal consiglio la settimana scorsa.",
    "options": [{"key":"A","text":"è stato"},{"key":"B","text":"ha stato"},{"key":"C","text":"è stata"},{"key":"D","text":"ha stati"}],
    "correct_answer": "A"
  }
];

export const DEMO_COURSE = {
  "title": "Salutations et présentations",
  "description": "Se présenter et saluer en italien.",
  "level": "A1",
  "category": "vocabulaire",
  "content_type": "text",
  "body": "Ciao ! — Salut (informel)\nBuongiorno — Bonjour (le matin)\nBuonasera — Bonsoir\nMi chiamo… — Je m'appelle…\nSono congolese / congolese — Je suis congolais(e)\nPiacere ! — Enchanté(e) !",
  "is_published": true
};

export const DEMO_EXERCISE = {
  "title": "Quiz : les salutations",
  "level": "A1",
  "category": "vocabulaire",
  "exercise_type": "qcm",
  "instructions": "Choisissez la bonne réponse.",
  "content": {
    "questions": [
      {
        "id": "q1",
        "text": "Comment dit-on « bonsoir » ?",
        "options": [
          {
            "key": "A",
            "text": "Buongiorno"
          },
          {
            "key": "B",
            "text": "Buonasera"
          },
          {
            "key": "C",
            "text": "Arrivederci"
          }
        ]
      },
      {
        "id": "q2",
        "text": "« Mi chiamo Grâce » signifie…",
        "options": [
          {
            "key": "A",
            "text": "J'appelle Grâce"
          },
          {
            "key": "B",
            "text": "Je m'appelle Grâce"
          },
          {
            "key": "C",
            "text": "Grâce m'appelle"
          }
        ]
      }
    ]
  },
  "solution": {
    "answers": {
      "q1": "B",
      "q2": "B"
    }
  },
  "is_published": true
};
