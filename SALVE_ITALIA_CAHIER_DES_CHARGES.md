# SALVE ITALIA — Cahier des Charges

> Plateforme d'accompagnement des étudiants congolais vers les études en Italie — préparation aux tests d'admission (TOLC/CISIA), apprentissage de l'italien, entraînement à l'entretien consulaire par agent IA, et suivi documentaire.
> Version 1.1 — 13 septembre 2026
> Statut : document de travail, à valider avec le centre de langue avant démarrage du développement

**Historique des versions**
- **v1.0** (13/09/2026) : premier cahier des charges à partir du document de passation initial (modules CISIA + agent consulaire + vitrine).
- **v1.1** (13/09/2026) : correction du format CISIA/TOLC (5 options, pas 4) ; ajout des modules orientation/profil étudiant, moteur de test configurable, révision espacée, gestion documentaire, CRM prospects, gestion de classes, gamification, notifications, tableaux de bord détaillés ; renforcement de l'architecture (services, file de tâches, audit) et du modèle de données ; nouvelle roadmap par versions (V1 → V1.3).

---

## 0. Objet du document

Ce cahier des charges détaille les exigences fonctionnelles et techniques de la plateforme **Salve Italia**, sur la base de la proposition commerciale déjà validée avec le client et des décisions techniques prises en amont. Il sert de référence unique pour le développement, les tests de recette et le suivi d'avancement par version.

Les points encore ouverts (non tranchés avec le client) sont signalés par 🔶 **[À VALIDER]** tout au long du document et récapitulés en section 22. Les recommandations issues de recherches externes sont sourcées et signalées comme telles — elles engagent l'auteur du document, pas le client, tant qu'elles ne sont pas validées.

---

## 1. Présentation du projet

| | |
|---|---|
| **Client** | Centre de langue italienne, Brazzaville, République du Congo |
| **Marché cible** | Étudiants congolais francophones préparant des études en Italie ou une demande de visa (étudiant/touristique) auprès de l'ambassade d'Italie |
| **Porteur du projet / développeur** | Miche — étudiant en informatique (Università di Pisa, École 42 Firenze), fondateur de Groupe Alpha / Alpha Tech |
| **Nom commercial du produit** | Salve Italia 🔶 **[À VALIDER — nom du centre non confirmé]** |
| **Document de référence** | `Proposition_site_centre_italien_fonctionnalites.pdf` (proposition commerciale déjà validée) |

### 1.1 Problème adressé

Les candidats congolais à un départ étudiant en Italie doivent réussir deux étapes indépendantes du centre :
1. Un **test d'admission standardisé** (généralement un test de type TOLC, organisé par le consortium CISIA) exigé par les universités italiennes.
2. L'**entretien consulaire** pour l'obtention du visa, qui évalue la cohérence et le sérieux du projet d'études.

Aujourd'hui, la préparation à ces deux étapes repose sur des méthodes classiques (cours, annales papier, entretiens simulés en présentiel). La plateforme numérise et systématise cette préparation, avec deux axes différenciants : un moteur de simulation de test configurable, et un agent IA conversationnel qui simule l'entretien consulaire en conditions quasi réelles (voix, temps réel, rapport d'évaluation).

⚠️ **Point de vigilance terminologique et factuel** : le format des tests CISIA n'est **pas uniforme à 4 options**. Selon le règlement TOLC en vigueur, les tests comportent généralement **5 options de réponse dont une seule correcte**, et il existe plusieurs familles de tests selon la filière visée (TOLC-I, TOLC-E, TOLC-F, TOLC-B, TOLC-S, TOLC-SU, TOLC-PSI, TOLC-LP, etc.), chacune avec ses propres sections, durées et barèmes ([Regolamento TOLC 2026, cisiaonline.it](https://www.cisiaonline.it/sites/default/files/Regolamenti/Rules-TOLC-2026.pdf) — à revérifier au moment du développement, les règlements évoluant chaque année). Le modèle de données et l'UI doivent donc être **configurables**, et non calqués sur un format fixe à 4 choix (voir §7). Par ailleurs, CISIA/TOLC sont des marques et un format propriétaires : la plateforme doit se présenter comme une **« simulation de type TOLC »** et ne pas laisser entendre qu'elle est éditée ou certifiée par le CISIA, sauf accord ou licence obtenue auprès de l'organisme.

### 1.2 Objectifs du projet

- Donner au centre un outil de suivi et de gestion de ses étudiants (comptes, progression, résultats).
- Reproduire les conditions réelles des tests d'admission (chronométré, sans retour en arrière, correction par compétence), sur un moteur configurable plutôt qu'un format figé.
- Offrir un entraînement à l'entretien consulaire disponible à volonté, sans dépendre de la disponibilité d'un formateur humain.
- Accompagner l'étudiant au-delà du seul entraînement aux tests : orientation, suivi documentaire, plan de préparation personnalisé.
- Donner aux enseignants un outil simple pour produire et maintenir la banque de contenus (questions, cours, exercices) et suivre leurs classes.
- Donner à l'admin un outil de pilotage commercial (prospects) et pédagogique (statistiques, coûts IA).
- Servir de vitrine publique pour l'image du centre et l'acquisition de nouveaux inscrits.

### 1.3 Positionnement recommandé

> **Salve Italia est une plateforme d'accompagnement des étudiants congolais vers les études en Italie, combinant préparation aux tests d'admission, apprentissage de l'italien, entraînement à l'entretien consulaire et suivi documentaire — pas seulement une banque de tests.**

Ce positionnement élargi structure les nouveaux modules ajoutés dans cette version (§6, 9–16) ; il reste à valider avec le client, notamment au regard du périmètre contractuel déjà signé dans la proposition commerciale initiale.

---

## 2. Périmètre du projet

### 2.1 Inclus dans le périmètre — Socle V1 (MVP)

- Authentification et gestion des comptes à 3 rôles, sans auto-inscription.
- Module de simulation de test d'admission (banque de questions, passation chronométrée, résultats détaillés) sur un format fixe simple pour démarrer.
- Module de simulation d'entretien consulaire vocal avec agent IA et rapport généré automatiquement.
- Back-office enseignant pour la création de contenu (questions, cours, exercices).
- Back-office admin pour la gestion des comptes et des inscriptions.
- Espace étudiant (tableau de bord, historique, ressources pédagogiques).
- Site vitrine public (présentation du centre, formations, contact, test de niveau gratuit).

### 2.2 Inclus en extension — V1.1 / V1.2 / V1.3

Ajoutés et détaillés dans ce document, à réaliser après le socle V1 (voir roadmap §21) :
- Profil étudiant, indicateurs de préparation, parcours personnalisé.
- Moteur de test configurable (types TOLC multiples, modes entraînement/examen/révision/défi, révision espacée).
- Agent consulaire enrichi (scénarios, mode texte/vocal hybride, détection d'incohérences, rapport multidimensionnel).
- Gestion documentaire et checklist visa.
- CRM prospects, gestion de classes, feedback enseignant privé.
- Gamification, notifications, tableaux de bord avancés.
- Renforts techniques : séparation stricte des services, file de tâches asynchrone, journalisation d'audit et d'usage IA, versioning des contenus.

### 2.3 Explicitement hors périmètre (toutes versions, sauf décision contraire)

- Paiement en ligne (l'accès est inclus dans les frais de formation, gérés hors plateforme).
- Auto-inscription des étudiants.
- Application mobile native (le site doit être responsive, mais aucune app iOS/Android n'est prévue).
- Visioconférence / cours en direct entre enseignant et étudiants.
- Voix IA "premium" (ElevenLabs) — option future, pas un prérequis.
- Multi-langue de l'interface (interface en français ; le contenu pédagogique est en italien).
- Analyse audio de la prononciation/intonation — nécessiterait un module d'analyse vocale dédié, non inclus (voir §10.5).
- Décision officielle ou pré-évaluation juridique d'un dossier de visa : la plateforme reste un outil pédagogique, jamais une source d'autorité administrative (voir §10.1, §11.3).

---

## 3. Utilisateurs et rôles

Aucune auto-inscription : tous les comptes sont créés par l'admin. Les droits doivent être appliqués aussi bien côté interface que côté base de données (règles de sécurité au niveau des lignes — voir §19.3).

| Action | Étudiant | Enseignant | Admin |
|---|:---:|:---:|:---:|
| Se connecter avec un compte créé par l'admin | ✅ | ✅ | ✅ |
| Passer une simulation de test / un entretien consulaire | ✅ | ❌ | ❌ |
| Consulter son propre historique et ses rapports | ✅ | ❌ | ❌ |
| Créer / modifier des questions | ❌ | ✅ | ✅ |
| Publier des cours et exercices | ❌ | ✅ | ✅ |
| Consulter les résultats des étudiants de **ses classes** | ❌ | ✅ | ✅ (toutes classes) |
| Consulter les résultats de **tous** les étudiants du centre | ❌ | ❌ (par défaut) | ✅ |
| Créer / suspendre / supprimer un compte étudiant | ❌ | ❌ | ✅ |
| Créer un compte enseignant | ❌ | ❌ | ✅ |
| Créer une classe et y affecter des étudiants | ❌ | ❌ (propose, admin valide 🔶) | ✅ |
| Gérer les prospects (CRM) | ❌ | ❌ | ✅ |
| Gérer les programmes / inscriptions | ❌ | ❌ | ✅ |
| Publier des annonces | ❌ | ✅ (ciblées à ses classes) | ✅ (toutes) |
| Voir les statistiques globales du centre | ❌ | ❌ | ✅ |

### 3.1 Décision sur la portée enseignant (§3 v1.0, résolue)

**Recommandation retenue** (à confirmer avec le client) : un enseignant **ne voit par défaut que les étudiants de ses propres classes**, pas l'ensemble des étudiants du centre. Cela limite l'exposition de données sensibles (rapports d'entretien consulaire notamment) au strict nécessaire pédagogique, et correspond au modèle « classes » introduit en §13. Un enseignant sans classe assignée ne voit aucun étudiant tant que l'admin ne l'a pas affecté.

---

## 4. Exigences fonctionnelles — Socle V1

Numérotées **EF-xx** pour servir de base aux tests de recette. Les modules d'extension (V1.1+) sont numérotés en continuité en §9.

### 4.1 Module Authentification & Comptes

- **EF-01** : L'admin crée un compte (email + mot de passe temporaire ou lien d'invitation) en renseignant nom complet, téléphone, rôle et niveau (pour les étudiants).
- **EF-02** : L'utilisateur reçoit ses identifiants et doit changer son mot de passe à la première connexion.
- **EF-03** : Un compte peut être suspendu par l'admin (accès bloqué immédiatement, historique conservé).
- **EF-04** : Un étudiant ne voit que son propre espace et ses propres données ; aucune API ne doit exposer les données d'un autre étudiant.
- **EF-05** : Déconnexion automatique après une période d'inactivité 🔶 **[À VALIDER — durée]**.

### 4.2 Module Test d'admission (socle simple)

- **EF-06** : L'enseignant crée une question en choisissant : catégorie, difficulté (1 à 3), énoncé, options de réponse (nombre variable, voir §7), bonne réponse, explication.
- **EF-07** : L'enseignant peut demander à l'IA de générer des variantes d'une question existante (même compétence, difficulté équivalente, énoncé différent) ; les variantes générées doivent être **relues et validées** par un enseignant avant d'entrer dans la banque active — jamais publiées automatiquement.
- **EF-08** : L'étudiant lance une simulation : nombre de questions et durée totale sont fixés par un barème administrable 🔶 **[À VALIDER — barème exact par type de test, voir §7]**.
- **EF-09** : Pendant la simulation : un chronomètre visible, une question à la fois, **pas de retour en arrière**, sélection aléatoire des questions par catégorie et difficulté.
- **EF-10** : Si le temps s'écoule, la simulation se termine automatiquement et les questions sans réponse comptent comme fausses.
- **EF-11** : En cas de perte de connexion pendant la simulation, l'état (question courante, temps restant, réponses déjà données) doit être conservé côté serveur pour permettre une reprise sans redémarrer à zéro 🔶 **[À VALIDER — tolérance de reprise, ex. 2 minutes]**.
- **EF-12** : À la fin, page de résultats : score global, score par catégorie/section, corrections avec explications, temps passé par question.
- **EF-13** : L'étudiant retrouve l'historique de toutes ses simulations passées avec évolution du score dans le temps.
- **EF-14** : L'enseignant/admin peut consulter des statistiques agrégées par question (taux de réussite) pour repérer les questions mal calibrées.

### 4.3 Module Agent Ambassade IA (fonctionnalité phare — socle)

- **EF-15** : L'étudiant choisit un type d'entretien (visa étudiant / touristique / travail) avant de démarrer.
- **EF-16** : Vérification des permissions microphone avant le lancement ; message clair si le micro est refusé ou indisponible.
- **EF-17** : Boucle conversationnelle : capture voix (Web Speech API STT) → transcription affichée à l'écran → envoi à l'API Claude avec le prompt système "consul" (voir §10) → réponse texte affichée → synthèse vocale (Web Speech API TTS, ou ElevenLabs si activé) → tour suivant.
- **EF-18** : L'agent pose une question à la fois, couvre les thèmes définis en §10, et demande des précisions si une réponse est vague.
- **EF-19** : L'entretien se termine automatiquement après un nombre d'échanges défini (10–15) ou si l'étudiant met fin volontairement à la session.
- **EF-20** : À la fin, un rapport structuré est généré (voir format enrichi §10.3) et enregistré.
- **EF-21** : L'historique complet de la conversation (transcript) est conservé et consultable, avec le rapport associé.
- **EF-22** : L'étudiant peut relancer des simulations dans la limite d'un quota administrable 🔶 **[À VALIDER — cf. EF-59]**.
- **EF-23** : En cas d'échec technique en cours de session (micro coupé, API indisponible), la session est arrêtée proprement avec un message d'erreur, sans générer de faux rapport.

### 4.4 Module Contenu pédagogique

- **EF-24** : L'enseignant publie un cours (titre, niveau, catégorie, type de contenu : PDF / vidéo / audio / texte, fichier ou lien).
- **EF-25** : L'enseignant crée des exercices interactifs (QCM, texte à trous, appariement) avec correction immédiate et affichage du score.
- **EF-26** : L'étudiant accède aux cours et exercices filtrés par son niveau (A1–B2).
- **EF-27** : Un test de niveau gratuit, accessible sans compte, est proposé sur le site public pour qualifier les prospects.
- **EF-28** : Calendrier des cours consultable par les étudiants inscrits à un programme.
- **EF-29** : Annonces publiées par l'admin (à tous) ou l'enseignant (à ses classes), visibles sur le tableau de bord.

### 4.5 Site vitrine public

- **EF-30** : Page d'accueil présentant le centre, ses formations et ses résultats (chiffres clés, témoignages).
- **EF-31** : Pages détaillées par formation/niveau.
- **EF-32** : Formulaire d'inscription/contact en ligne (capture des prospects — voir CRM §12).
- **EF-33** : FAQ, témoignages, galerie photo.
- **EF-34** : Coordonnées de contact (WhatsApp, téléphone, email) visibles sur toutes les pages publiques.

### 4.6 Back-office Admin

- **EF-35** : Gestion complète des comptes (créer, modifier, suspendre, réinitialiser mot de passe).
- **EF-36** : Gestion des programmes et des inscriptions (statut actif / terminé / suspendu).
- **EF-37** : Vue d'ensemble : nombre d'étudiants actifs, simulations réalisées, taux de réussite moyen, utilisation du quota API.
- **EF-38** : Export des données étudiant (résultats, rapports) 🔶 **[À VALIDER — format attendu, CSV/PDF]**.

---

## 5. Exigences fonctionnelles — Extensions V1.1+ (par module)

### Module orientation (§9)
- **EF-39** : L'étudiant peut créer et compléter son profil académique et financier.
- **EF-40** : La plateforme calcule un niveau de préparation indicatif par dimension (académique, linguistique, financière, visa).
- **EF-41** : L'étudiant reçoit un parcours personnalisé selon ses résultats.
- **EF-42** : L'admin peut créer des modèles de tests configurables (types, sections, barèmes).
- **EF-43** : Un étudiant peut comparer ses résultats à ses précédentes tentatives.

### Module documentaire (§11)
- **EF-44** : L'étudiant peut déposer des documents dans un espace sécurisé.
- **EF-45** : L'admin ou l'enseignant autorisé peut demander une correction sur un document déposé.
- **EF-46** : Chaque document possède un statut, une date d'expiration et un historique.
- **EF-47** : La plateforme affiche une checklist adaptée au parcours de l'étudiant.
- **EF-48** : La checklist affiche la date de dernière vérification des informations administratives sources.

### Module pédagogique avancé (§8, §13)
- **EF-49** : La plateforme recommande automatiquement des cours et exercices selon les résultats de l'étudiant.
- **EF-50** : L'étudiant peut réviser ses erreurs dans une session dédiée.
- **EF-51** : Le système planifie des révisions espacées selon la maîtrise de chaque notion.
- **EF-52** : L'enseignant peut créer une classe et y affecter des étudiants.
- **EF-53** : L'enseignant peut ajouter un feedback privé à une simulation.

### Module agent IA enrichi (§10)
- **EF-54** : L'étudiant peut choisir un scénario d'entretien (situation financière, niveau de langue, antécédent de refus, etc.).
- **EF-55** : L'étudiant peut corriger la transcription de sa réponse avant envoi à l'agent.
- **EF-56** : L'agent détecte les incohérences entre le profil étudiant et les réponses données en entretien.
- **EF-57** : Le rapport distingue les observations pédagogiques des informations administratives officielles.
- **EF-58** : L'étudiant peut supprimer une session d'entretien et les données associées (droit à l'effacement).
- **EF-59** : Le système bloque une session lorsque la limite de tours ou de coût API est atteinte, avec message explicite.

### Module CRM (§12)
- **EF-60** : Les demandes du formulaire public sont enregistrées comme prospects (leads).
- **EF-61** : L'admin peut affecter un prospect à un responsable.
- **EF-62** : L'admin peut programmer une relance sur un prospect.
- **EF-63** : Le système conserve l'historique des interactions avec chaque prospect.

---

## 6. Exigences non fonctionnelles

| ID | Exigence |
|---|---|
| **ENF-01** | **Sécurité des données** : cloisonnement strict des données par rôle, classe et utilisateur via Row Level Security (RLS) Supabase — pas seulement un contrôle côté frontend. |
| **ENF-02** | **Confidentialité** : les transcripts d'entretien consulaire, les rapports IA et les documents déposés sont des données sensibles (projet de vie, situation personnelle) ; accès restreint à l'étudiant concerné, l'admin, et l'enseignant de sa classe. |
| **ENF-03** | **Disponibilité** : le service doit rester utilisable en conditions de connexion internet moyennes/faibles (contexte Brazzaville) — prévoir dégradation gracieuse plutôt que blocage total en cas de latence élevée. |
| **ENF-04** | **Compatibilité navigateur** : Web Speech API est **inégalement supporté** (bon support Chrome desktop/Android ; support partiel ou absent sur Safari/iOS et Firefox). Le module vocal doit détecter l'absence de support et proposer un repli en mode texte plutôt qu'un écran bloqué (voir §10.4). |
| **ENF-05** | **Responsive** : l'ensemble des interfaces doit être utilisable sur mobile, la majorité des étudiants congolais accédant probablement au web depuis un smartphone. |
| **ENF-06** | **Performance** : temps de réponse de l'agent IA (STT → Claude → TTS) perçu comme fluide, cible indicative < 3 secondes par tour de parole. |
| **ENF-07** | **Maîtrise des coûts** : chaque appel à l'API Claude a un coût direct ; suivi de consommation par étudiant/session via `ai_usage_logs` (§20) pour détecter les abus et alimenter EF-59. |
| **ENF-08** | **Auditabilité** : toute action admin sensible est traçable (horodatage, auteur) via `audit_logs` (§20). |
| **ENF-09** | **Protection des données personnelles** : les données traitées sont sensibles (démarche de visa) ; minimisation et conservation limitée dans le temps 🔶 **[à vérifier — cadre réglementaire congolais applicable]**. |
| **ENF-10** | **Maintenabilité** : prompt de l'agent consul, barèmes de test et checklists doivent être administrables et versionnés sans redéploiement de code (§16). |
| **ENF-11** | **Protection des données vocales** : les transcriptions et enregistrements vocaux (le cas échéant) sont des données personnelles ; la voix peut être considérée comme une donnée biométrique lorsqu'elle sert à identifier une personne. Prévoir consentement explicite, politique de conservation définie et mécanisme de suppression (cf. lignes directrices EDPB sur les assistants vocaux virtuels, [edpb.europa.eu](https://www.edpb.europa.eu/system/files/2021-03/edpb_guidelines_022021_virtual_voice_assistants_adopted-public-consultation_en.pdf) — cadre européen cité à titre de bonne pratique, à confronter au cadre local applicable). |
| **ENF-12** | **Fiabilité de l'information administrative** : toute information relative aux procédures de visa (documents requis, Universitaly, etc.) affichée dans la checklist doit être datée et renvoyer vers la source officielle (ambassade, université), jamais présentée comme définitive ou comme émanant de la plateforme elle-même (cf. §11.3). |

---

## 7. Moteur de test configurable (remplace le modèle CISIA fixe de v1.0)

Le module « test d'admission » du socle V1 (§4.2) utilise dès le départ un modèle configurable plutôt qu'un format figé à 4 catégories/4 options, pour pouvoir couvrir différents types de TOLC sans refonte ultérieure.

```sql
test_templates (
  id uuid primary key,
  code text unique,          -- ex: 'TOLC-I', 'TOLC-E', 'CENTRE-NIVEAU-B1'
  name text,
  language text,
  description text,
  total_duration_seconds int,
  scoring_rules jsonb,       -- barème : points par bonne/mauvaise/absence de réponse
  is_active boolean
);

test_sections (
  id uuid primary key,
  template_id uuid references test_templates(id),
  name text,                 -- ex: 'Logique', 'Matematica', 'Comprensione verbale'
  category text,
  question_count int,
  duration_seconds int,
  order_index int
);
```

Types de test à couvrir à terme, sous réserve de confirmation des filières visées par le centre : TOLC-I, TOLC-E, TOLC-F, TOLC-B, TOLC-S, TOLC-SU, TOLC-PSI, TOLC-LP, ainsi que des tests internes propres au centre (ex. tests de niveau A1–B2). Les sections, durées et barèmes doivent être configurés à partir des règlements officiels en vigueur au moment du paramétrage — ils changent d'une année à l'autre.

**Naming** : dans l'interface et les communications, utiliser systématiquement « simulation de type TOLC » plutôt qu'une mention laissant penser à une émanation officielle du CISIA.

---

## 8. Modes de passation

| Mode | Fonctionnement |
|---|---|
| **Entraînement** | Retour immédiat après chaque réponse, explication affichée, possibilité de revoir ses erreurs en cours de séance |
| **Examen** | Chronomètre, aucune correction immédiate, navigation stricte (pas de retour en arrière) — reproduit les conditions réelles |
| **Révision** | Reprise ciblée des questions déjà répondues incorrectement, classées par compétence |
| **Défi** | Série courte avec objectif de score ou de temps, pensée pour un engagement régulier plutôt qu'une évaluation complète |

Objectif : éviter qu'un étudiant enchaîne uniquement des simulations complètes en mode examen sans jamais retravailler ses erreurs — le mode entraînement et le mode révision sont le point d'entrée recommandé, le mode examen servant de jalon d'évaluation périodique.

### 8.1 Révision espacée

```sql
student_question_stats (
  student_id uuid references profiles(id),
  question_id uuid references questions(id),
  attempts_count int default 0,
  correct_count int default 0,
  average_time_seconds int,
  mastery_score numeric,
  next_review_at timestamptz,
  primary key (student_id, question_id)
);
```

La priorité de recommandation d'une question en mode révision combine trois facteurs : taux d'erreur, ancienneté de la dernière tentative, et importance relative de la compétence dans le barème du test visé.

---

## 9. Profil étudiant et parcours personnalisé

### 9.1 Profil étudiant

Le profil centralise les informations utiles à l'orientation et à la personnalisation du parcours :

- niveau d'études actuel, diplômes obtenus, notes par matière ;
- niveau d'italien et d'anglais ;
- domaine d'études souhaité, villes italiennes préférées, université publique ou privée ;
- objectif (licence, master, formation professionnelle, mobilité) ;
- financement des études et personne en charge, sans détail de montants sensibles côté plateforme au-delà de ce qui est nécessaire au suivi (voir note ci-dessous) ;
- état d'avancement du projet.

Un indicateur de préparation par dimension peut en être dérivé :

```json
{
  "academic_readiness": 72,
  "language_readiness": 58,
  "financial_readiness": 45,
  "visa_readiness": 61,
  "overall_readiness": 59
}
```

Cet indicateur doit être présenté explicitement comme un **outil pédagogique d'auto-évaluation**, jamais comme une décision ou une probabilité d'acceptation par une université ou une ambassade.

⚠️ Note de traitement des données : les informations financières détaillées d'un étudiant (montants précis, situation de financement) sont des données sensibles à manier avec la même prudence que les données de santé — limiter le profil au strict nécessaire au calcul de l'indicateur (ex. une fourchette budgétaire plutôt qu'un montant exact), et restreindre l'accès en conséquence.

### 9.2 Parcours personnalisé

Après un test de positionnement initial, la plateforme génère un parcours adapté : objectifs hebdomadaires, séances de test recommandées, cours et exercices ciblés sur les points faibles, simulations d'entretien, tâches administratives à accomplir.

Exemple de recommandation générée :
> « Votre score en logique est satisfaisant, mais votre compréhension écrite italienne est faible. Cette semaine, réalisez deux exercices de compréhension, révisez le vocabulaire universitaire et passez une simulation TOLC-E. »

```sql
learning_paths (
  id uuid primary key,
  student_id uuid references profiles(id),
  objective text,
  current_step int,
  progress_percent int,
  recommended_actions jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
```

---

## 10. Agent consulaire — spécifications enrichies

### 10.1 Principe directeur

L'agent IA est un outil d'entraînement pédagogique. Il ne prédit pas et ne simule pas une décision consulaire réelle, et la plateforme doit l'indiquer clairement dans l'interface. L'ambassade d'Italie publie ses propres procédures et listes de documents (formulaire de visa, passeport, assurance, justificatifs financiers, préinscription Universitaly, justificatifs académiques) ; ces informations changent et la plateforme n'en est jamais la source d'autorité — voir §11.3 ([ambbrazzaville.esteri.it](https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/), à revérifier périodiquement).

### 10.2 Scénarios d'entretien

Au-delà du seul type de visa, prévoir des profils de scénario pour varier l'entraînement : financement familial, financement par un garant, réorientation d'études, interruption d'études, niveau d'italien limité, première demande, demande après un refus antérieur, visa touristique, visa de travail. Le choix du scénario adapte le prompt système et les thèmes creusés par l'agent.

```sql
embassy_sessions (
  id uuid primary key,
  student_id uuid references profiles(id),
  visa_type text,
  scenario_code text,
  status text check (status in ('in_progress', 'completed', 'failed', 'abandoned')),
  prompt_version text,
  started_at timestamptz,
  completed_at timestamptz,
  overall_score int,
  ai_report jsonb
);

embassy_messages (
  id uuid primary key,
  session_id uuid references embassy_sessions(id),
  speaker text check (speaker in ('agent', 'student')),
  text_content text,
  sequence_number int,
  response_time_seconds int,
  created_at timestamptz
);
```

Stocker les échanges dans une table `embassy_messages` dédiée (plutôt qu'un unique champ JSONB `conversation`, comme dans v1.0) facilite la recherche, l'analyse tour par tour, les statistiques et la suppression sélective d'une session (EF-58).

### 10.3 Rapport pédagogique multidimensionnel

Remplace le rapport plat de v1.0 par un format distinguant les dimensions évaluées :

```json
{
  "verdict": "mitige",
  "overall_score": 68,
  "dimensions": {
    "coherence_project": 76,
    "knowledge_university": 61,
    "financial_clarity": 54,
    "language_confidence": 72,
    "return_plan": 65,
    "document_awareness": 48
  },
  "critical_risks": [
    "Budget mensuel non détaillé",
    "Réponse imprécise sur le logement"
  ],
  "recommended_actions": [
    "Préparer un budget mensuel détaillé",
    "Réviser les documents nécessaires"
  ]
}
```

Éviter tout vocabulaire définitif (« visa accepté / refusé ») au profit d'un vocabulaire pédagogique : cohérence faible / intermédiaire / satisfaisante, points à clarifier, préparation insuffisante sur tel sujet.

### 10.4 Mode vocal et mode texte

Le module ne doit pas dépendre uniquement du navigateur pour fonctionner (cf. ENF-04). Prévoir : mode vocal, mode texte, mode vocal avec confirmation/correction de la transcription avant envoi, bouton « je n'ai pas compris » avec répétition de la question, détection de silence prolongé, reprise d'une session interrompue.

```text
Autorisation microphone
        ↓
Test du microphone
        ↓
Test de transcription
        ↓
Question de l'agent
        ↓
Réponse de l'étudiant
        ↓
Confirmation/correction de la transcription
        ↓
Évaluation de la réponse
        ↓
Question suivante
```

### 10.5 Limites de l'évaluation orale

La plateforme traite la **transcription** de la voix, pas le signal audio lui-même : elle ne peut donc pas évaluer correctement la prononciation, le débit, l'intonation ou les hésitations réelles. Séparer explicitement dans le rapport ce qui relève du contenu de la réponse (évaluable) de ce qui relèverait d'une analyse audio (non couverte en V1, nécessiterait un module dédié pour être fiable).

### 10.6 Détection d'incohérences

L'agent peut signaler des incohérences entre le profil déclaré et les réponses données en entretien (filière différente du projet déclaré, ville différente, budget incompatible, niveau de langue incohérent, dates contradictoires, réponse différente entre deux simulations). Cette fonctionnalité doit être présentée comme une **aide à la cohérence du discours de l'étudiant**, jamais comme une analyse à valeur juridique ou probante.

---

## 11. Gestion documentaire et checklist

### 11.1 Dépôt de documents

Espace où l'étudiant dépose ses documents : passeport, diplôme, relevés de notes, certificat de langue, preuve d'inscription, préinscription Universitaly, assurance, justificatifs financiers, documents traduits, photo d'identité.

Pour chaque document : statut (manquant / déposé / à corriger / validé), commentaire de l'enseignant ou de l'admin, date d'expiration, version, personne ayant validé, historique des modifications. Alerte automatique à l'approche d'une expiration (ex. assurance).

Cette fonctionnalité relève exclusivement du **suivi interne de préparation** ; elle ne constitue jamais une validation officielle du dossier.

### 11.2 Checklist dynamique

La checklist dépend du type de visa, du niveau d'études, de la nationalité, de l'établissement, de la durée du séjour, de la situation de financement, de la présence d'un garant, et des documents déjà déposés.

```json
{
  "label": "Préinscription universitaire",
  "status": "pending",
  "source_url": "source_officielle",
  "last_verified_at": "2026-09-13",
  "requires_human_verification": true
}
```

### 11.3 Avertissement obligatoire

Chaque checklist doit afficher clairement : « Les informations administratives doivent être vérifiées sur le site officiel de l'ambassade d'Italie et de l'établissement concerné. » — avec la date de dernière vérification interne (EF-48).

---

## 12. CRM prospects

Le formulaire public (EF-32) alimente un mini-CRM plutôt qu'un simple envoi d'email :

```sql
leads (
  id uuid primary key,
  full_name text,
  phone text,
  email text,
  desired_program text,
  level_estimate text,
  source text,
  status text,              -- nouveau, contacté, test réalisé, intéressé, inscrit, non intéressé, à relancer
  notes text,
  next_follow_up_at timestamptz,
  assigned_to uuid references profiles(id),
  created_at timestamptz
);
```

---

## 13. Gestion des classes et suivi pédagogique

- Classes/groupes, avec enseignant principal, calendrier, objectifs hebdomadaires, présence, devoirs, progression moyenne, étudiants en difficulté, export du rapport de classe.
- Un enseignant voit uniquement ses classes et les étudiants qui lui sont affectés (voir §3.1).
- Après une simulation, l'enseignant peut ajouter un commentaire privé, une note pédagogique, une tâche à réaliser, une date de suivi et un statut (« traité » / « à revoir ») — séparé du rapport généré par l'IA.

---

## 14. Gamification

Gamification légère, sans transformer la préparation en jeu superficiel : séries de jours actifs, badges de progression (« Première simulation terminée », « 7 jours de révision », « 80 % en logique », « 5 entretiens réalisés », « Documents complets »), objectif hebdomadaire, niveau de maîtrise par compétence, récompenses définies par le centre, certificat de progression interne.

**Éviter un classement global public** : il peut décourager les étudiants les plus faibles et expose leurs résultats. Un classement privé au sein d'une classe, opt-in, est préférable à un classement global.

---

## 15. Notifications

Centre de notifications couvrant : nouvelle annonce, devoir à réaliser, simulation recommandée, document refusé, session programmée, rappel de cours, échéance administrative, message de l'enseignant.

Canaux : notification in-app et email pour la V1 ; WhatsApp et SMS en évolution future, une fois les coûts et les conditions d'utilisation de l'API messagerie validés — ne pas les intégrer en V1 sans cette validation (impact coût direct, cf. §17).

---

## 16. Tableaux de bord

### 16.1 Étudiant
Score moyen et dernier score, progression depuis le premier test, compétences faibles, prochaine action recommandée, nombre d'entretiens réalisés, score moyen de cohérence, documents manquants, prochaines échéances, annonces récentes.

### 16.2 Enseignant
Étudiants à risque, moyenne de la classe, compétences les plus faibles, questions à taux d'échec élevé, étudiants inactifs, devoirs non terminés, simulations récentes, rapports nécessitant une relecture.

### 16.3 Admin
En plus des indicateurs du socle V1 (EF-37) : nombre de prospects par source, taux de conversion prospect → inscrit, étudiants actifs sur 7/30/90 jours, coût IA par étudiant et par session, temps moyen d'un entretien, taux d'échec technique, répartition des navigateurs utilisés pour la voix, taux d'utilisation du mode texte (repli ENF-04), volume de stockage, documents arrivant à expiration.

---

## 17. Architecture technique

### 17.1 Stack (décidée)

| Couche | Technologie |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Base de données + Auth | Supabase (PostgreSQL + Supabase Auth + Storage) |
| IA (agent consul + génération de questions) | Claude API (Anthropic) |
| Voix (STT + TTS) | Web Speech API (natif navigateur) ; ElevenLabs en option future |
| Hébergement frontend | Vercel |
| Hébergement backend | Railway ou Render |

### 17.2 Séparation stricte frontend / IA

Point de vigilance par rapport à l'arborescence initiale (`frontend/src/lib/claude client`) : **aucune logique ni clé Claude ne doit résider côté frontend**. Toute la logique IA passe par le backend :

```text
Frontend React
    ↓
API Node.js / Express
    ↓
Services métier
    ├── AuthService
    ├── TestEngineService        (ex-CisiaService, généralisé à §7)
    ├── EmbassySessionService
    ├── DocumentService
    ├── NotificationService
    ├── AnalyticsService
    └── AIService
             ↓
        Anthropic API
```

Le frontend ne connaît que les endpoints de l'API backend.

### 17.3 Arborescence du projet

```
salve-italia/
├── frontend/                  # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── public/        # Vitrine, test de niveau gratuit
│   │   │   ├── student/       # Espace étudiant
│   │   │   ├── teacher/       # Espace enseignant
│   │   │   └── admin/         # Back-office
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/               # Supabase client uniquement (pas de client IA)
├── backend/                   # Node.js + Express
│   ├── routes/
│   │   ├── auth.js
│   │   ├── questions.js
│   │   ├── simulations.js
│   │   ├── embassy-agent.js
│   │   ├── documents.js
│   │   └── leads.js
│   └── services/
│       ├── claude.js          # Wrapper Claude API
│       ├── test-engine.js
│       ├── embassy-session.js
│       ├── notifications.js
│       └── analytics.js
└── supabase/
    ├── migrations/            # Schéma SQL
    └── seed.sql               # Données initiales (questions de base)
```

### 17.4 File de tâches asynchrone

La génération de rapports (et, à terme, la génération de contenu par lot) ne doit pas bloquer la requête HTTP :

```text
Session terminée → Création d'une tâche → Worker IA → Génération du rapport
→ Enregistrement → Notification de l'étudiant
```

Cela évite les timeouts sur des générations longues et facilite la reprise en cas d'erreur côté Claude API.

### 17.5 Flux — simulation vocale consulaire

1. Navigateur capture la voix → **Web Speech API** (STT natif, zéro coût), ou saisie texte en repli.
2. Texte transcrit envoyé au backend → **Claude API** via `AIService`.
3. Claude joue le rôle du consul (scénario sélectionné, §10.2) et répond en texte.
4. Réponse renvoyée au frontend, lue à voix haute (TTS) ou affichée en mode texte.
5. À la fin de l'entretien : rapport de simulation généré (en tâche asynchrone, §17.4) et enregistré.

---

## 18. Variables d'environnement

```env
# Frontend (.env)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Backend (.env)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
PORT=3001
```

La clé `SUPABASE_SERVICE_ROLE_KEY` contourne les RLS : elle ne doit être utilisée que côté backend, pour des opérations précises (ex. création de compte par l'admin), jamais exposée ni utilisée par défaut.

---

## 19. Modèle de données

### 19.1 Tables du socle

```sql
-- Utilisateurs (géré par Supabase Auth + table profile)
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  role TEXT CHECK (role IN ('student', 'teacher', 'admin')),
  full_name TEXT,
  phone TEXT,
  level TEXT,  -- A1, A2, B1, B2
  created_at TIMESTAMPTZ
)

-- Niveaux et programmes
programs (
  id uuid PRIMARY KEY,
  name TEXT,
  level TEXT,
  description TEXT,
  is_active BOOLEAN
)

-- Classes (nouveau — §13)
classes (
  id uuid PRIMARY KEY,
  name TEXT,
  program_id uuid REFERENCES programs(id),
  teacher_id uuid REFERENCES profiles(id),
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)

class_students (
  class_id uuid REFERENCES classes(id),
  student_id uuid REFERENCES profiles(id),
  PRIMARY KEY (class_id, student_id)
)

-- Inscriptions
enrollments (
  id uuid PRIMARY KEY,
  student_id uuid REFERENCES profiles(id),
  program_id uuid REFERENCES programs(id),
  enrolled_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('active', 'completed', 'suspended'))
)

-- Annonces
announcements (
  id uuid PRIMARY KEY,
  title TEXT,
  body TEXT,
  target TEXT CHECK (target IN ('all', 'students', 'teachers')),
  target_class_id uuid REFERENCES classes(id),
  published_by uuid REFERENCES profiles(id),
  published_at TIMESTAMPTZ
)
```

### 19.2 Moteur de test (remplace le modèle fixe de v1.0 — voir §7)

```sql
test_templates ( ... voir §7 ... )
test_sections ( ... voir §7 ... )

-- Banque de questions (options flexibles, cf. §1.1)
questions (
  id uuid primary key,
  test_section_id uuid references test_sections(id),
  category text,
  difficulty int,
  question_text text,
  options jsonb,             -- [{ "key": "A", "text": "..." }, ... ] — nombre variable
  correct_answer text,
  explanation text,
  language text default 'fr',
  source text check (source in ('manual', 'ai_generated')) default 'manual',
  validation_status text,
  validated_by uuid references profiles(id),  -- obligatoire si source = 'ai_generated' (EF-07)
  created_by uuid references profiles(id),
  version int default 1,
  created_at timestamptz
);

-- Simulations
simulations (
  id uuid primary key,
  student_id uuid references profiles(id),
  test_template_id uuid references test_templates(id),
  mode text check (mode in ('entrainement', 'examen', 'revision', 'defi')),  -- §8
  status text check (status in ('in_progress', 'completed', 'abandoned')) default 'in_progress',
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds int,
  total_questions int,
  score int,
  score_by_category jsonb
)

simulation_answers (
  id uuid primary key,
  simulation_id uuid references simulations(id),
  question_id uuid references questions(id),
  answer_given text,
  is_correct boolean,
  time_spent_seconds int
)

-- Révision espacée (§8.1)
student_question_stats ( ... voir §8.1 ... )
```

### 19.3 Agent consulaire (voir §10.2)

```sql
embassy_sessions ( ... voir §10.2 ... )
embassy_messages ( ... voir §10.2 ... )
```

### 19.4 Orientation et parcours (voir §9)

```sql
-- Extension du profil (peut être une table séparée student_profiles plutôt que d'alourdir profiles)
student_profiles (
  student_id uuid primary key references profiles(id),
  current_education_level text,
  diplomas jsonb,
  italian_level text,
  english_level text,
  desired_field text,
  preferred_cities jsonb,
  institution_type_preference text check (institution_type_preference in ('public', 'prive', 'indifferent')),
  study_objective text check (study_objective in ('licence', 'master', 'formation_pro', 'mobilite')),
  budget_range text,          -- fourchette, pas de montant exact (cf. note §9.1)
  updated_at timestamptz
)

learning_paths ( ... voir §9.2 ... )
```

### 19.5 Contenu pédagogique

```sql
courses (
  id uuid PRIMARY KEY,
  title TEXT,
  level TEXT,
  category TEXT,
  content_type TEXT,
  content_url TEXT,
  published_by uuid REFERENCES profiles(id),
  published_at TIMESTAMPTZ
)

exercises (
  id uuid PRIMARY KEY,
  course_id uuid REFERENCES courses(id),
  title TEXT,
  type TEXT,
  content JSONB,
  created_by uuid REFERENCES profiles(id)
)
```

### 19.6 Documentaire (voir §11)

```sql
student_documents (
  id uuid primary key,
  student_id uuid references profiles(id),
  document_type text,
  status text check (status in ('missing', 'submitted', 'needs_correction', 'validated')),
  file_url text,
  version int default 1,
  expires_at date,
  reviewed_by uuid references profiles(id),
  reviewer_comment text,
  created_at timestamptz,
  updated_at timestamptz
)

checklist_items (
  id uuid primary key,
  student_id uuid references profiles(id),
  label text,
  status text,
  source_url text,
  last_verified_at date,
  requires_human_verification boolean default true
)
```

### 19.7 CRM (voir §12)

```sql
leads ( ... voir §12 ... )
```

### 19.8 Feedback enseignant (voir §13)

```sql
teacher_feedback (
  id uuid primary key,
  simulation_id uuid,          -- référence simulations.id OU embassy_sessions.id selon target_type
  target_type text check (target_type in ('simulation', 'embassy_session')),
  teacher_id uuid references profiles(id),
  comment text,
  follow_up_at date,
  status text check (status in ('a_revoir', 'traite')),
  created_at timestamptz
)
```

### 19.9 Gamification (voir §14)

```sql
badges (
  id uuid primary key,
  code text unique,
  label text,
  description text
)

student_badges (
  student_id uuid references profiles(id),
  badge_id uuid references badges(id),
  awarded_at timestamptz,
  primary key (student_id, badge_id)
)
```

### 19.10 Journalisation — audit et usage IA (renforce §6/ENF-07, ENF-08)

```sql
audit_logs (
  id uuid primary key,
  actor_id uuid references profiles(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz
);

ai_usage_logs (
  id uuid primary key,
  student_id uuid references profiles(id),
  session_id uuid,
  operation text,           -- 'embassy_turn', 'embassy_report', 'question_generation'
  model text,
  input_tokens int,
  output_tokens int,
  estimated_cost numeric,
  created_at timestamptz
);
```

### 19.11 Versioning (ENF-10)

Éléments à versionner explicitement : prompt de l'agent consul (`prompt_version` dans `embassy_sessions`), barèmes de test (`test_templates.scoring_rules`), questions (`questions.version`), checklists documentaires, modèles de rapport. Objectif : pouvoir toujours dire avec quelle version un rapport ou un résultat donné a été produit, notamment lors d'une contestation ou d'une amélioration du prompt.

### 19.12 Sécurité au niveau des données (Row Level Security)

Le modèle d'accès (§3) doit être appliqué en base, pas seulement dans l'interface, car Supabase expose une API accessible directement depuis le frontend :

- Un étudiant ne peut lire/écrire que ses propres lignes dans `simulations`, `simulation_answers`, `embassy_sessions`, `embassy_messages`, `student_documents`, `student_profiles`, `learning_paths`.
- Un enseignant ne peut lire les données étudiant que pour les étudiants de ses `classes` (jointure via `class_students`).
- Seuls `teacher` et `admin` peuvent insérer/modifier dans `questions`, `courses`, `exercises`.
- Seul `admin` peut insérer/modifier `profiles` (création de compte), `programs`, `enrollments`, `classes`, `leads`.
- Les opérations de création de compte (écriture dans `auth.users`) passent par le backend avec la clé de service, jamais depuis le frontend.

---

## 20. Facteurs de coût à surveiller

Deux postes de coûts variables directement liés à l'usage, à modéliser avant mise en production (tarifs à vérifier au moment de la contractualisation, car ils évoluent) :

- **API Claude** : appelée à chaque tour de l'entretien consulaire (potentiellement 10–15 appels par session), pour la génération de variantes de questions, et pour le calcul du rapport final. Le volume dépend directement du nombre d'étudiants actifs et du quota de simulations autorisé (EF-22/EF-59). La table `ai_usage_logs` (§19.10) est le socle de ce suivi.
- **Hébergement** : Vercel (frontend) et Railway/Render (backend) ont des paliers gratuits qui peuvent devenir insuffisants selon le trafic ; Supabase facture au-delà d'un certain volume de base de données/stockage/requêtes Auth.
- **Canaux de notification additionnels** (WhatsApp, SMS) : coût par message à valider avant toute intégration (§15).

Recommandation inchangée depuis v1.0 : instrumenter le suivi de consommation dès la phase agent IA, pour dimensionner ces coûts avant un déploiement à grande échelle plutôt que de les découvrir a posteriori.

---

## 21. Roadmap

### Socle V1 — Fondations, test simple, agent IA, vitrine

**Phase 1 — Fondations**
- Initialisation projet React + Node.js + Supabase
- Supabase Auth avec les 3 rôles + RLS de base
- Tableau de bord admin : créer/gérer des étudiants
- Tableau de bord étudiant : page d'accueil de l'espace personnel
- Navigation et routing (React Router)

*Critères d'acceptation* : un admin peut créer un compte étudiant/enseignant et l'utilisateur créé peut se connecter ; un étudiant ne peut accéder à aucune donnée d'un autre étudiant (test RLS explicite).

**Phase 2 — Moteur de test**
- Back-office enseignant : créer/éditer des questions par section
- Lancement d'une simulation (timer, questions aléatoires, pas de retour arrière), sur un `test_template` simple pour démarrer
- Page de résultats détaillée, historique étudiant

*Critères d'acceptation* : une simulation respecte strictement le barème défini du `test_template` choisi ; le score par section est cohérent avec les réponses enregistrées.

**Phase 3 — Agent ambassade IA ⭐**
- Interface de simulation vocale + repli texte (ENF-04)
- Intégration Claude API : prompt système "consul"
- Boucle conversation STT → Claude → TTS
- Génération asynchrone du rapport final
- Historique des sessions ambassade

*Critères d'acceptation* : une session complète produit un rapport structuré exploitable ; le repli texte fonctionne sans support Web Speech API ; aucune session interrompue ne génère de rapport.

**Phase 4 — Contenu pédagogique**
- Publication de cours, exercices interactifs, test de niveau gratuit, calendrier, annonces

**Phase 5 — Site vitrine public**
- Page d'accueil, pages formations, formulaire de contact (alimentant le CRM dès que disponible), FAQ, témoignages, galerie

### V1.1 — Socle pédagogique élargi
1. Profil étudiant (`student_profiles`)
2. Parcours personnalisé simple (`learning_paths`)
3. Modèles de tests configurables multiples (`test_templates`/`test_sections`)
4. Modes entraînement / examen / révision / défi
5. Révision espacée (`student_question_stats`)
6. Classes et affectation enseignant
7. Tableau de bord enseignant/admin enrichi
8. Journal d'usage de l'IA (`ai_usage_logs`)

### V1.2 — Préparation administrative
1. Checklist visa dynamique
2. Espace documentaire étudiant
3. Suivi des statuts et rappels d'expiration
4. Liens vers sources officielles avec date de vérification
5. CRM prospects
6. Notifications email

### V1.3 — IA avancée
1. Scénarios d'entretien multiples
2. Détection des incohérences profil/réponses
3. Analyse de progression entre sessions
4. Recommandations personnalisées affinées
5. Rapport enseignant dédié
6. Limite de coût par étudiant (EF-59)
7. Étude de faisabilité d'une évaluation de qualité orale (module audio dédié — hors périmètre tant que non instruit)

---

## 22. Points ouverts à valider avec le client

1. **Nom commercial** du centre/de la plateforme.
2. **Barème exact par type de test** (nombre de questions par section, durée) — dépend des filières TOLC réellement visées par le centre et du règlement en vigueur au moment du développement.
3. **Politique de reprise** en cas de déconnexion pendant une simulation.
4. **Quota de simulations** consulaires par étudiant (illimité vs plafonné, pour maîtriser le coût API).
5. **Durée d'inactivité** avant déconnexion automatique.
6. **Format d'export** des données étudiant pour l'admin (CSV, PDF, autre).
7. **Cadre applicable** en matière de protection des données personnelles (démarche de visa, données vocales) pour le contexte congolais.
8. **Usage de la dénomination TOLC/CISIA** dans le marketing et l'interface — vérifier s'il faut un accord/une licence, ou se limiter à « simulation de type TOLC ».
9. **Niveau de détail financier** collecté dans le profil étudiant (fourchette vs montant exact) — arbitrage confidentialité / utilité de l'indicateur de préparation.
10. **Canaux de notification** au-delà de l'email (WhatsApp, SMS) — à valider une fois les coûts d'API connus.
11. **Étendue du feedback enseignant** : un enseignant hors classe assignée doit-il pouvoir consulter ponctuellement un étudiant (ex. remplacement), et selon quelle procédure ?

---

## 23. Sources externes citées

- Règlement TOLC 2026 — CISIA : https://www.cisiaonline.it/sites/default/files/Regolamenti/Rules-TOLC-2026.pdf (à revérifier périodiquement, les règlements évoluant chaque année)
- Ambassade d'Italie à Brazzaville — services consulaires et visas études : https://ambbrazzaville.esteri.it/it/servizi-consolari-e-visti/servizi-per-il-cittadino-straniero/visti/studio/ (à revérifier périodiquement)
- EDPB — Lignes directrices sur les assistants vocaux virtuels (traitement de données vocales) : https://www.edpb.europa.eu/system/files/2021-03/edpb_guidelines_022021_virtual_voice_assistants_adopted-public-consultation_en.pdf

---

## 24. Glossaire

- **CISIA** : Consorzio Interuniversitario Sistemi Integrati per l'Accesso — organisme qui conçoit les tests d'admission (TOLC) aux universités italiennes.
- **TOLC** : Test OnLine CISIA — famille de tests d'admission déclinée par filière (TOLC-I, TOLC-E, TOLC-F, TOLC-S, TOLC-SU, TOLC-B, TOLC-PSI, TOLC-LP, etc.).
- **RLS (Row Level Security)** : mécanisme PostgreSQL/Supabase restreignant l'accès aux lignes d'une table selon l'identité de l'utilisateur connecté.
- **STT / TTS** : Speech-to-Text / Text-to-Speech (reconnaissance et synthèse vocale).
- **A1–B2** : niveaux du Cadre européen commun de référence pour les langues (CECRL).
- **Universitaly** : plateforme officielle italienne de préinscription des étudiants étrangers.
