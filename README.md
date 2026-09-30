# Salve Italia

[![CI](https://github.com/Alpha-tech-CG/salve-_italia/actions/workflows/ci.yml/badge.svg)](https://github.com/Alpha-tech-CG/salve-_italia/actions/workflows/ci.yml)

Plateforme d'accompagnement des étudiants congolais vers les études en Italie.
Référence fonctionnelle : [SALVE_ITALIA_CAHIER_DES_CHARGES.md](SALVE_ITALIA_CAHIER_DES_CHARGES.md) · sécurité : `security-checklist-1 (2).html`.

| Dossier | Contenu |
|---|---|
| `frontend/` | React + Vite + TypeScript + Tailwind — Firebase Auth uniquement, aucune donnée ni clé IA |
| `backend/` | Node.js + Express + TypeScript — auth, services métier, SDK Admin Firebase (Firestore, Auth, Storage) |
| `firebase/` | Règles de sécurité Firestore / Storage et index ; `firebase.json` (émulateurs) à la racine |

## Avancement

- [x] **Phase 1 — Fondations** : 3 rôles, comptes créés par l'admin, mot de passe temporaire à changer, MFA admin, suspension immédiate, données fermées aux clients (contrôle d'accès côté API), audit, déconnexion après inactivité
- [x] **Phase 2 — Moteur de test** : modèles configurables (sections, barème), banque de questions à options variables avec statuts et versions, simulations entraînement / examen, chrono serveur, pas de retour en arrière, correction détaillée, historique
- [x] **Phase 3 — Agent ambassade IA** : entretien oral (Web Speech API) ou écrit, transcription corrigeable avant envoi, agent à sortie structurée (fournisseur `AI_PROVIDER`, **Gemini** en production), rapport multidimensionnel généré en tâche de fond, quotas et plafond de coût, journal `ai_usage_logs`, suppression d'un entretien. En développement, `AI_PROVIDER=fake` fournit un agent factice déterministe (sans clé ni coût, interdit en production)
- [x] **Phase 4 — Contenu pédagogique** : cours (texte, vidéo, audio, PDF, lien) par niveau et par classe, exercices corrigés côté serveur (QCM, texte à trous, appariement), test de niveau gratuit sans compte avec prospects, calendrier des séances, annonces ciblées, gestion des classes, programmes et inscriptions

- [x] **V1.1 — Parcours et suivi** : profil étudiant (fourchettes budgétaires uniquement), indicateur de préparation, parcours personnalisé à règles explicables, révision espacée et modes révision / défi, comparaison des tentatives, modèles de test versionnés, tableaux de bord enseignant (étudiants à suivre, compétences fragiles, questions ratées, feedback privé) et admin (activité, coûts IA, prospects)

- [x] **EF-07 — Variantes de questions par IA** : génération de 1 à 5 variantes d'une question (même compétence et difficulté, énoncé différent), sortie structurée validée côté serveur (options, bonne réponse, doublons), variantes créées « À relire » et liées à leur source, jamais tirées dans une simulation avant activation par un enseignant (validateur enregistré), consommation dans `ai_usage_logs` et audit avec version du prompt
- [x] **EF-38 — Export des données étudiant** (admin) : CSV des résultats lisible dans Excel (point-virgule, BOM, protection contre l'injection de formules) et JSON complet (profil, simulations, rapports et transcripts d'entretien, métadonnées des documents sans les fichiers), export tracé dans l'audit — format à valider avec le client
- [x] **§13 — Présence et devoirs** : feuille de présence par séance depuis le calendrier (présent, retard, absent, excusé ; seule une absence excusée peut être anticipée), taux de présence par étudiant et par classe ; devoirs de classe (consignes, échéance, lien facultatif vers un cours ou un exercice), rendu écrit par l'étudiant (`/etudiant/devoirs`), validation ou reprise obligatoirement commentée ; export CSV du rapport de classe (présence, devoirs, résultats) ; notifications « devoir à réaliser », rappel 24 h avant l'échéance et devoir corrigé ; tableau de bord enseignant avec présence 30 j et devoirs non terminés
- [x] **§16.1 — Tableau de bord étudiant complété** : dernier taux de réussite en simulation, moyenne et progression depuis la première (en % de bonnes réponses, comparable entre barèmes), entretiens réalisés avec score et cohérence moyens, documents vérifiés / manquants / à corriger, prochaines échéances (séances des 14 prochains jours, expirations de documents)
- [x] **§15 — Notifications de calendrier et de rythme** : séance programmée ou déplacée (étudiants actifs de la classe, email), rappel dans les 24 h avant une séance, simulation recommandée au plus une fois par semaine (in-app, sans email) ; aucun doublon. Non couverts : « devoir à réaliser » (attend les devoirs du §13) et « message de l'enseignant » (à valider : le commentaire enseignant est privé, EF-53)
- [x] **ENF-09 / ENF-11 — Conservation limitée des données** (`/admin/conservation`) : durées par catégorie (entretiens, données des comptes étudiants suspendus, anciennes versions de documents, prospects et coordonnées du test de niveau, notifications et emails traités), **désactivées par défaut** tant que le centre n'a pas validé le cadre applicable ; aperçu du volume concerné, purge quotidienne et manuelle (fichiers retirés du stockage), exécution tracée dans l'audit ; durées affichées aux étudiants sur les pages Entretien et Documents. Jamais purgés : audit, coûts IA, comptes et résultats de tests
- [x] **V1.2 — Préparation administrative** : espace documentaire (bucket privé, type réel vérifié, URL signées 60 s, versions et historique), vérification par l'enseignant de la classe ou l'admin, checklist dynamique avec sources officielles et date de vérification (vide tant que le centre n'a pas vérifié), rappels d'expiration, notifications in-app et email (file d'envoi, préférence par utilisateur), CRM avec responsable et historique des interactions

> **IA — fournisseur officiel : Google Gemini.** Décision du porteur de projet (le CDC §17.1 citait Claude à titre indicatif ; le choix retenu pour la production est Gemini). `AI_PROVIDER=gemini` par défaut ; `claude` reste une option technique dormante, `fake` sert au développement. Le palier gratuit de Gemini interdit l'envoi de données personnelles (conditions Google) : développement avec données fictives uniquement, **palier payant `GEMINI_PAID_TIER=true` imposé en production** — le backend refuse de démarrer autrement (`NODE_ENV=production`).
- [x] **Phase 5 — Site vitrine** : accueil, formations (une page par programme), FAQ, galerie, témoignages (publication soumise au consentement), contact et WhatsApp sur toutes les pages, formulaire de contact → prospects (statut, notes, relances). Tout le contenu est administrable (`/admin/site`) : aucune coordonnée, chiffre ou témoignage n'est inventé
- [x] **§14 — Gamification légère** : série de jours actifs, objectif hebdomadaire et badges de progression (première simulation, 80 % dans une section, 7 jours d'activité, 5 entretiens, documents complets), affichés sur le tableau de bord étudiant. Catalogue de badges administrable, dérivés de l'activité existante et persistés à leur premier déblocage. Pas de classement global public (préférence du CDC) — uniquement la progression personnelle

## Démarrage local

Prérequis : Node ≥ 22, pnpm, **Java 21** (émulateurs Firestore/Storage — ex. `winget install Microsoft.OpenJDK.21`).
Les données tournent sur les **émulateurs Firebase** (projet `demo-salve-italia` : aucun vrai projet n'est touché).

```bash
pnpm install
pnpm emulators
```

Copier `backend/.env.example` → `backend/.env` et `frontend/.env.example` → `frontend/.env` : les valeurs par défaut pointent déjà vers les émulateurs. En local, passer `REQUIRE_ADMIN_MFA=false` (l'émulateur Auth ne gère pas la MFA TOTP).

Dans un second terminal, appliquer les migrations puis, au besoin, le contenu et les comptes de démonstration :

```bash
pnpm db:migrate
pnpm db:seed
pnpm --filter @salve/backend demo:seed
```

Ou créer le premier admin réel :

```bash
pnpm --filter @salve/backend bootstrap:admin --email admin@centre.cg --name "Prénom Nom"
```

Lancer frontend (http://localhost:5173) et backend (http://localhost:3001) :

```bash
pnpm dev
```

À la première connexion, l'admin change son mot de passe puis active la MFA (application TOTP).
Interface des émulateurs (données, comptes, emails de réinitialisation) : http://127.0.0.1:4500.

### Données : Firestore

- **Aucun accès client** : les règles ([`firebase/firestore.rules`](firebase/firestore.rules), [`firebase/storage.rules`](firebase/storage.rules)) refusent tout. Le frontend n'utilise Firebase que pour l'authentification ; toutes les données passent par le backend (SDK Admin).
- **Schéma** : [`backend/src/lib/db/schema.ts`](backend/src/lib/db/schema.ts) (une collection par ancienne table : colonnes, valeurs par défaut, clés, unicités, clés étrangères) et [`constraints.ts`](backend/src/lib/db/constraints.ts) (contraintes CHECK, `updated_at`, déclencheurs). La couche [`backend/src/lib/db`](backend/src/lib/db) les applique à chaque écriture, en transaction : mêmes codes d'erreur que Postgres (`23505`, `23503`, `23514`…), cascades `on delete`, unicités matérialisées dans la collection technique `_unique`.
- **Requêtes** : les égalités sont exécutées par Firestore, le reste (plages multiples, tri, jointures) en mémoire — conçu pour le volume d'un centre de formation, **sans index composite** ([`firebase/firestore.indexes.json`](firebase/firestore.indexes.json) reste vide).
- **Migrations** : [`backend/src/migrations`](backend/src/migrations) — scripts versionnés et idempotents (données de référence, configuration MFA), tracés dans la collection `_migrations`. Ne jamais modifier une migration publiée : en ajouter une.

## Tests

```bash
pnpm test               # tests unitaires (backend + frontend)
pnpm test:integration   # démarre les émulateurs et exécute les suites d'intégration
```

`pnpm test:integration` couvre la couche Firestore (contraintes, cascades, jointures, filtres, concurrence), les règles de sécurité (aucun accès client, même authentifié) et un parcours API complet (premier admin, comptes, classe, simulation, dépôt et téléchargement de document, tableaux de bord, site public, suspension). Il remplace l'ancien test RLS et tourne aussi en CI.

## Déploiement (production)

Architecture cible (CDC §17.1) : **frontend sur Vercel**, **backend sur Railway/Render**, **Firebase** (Firestore + Authentication + Storage, projet `salve-italia`). Le compte de service Firebase et les clés IA restent confinés au backend (CDC §17.2).

### 1. Firebase (base + Auth + stockage)
Dans la console du projet `salve-italia` :
- **Authentication** → activer le fournisseur *E-mail/Mot de passe*, puis **passer à Identity Platform** (requis pour la MFA TOTP) ; ajouter le domaine Vercel aux domaines autorisés ;
- **Firestore** → créer la base (mode production, région `europe-west`) ;
- **Storage** → activer le bucket par défaut ;
- **Paramètres → Comptes de service** → générer une clé privée (JSON) pour le backend.

Déployer les règles, puis appliquer les migrations. `backend/.env.production` contient `FIREBASE_PROJECT_ID=salve-italia` et `FIREBASE_SERVICE_ACCOUNT` (clé JSON encodée en base64) — jamais la clé dans le code :

```bash
firebase login
pnpm firebase:deploy
ENV_FILE=.env.production pnpm db:migrate   # depuis backend/, avec backend/.env.production (ignoré par git)
```

Créer ensuite le premier admin (`pnpm --filter @salve/backend bootstrap:admin …`, mêmes variables).

### 2. Backend (Railway ou Render)
Le blueprint [`render.yaml`](render.yaml) décrit le service (build workspace, `startCommand`, health check `/api/health`). Sur Railway, saisir les mêmes commandes dans l'interface. Variables **à renseigner** (secrets côté plateforme) :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_PAID_TIER` | `true` (**imposé** : le backend refuse de démarrer sinon) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | clé du projet Gemini payant + modèle |
| `GEMINI_INPUT_PRICE_PER_MTOK`, `GEMINI_OUTPUT_PRICE_PER_MTOK` | tarifs (suivi des coûts `ai_usage_logs`) |
| `FIREBASE_PROJECT_ID` | `salve-italia` |
| `FIREBASE_SERVICE_ACCOUNT` | clé JSON du compte de service (brute ou base64) — **aucune** variable `*_EMULATOR_HOST` (refusé en production) |
| `CORS_ORIGINS` | domaine Vercel du frontend (séparés par des virgules) |
| `APP_URL`, `SMTP_URL` | URL publique du frontend + serveur d'emails |
| `REQUIRE_ADMIN_MFA` | `true` |

Le port est fourni par la plateforme (`PORT`) et lu automatiquement.

### 3. Frontend (Vercel)
[`frontend/vercel.json`](frontend/vercel.json) configure le build Vite et le repli SPA (routes profondes → `index.html`). Root Directory du projet Vercel = `frontend`. Variables :

| Variable | Valeur |
|---|---|
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` | configuration web publique du projet `salve-italia` (voir `frontend/.env.example`) |
| `VITE_API_URL` | URL publique du backend (Railway/Render) |
| `VITE_IDLE_TIMEOUT_MINUTES` | repli avant chargement du réglage serveur (ex. `30`) |

## Modèle de sécurité (Phase 1)

- **Aucune auto-inscription** : `POST /api/admin/users` (admin + MFA) crée le compte Auth et le profil, renvoie un mot de passe temporaire affiché une seule fois.
- **Rôle lu en base** à chaque requête API, jamais depuis le client ; `requireAuth → requirePasswordChanged → requireRole → requireAdminMfa`.
- **Aucun accès client aux données** : les règles Firestore et Storage refusent tout ; seul le backend (SDK Admin) lit et écrit. Périmètres appliqués par l'API : étudiant = ses données ; enseignant = étudiants de ses classes ; admin = tout, uniquement avec une session MFA (claim Firebase `sign_in_second_factor`).
- **Suspension** : profil suspendu (accès coupé dès la requête suivante), compte Firebase désactivé et sessions révoquées (jetons vérifiés avec `checkRevoked`).
- **Documents** : fichiers privés dans Firebase Storage, téléchargement par URL signée de 60 s émise après contrôle d'accès.
- **Session** en `sessionStorage` (pas de « se souvenir de moi ») + déconnexion après inactivité. La durée est **administrable** (`/admin/parametres`, EF-05) et lue par le frontend à la connexion ; `VITE_IDLE_TIMEOUT_MINUTES` ne sert plus que de repli avant chargement du réglage serveur.
- Pas de cookie d'auth (jeton en en-tête `Authorization`) → pas de surface CSRF classique.

## Points ouverts (cf. CDC §22)

Nom commercial, barèmes TOLC exacts, cadre légal des données personnelles (contexte congolais), licence de dénomination TOLC/CISIA, canaux de notification additionnels (WhatsApp/SMS), etc. La **durée d'inactivité** (§22 #5) est désormais administrable (`/admin/parametres`), défaut 30 min.
