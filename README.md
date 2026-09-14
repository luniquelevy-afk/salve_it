# Salve Italia

[![CI](https://github.com/Alpha-tech-CG/salve-_italia/actions/workflows/ci.yml/badge.svg)](https://github.com/Alpha-tech-CG/salve-_italia/actions/workflows/ci.yml)

Plateforme d'accompagnement des étudiants congolais vers les études en Italie.
Référence fonctionnelle : [SALVE_ITALIA_CAHIER_DES_CHARGES.md](SALVE_ITALIA_CAHIER_DES_CHARGES.md) · sécurité : `security-checklist-1 (2).html`.

| Dossier | Contenu |
|---|---|
| `frontend/` | React + Vite + TypeScript + Tailwind — client Supabase uniquement, aucune clé IA |
| `backend/` | Node.js + Express + TypeScript — auth, services métier, clé service Supabase |
| `supabase/` | Migrations SQL (schéma + RLS) et `seed.sql` |

## Avancement

- [x] **Phase 1 — Fondations** : 3 rôles, comptes créés par l'admin, mot de passe temporaire à changer, MFA admin, suspension immédiate, RLS sur toutes les tables, audit, déconnexion après inactivité
- [x] **Phase 2 — Moteur de test** : modèles configurables (sections, barème), banque de questions à options variables avec statuts et versions, simulations entraînement / examen, chrono serveur, pas de retour en arrière, correction détaillée, historique
- [x] **Phase 3 — Agent ambassade IA** : entretien oral (Web Speech API) ou écrit, transcription corrigeable avant envoi, agent `claude-opus-5` à sortie structurée, rapport multidimensionnel généré en tâche de fond, quotas et plafond de coût, journal `ai_usage_logs`, suppression d'un entretien. Sans `ANTHROPIC_API_KEY`, `EMBASSY_FAKE_AI=true` fournit un agent factice pour le développement
- [x] **Phase 4 — Contenu pédagogique** : cours (texte, vidéo, audio, PDF, lien) par niveau et par classe, exercices corrigés côté serveur (QCM, texte à trous, appariement), test de niveau gratuit sans compte avec prospects, calendrier des séances, annonces ciblées, gestion des classes, programmes et inscriptions

- [x] **V1.1 — Parcours et suivi** : profil étudiant (fourchettes budgétaires uniquement), indicateur de préparation, parcours personnalisé à règles explicables, révision espacée et modes révision / défi, comparaison des tentatives, modèles de test versionnés, tableaux de bord enseignant (étudiants à suivre, compétences fragiles, questions ratées, feedback privé) et admin (activité, coûts IA, prospects)

- [x] **EF-07 — Variantes de questions par IA** : génération de 1 à 5 variantes d'une question (même compétence et difficulté, énoncé différent), sortie structurée validée côté serveur (options, bonne réponse, doublons), variantes créées « À relire » et liées à leur source, jamais tirées dans une simulation avant activation par un enseignant (validateur enregistré), consommation dans `ai_usage_logs` et audit avec version du prompt
- [x] **EF-38 — Export des données étudiant** (admin) : CSV des résultats lisible dans Excel (point-virgule, BOM, protection contre l'injection de formules) et JSON complet (profil, simulations, rapports et transcripts d'entretien, métadonnées des documents sans les fichiers), export tracé dans l'audit — format à valider avec le client
- [x] **§13 — Présence et devoirs** : feuille de présence par séance depuis le calendrier (présent, retard, absent, excusé ; seule une absence excusée peut être anticipée), taux de présence par étudiant et par classe ; devoirs de classe (consignes, échéance, lien facultatif vers un cours ou un exercice), rendu écrit par l'étudiant (`/etudiant/devoirs`), validation ou reprise obligatoirement commentée ; export CSV du rapport de classe (présence, devoirs, résultats) ; notifications « devoir à réaliser », rappel 24 h avant l'échéance et devoir corrigé ; tableau de bord enseignant avec présence 30 j et devoirs non terminés
- [x] **§16.1 — Tableau de bord étudiant complété** : dernier taux de réussite en simulation, moyenne et progression depuis la première (en % de bonnes réponses, comparable entre barèmes), entretiens réalisés avec score et cohérence moyens, documents vérifiés / manquants / à corriger, prochaines échéances (séances des 14 prochains jours, expirations de documents)
- [x] **§15 — Notifications de calendrier et de rythme** : séance programmée ou déplacée (étudiants actifs de la classe, email), rappel dans les 24 h avant une séance, simulation recommandée au plus une fois par semaine (in-app, sans email) ; aucun doublon. Non couverts : « devoir à réaliser » (attend les devoirs du §13) et « message de l'enseignant » (à valider : le commentaire enseignant est privé, EF-53)
- [x] **ENF-09 / ENF-11 — Conservation limitée des données** (`/admin/conservation`) : durées par catégorie (entretiens, données des comptes étudiants suspendus, anciennes versions de documents, prospects et coordonnées du test de niveau, notifications et emails traités), **désactivées par défaut** tant que le centre n'a pas validé le cadre applicable ; aperçu du volume concerné, purge quotidienne et manuelle (fichiers retirés du stockage), exécution tracée dans l'audit ; durées affichées aux étudiants sur les pages Entretien et Documents. Jamais purgés : audit, coûts IA, comptes et résultats de tests
- [x] **V1.2 — Préparation administrative** : espace documentaire (bucket privé, type réel vérifié, URL signées 60 s, versions et historique), vérification par l'enseignant de la classe ou l'admin, checklist dynamique avec sources officielles et date de vérification (vide tant que le centre n'a pas vérifié), rappels d'expiration, notifications in-app et email (file d'envoi, préférence par utilisateur), CRM avec responsable et historique des interactions

> **IA** : fournisseur choisi par `AI_PROVIDER` (`gemini` par défaut, `claude`, `fake`). Le palier gratuit de Gemini interdit l'envoi de données personnelles : développement avec données fictives uniquement, palier payant (`GEMINI_PAID_TIER=true`) exigé en production.
- [x] **Phase 5 — Site vitrine** : accueil, formations (une page par programme), FAQ, galerie, témoignages (publication soumise au consentement), contact et WhatsApp sur toutes les pages, formulaire de contact → prospects (statut, notes, relances). Tout le contenu est administrable (`/admin/site`) : aucune coordonnée, chiffre ou témoignage n'est inventé
- [x] **§14 — Gamification légère** : série de jours actifs, objectif hebdomadaire et badges de progression (première simulation, 80 % dans une section, 7 jours d'activité, 5 entretiens, documents complets), affichés sur le tableau de bord étudiant. Catalogue de badges administrable, dérivés de l'activité existante et persistés à leur premier déblocage. Pas de classement global public (préférence du CDC) — uniquement la progression personnelle

## Démarrage local

Prérequis : Node ≥ 22, pnpm, Docker Desktop **lancé**.

```bash
pnpm install
pnpm db:start
```

`pnpm db:start` démarre Supabase en local, applique les migrations et le seed, puis affiche les URLs et les clés.
Copier `backend/.env.example` → `backend/.env` et `frontend/.env.example` → `frontend/.env`, puis y reporter :
- `API URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
- `anon key` (ou *publishable*) → `VITE_SUPABASE_ANON_KEY` (et `SUPABASE_ANON_KEY` pour le test RLS)
- `service_role key` (ou *secret*) → `SUPABASE_SERVICE_ROLE_KEY` (**backend uniquement**)

Créer le premier admin :

```bash
pnpm --filter @salve/backend bootstrap:admin --email admin@centre.cg --name "Prénom Nom"
```

Lancer frontend (http://localhost:5173) et backend (http://localhost:3001) :

```bash
pnpm dev
```

À la première connexion, l'admin change son mot de passe puis active la MFA (application TOTP).
Les emails locaux (réinitialisations, etc.) sont visibles dans Mailpit : http://127.0.0.1:54324.

## Tests

```bash
pnpm test
```

Test d'intégration RLS (critère d'acceptation Phase 1), Supabase local démarré :

```bash
RLS_TEST=1 pnpm --filter @salve/backend test
```

## Modèle de sécurité (Phase 1)

- **Aucune auto-inscription** : `POST /api/admin/users` (admin + MFA) crée le compte Auth et le profil, renvoie un mot de passe temporaire affiché une seule fois.
- **Rôle lu en base** à chaque requête API, jamais depuis le client ; `requireAuth → requirePasswordChanged → requireRole → requireAdminMfa`.
- **RLS** : étudiant = ses lignes ; enseignant = étudiants de ses classes ; admin = tout, uniquement en session `aal2`. Un compte suspendu n'a plus aucun rôle en base, même avec un JWT encore valide.
- **Écritures sur `profiles` et `audit_logs`** : backend uniquement (révoquées pour `authenticated`).
- **Session** en `sessionStorage` (pas de « se souvenir de moi ») + déconnexion après inactivité. La durée est **administrable** (`/admin/parametres`, EF-05) et lue par le frontend à la connexion ; `VITE_IDLE_TIMEOUT_MINUTES` ne sert plus que de repli avant chargement du réglage serveur.
- Pas de cookie d'auth (jeton en en-tête `Authorization`) → pas de surface CSRF classique.

## Points ouverts (cf. CDC §22)

Nom commercial, barèmes TOLC exacts, cadre légal des données personnelles (contexte congolais), licence de dénomination TOLC/CISIA, canaux de notification additionnels (WhatsApp/SMS), etc. La **durée d'inactivité** (§22 #5) est désormais administrable (`/admin/parametres`), défaut 30 min.
