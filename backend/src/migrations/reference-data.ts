// Données de référence portées des migrations SQL Supabase (extraction automatique des INSERT).
// Appliquées par la migration 0001 (voir ./index.ts). Ne pas modifier une migration déjà appliquée :
// ajouter une nouvelle migration.

export const DOCUMENT_TYPES = [
  {
    "code": "passeport",
    "label": "Passeport",
    "description": "Pages d’identité, en cours de validité.",
    "requires_expiry": true,
    "display_order": 1
  },
  {
    "code": "formulaire_visa",
    "label": "Formulaire de demande de visa",
    "description": "Formulaire rempli et signé.",
    "requires_expiry": false,
    "display_order": 2
  },
  {
    "code": "photo_identite",
    "label": "Photo d’identité",
    "description": "Photo récente au format demandé.",
    "requires_expiry": false,
    "display_order": 3
  },
  {
    "code": "preinscription_universitaly",
    "label": "Préinscription Universitaly",
    "description": "Récapitulatif de la préinscription.",
    "requires_expiry": false,
    "display_order": 4
  },
  {
    "code": "diplomes_releves",
    "label": "Diplômes et relevés de notes",
    "description": "Diplômes et relevés du parcours antérieur.",
    "requires_expiry": false,
    "display_order": 5
  },
  {
    "code": "traductions",
    "label": "Traductions et légalisations",
    "description": "Traductions des documents académiques, le cas échéant.",
    "requires_expiry": false,
    "display_order": 6
  },
  {
    "code": "certificat_langue",
    "label": "Certificat de langue",
    "description": "Certificat d’italien ou d’anglais, selon la formation.",
    "requires_expiry": false,
    "display_order": 7
  },
  {
    "code": "justificatifs_financiers",
    "label": "Justificatifs de ressources",
    "description": "Documents prouvant les moyens financiers pour le séjour.",
    "requires_expiry": false,
    "display_order": 8
  },
  {
    "code": "documents_garant",
    "label": "Documents du garant",
    "description": "Engagement et justificatifs du garant.",
    "requires_expiry": false,
    "display_order": 9
  },
  {
    "code": "assurance_sante",
    "label": "Assurance santé",
    "description": "Attestation d’assurance couvrant le séjour.",
    "requires_expiry": true,
    "display_order": 10
  },
  {
    "code": "hebergement",
    "label": "Justificatif d’hébergement",
    "description": "Réservation, contrat ou attestation de logement.",
    "requires_expiry": false,
    "display_order": 11
  },
  {
    "code": "reservation_voyage",
    "label": "Réservation de voyage",
    "description": "Réservation aller-retour ou itinéraire.",
    "requires_expiry": false,
    "display_order": 12
  },
  {
    "code": "contrat_travail",
    "label": "Contrat ou autorisation de travail",
    "description": "Contrat de travail et autorisation délivrée à l’employeur.",
    "requires_expiry": false,
    "display_order": 13
  }
];

export const CHECKLIST_REQUIREMENTS = [
  {
    "code": "passeport",
    "label": "Passeport valide",
    "description": "Généralement demandé pour toute demande de visa, avec une validité couvrant le séjour.",
    "document_type": "passeport",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 1
  },
  {
    "code": "formulaire_visa",
    "label": "Formulaire de demande de visa",
    "description": "Formulaire officiel à remplir et signer.",
    "document_type": "formulaire_visa",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 2
  },
  {
    "code": "photo_identite",
    "label": "Photo d’identité",
    "description": "Format et nombre de photos à vérifier sur le site officiel.",
    "document_type": "photo_identite",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 3
  },
  {
    "code": "preinscription_universitaly",
    "label": "Préinscription universitaire (Universitaly)",
    "description": "Préinscription auprès de l’établissement italien via le portail Universitaly.",
    "document_type": "preinscription_universitaly",
    "visa_types": [
      "etudes"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Universitaly",
    "source_url": "https://www.universitaly.it/",
    "display_order": 4
  },
  {
    "code": "diplomes_releves",
    "label": "Diplômes et relevés de notes",
    "description": "Justificatifs du parcours académique, souvent avec traduction et légalisation.",
    "document_type": "diplomes_releves",
    "visa_types": [
      "etudes"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie — visa pour études",
    "source_url": "https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/",
    "display_order": 5
  },
  {
    "code": "traductions",
    "label": "Traductions et légalisations",
    "description": "Selon les exigences de l’établissement et de l’ambassade.",
    "document_type": "traductions",
    "visa_types": [
      "etudes"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie — visa pour études",
    "source_url": "https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/",
    "display_order": 6
  },
  {
    "code": "certificat_langue",
    "label": "Certificat de langue",
    "description": "Selon la langue d’enseignement de la formation visée.",
    "document_type": "certificat_langue",
    "visa_types": [
      "etudes"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie — visa pour études",
    "source_url": "https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/",
    "display_order": 7
  },
  {
    "code": "justificatifs_financiers",
    "label": "Justificatifs de ressources",
    "description": "Preuve des moyens financiers pour la durée du séjour.",
    "document_type": "justificatifs_financiers",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 8
  },
  {
    "code": "documents_garant",
    "label": "Documents du garant",
    "description": "Si vos études sont financées par un garant.",
    "document_type": "documents_garant",
    "visa_types": [
      "etudes",
      "tourisme"
    ],
    "financing_sources": null,
    "requires_guarantor": true,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 9
  },
  {
    "code": "assurance_sante",
    "label": "Assurance santé",
    "description": "Couverture médicale pour la durée du séjour.",
    "document_type": "assurance_sante",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 10
  },
  {
    "code": "hebergement",
    "label": "Justificatif d’hébergement",
    "description": "Logement prévu pendant le séjour.",
    "document_type": "hebergement",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 11
  },
  {
    "code": "reservation_voyage",
    "label": "Réservation de voyage",
    "description": "Généralement demandée pour un séjour touristique.",
    "document_type": "reservation_voyage",
    "visa_types": [
      "tourisme"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 12
  },
  {
    "code": "contrat_travail",
    "label": "Contrat et autorisation de travail",
    "description": "Autorisation obtenue par l’employeur en Italie et contrat.",
    "document_type": "contrat_travail",
    "visa_types": [
      "travail"
    ],
    "financing_sources": null,
    "requires_guarantor": null,
    "source_label": "Ambassade d’Italie à Brazzaville",
    "source_url": "https://ambbrazzaville.esteri.it/",
    "display_order": 13
  }
];

export const EMBASSY_SCENARIOS = [
  {
    "code": "standard",
    "label": "Entretien classique",
    "description": "Un entretien complet qui couvre l’ensemble des thèmes habituels.",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "agent_instructions": "Menez un entretien équilibré couvrant tous les thèmes indiqués.",
    "focus_themes": [],
    "display_order": 1
  },
  {
    "code": "financement_familial",
    "label": "Financement par la famille",
    "description": "Vos études sont financées par votre famille : l’agent approfondit la solidité et l’organisation de ce financement.",
    "visa_types": [
      "etudes"
    ],
    "agent_instructions": "Le candidat indique être financé par sa famille. Approfondissez : qui finance, la régularité des ressources, le budget mensuel prévu, la prise en charge des frais imprévus et l’organisation concrète des transferts d’argent.",
    "focus_themes": [
      "origine et régularité du financement",
      "budget mensuel",
      "frais imprévus"
    ],
    "display_order": 2
  },
  {
    "code": "garant",
    "label": "Financement par un garant",
    "description": "Un garant se porte caution pour vous : l’agent interroge sur ce garant et son engagement.",
    "visa_types": [
      "etudes",
      "tourisme"
    ],
    "agent_instructions": "Le candidat s’appuie sur un garant. Approfondissez : le lien avec le garant, la nature de son engagement, sa capacité à assumer les frais et la connaissance qu’a le candidat des documents correspondants.",
    "focus_themes": [
      "relation avec le garant",
      "engagement du garant",
      "documents du garant"
    ],
    "display_order": 3
  },
  {
    "code": "reorientation",
    "label": "Réorientation d’études",
    "description": "Vous changez de domaine d’études : l’agent vérifie que ce choix est cohérent et réfléchi.",
    "visa_types": [
      "etudes"
    ],
    "agent_instructions": "Le candidat change de domaine d’études. Demandez-lui de justifier ce changement, le lien avec son parcours antérieur et avec son projet professionnel, et ce qui a motivé le choix de la nouvelle formation.",
    "focus_themes": [
      "raisons de la réorientation",
      "lien avec le parcours",
      "projet professionnel"
    ],
    "display_order": 4
  },
  {
    "code": "interruption_etudes",
    "label": "Reprise après une interruption",
    "description": "Vous reprenez des études après une interruption : l’agent s’intéresse à cette période et à votre motivation.",
    "visa_types": [
      "etudes"
    ],
    "agent_instructions": "Le parcours du candidat comporte une interruption d’études. Interrogez-le avec tact sur ses activités pendant cette période, sur ce qu’elle lui a apporté et sur les raisons de la reprise, sans porter de jugement.",
    "focus_themes": [
      "activités pendant l’interruption",
      "motivation de la reprise"
    ],
    "display_order": 5
  },
  {
    "code": "italien_limite",
    "label": "Niveau d’italien encore limité",
    "description": "Votre italien est encore en progression : l’agent vérifie votre plan pour suivre les cours.",
    "visa_types": [
      "etudes"
    ],
    "agent_instructions": "Le niveau d’italien du candidat est encore limité. Demandez la langue d’enseignement de la formation, son plan d’apprentissage avant et pendant le séjour. Vous pouvez poser une ou deux questions très simples en italien, puis revenir au français.",
    "focus_themes": [
      "langue d’enseignement",
      "plan d’apprentissage de l’italien"
    ],
    "display_order": 6
  },
  {
    "code": "premiere_demande",
    "label": "Première demande de visa",
    "description": "Vous demandez un visa pour la première fois : l’agent vérifie que vous maîtrisez les démarches.",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "agent_instructions": "Il s’agit de la première demande de visa du candidat. Vérifiez sa compréhension des démarches, des documents et de l’organisation pratique de son arrivée en Italie.",
    "focus_themes": [
      "démarches et documents",
      "organisation de l’arrivée"
    ],
    "display_order": 7
  },
  {
    "code": "apres_refus",
    "label": "Nouvelle demande après un refus",
    "description": "Vous redéposez une demande après un refus : l’agent cherche ce qui a changé dans votre dossier.",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "agent_instructions": "Le candidat a déjà essuyé un refus. Demandez-lui, sans jugement, ce qui a évolué dans son projet ou son dossier depuis. Ne spéculez jamais sur les motifs officiels du refus précédent.",
    "focus_themes": [
      "évolutions depuis la précédente demande"
    ],
    "display_order": 8
  },
  {
    "code": "exigeant",
    "label": "Entretien exigeant",
    "description": "Un agent plus bref et plus exigeant, qui relance à chaque réponse imprécise.",
    "visa_types": [
      "etudes",
      "tourisme",
      "travail"
    ],
    "agent_instructions": "Adoptez un ton plus bref et plus exigeant, restez toujours courtois. Relancez systématiquement lorsqu’une réponse manque de précision ou d’exemples concrets.",
    "focus_themes": [],
    "display_order": 9
  }
];

export const BADGES = [
  {
    "code": "first_simulation",
    "label": "Première simulation",
    "description": "Vous avez terminé votre première simulation de test.",
    "sort_order": 10
  },
  {
    "code": "section_80",
    "label": "80 % dans une section",
    "description": "Vous avez atteint 80 % de bonnes réponses dans une section.",
    "sort_order": 20
  },
  {
    "code": "week_streak",
    "label": "7 jours d'activité",
    "description": "Vous avez été actif 7 jours de suite.",
    "sort_order": 30
  },
  {
    "code": "five_interviews",
    "label": "5 entretiens réalisés",
    "description": "Vous avez réalisé 5 simulations d'entretien consulaire.",
    "sort_order": 40
  },
  {
    "code": "documents_complete",
    "label": "Documents complets",
    "description": "Tous vos documents requis sont validés.",
    "sort_order": 50
  }
];
