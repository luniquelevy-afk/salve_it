// Comptes de démonstration reproductibles (dev/local uniquement).
//
// Contrairement à `bootstrap:admin` (premier admin réel, mot de passe temporaire
// aléatoire à changer), ce script pose des comptes de DÉMO à mots de passe fixes et
// connus, prêts à l'emploi : must_change_password=false, statut actif, MFA non requise.
// Il est idempotent : relançable à volonté, il met à jour les comptes existants.
//
// Usage : pnpm --filter @salve/backend demo:seed
// ⚠️ Refusé si NODE_ENV=production : mots de passe faibles, jamais en prod (ENF/CDC §18).
import { randomUUID } from 'node:crypto';
import { db } from '../lib/db/index.js';
import { firebaseAuth } from '../lib/firebase.js';
import type { AppRole } from '../middleware/auth.js';
import type { CefrLevel } from '../services/accounts.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refus : les comptes de démonstration ne doivent jamais être créés en production.');
  process.exit(1);
}

interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
  level?: CefrLevel;
}

// Un compte par rôle. Même mot de passe pour simplifier la démo.
// ≥ 10 caractères, lettres + chiffres (même politique que passwordSchema, routes/me.ts).
const DEMO_PASSWORD = 'DemoSalve2026';
const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'admin.demo@salve.test', password: DEMO_PASSWORD, fullName: 'Admin Démo', role: 'admin' },
  { email: 'prof.demo@salve.test', password: DEMO_PASSWORD, fullName: 'Professeur Démo', role: 'teacher' },
  { email: 'etudiant.demo@salve.test', password: DEMO_PASSWORD, fullName: 'Étudiant Démo', role: 'student', level: 'A2' },
];

async function findAuthUserId(email: string): Promise<string | null> {
  try {
    return (await firebaseAuth.getUserByEmail(email)).uid;
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return null;
    throw error;
  }
}

async function upsertDemoAccount(account: DemoAccount): Promise<'created' | 'updated'> {
  const email = account.email.trim().toLowerCase();
  const existingId = await findAuthUserId(email);

  let userId: string;
  let outcome: 'created' | 'updated';
  if (existingId) {
    // Réaligne mot de passe et vérification de l'email, et réactive un éventuel compte désactivé.
    await firebaseAuth.updateUser(existingId, { password: account.password, emailVerified: true, disabled: false });
    userId = existingId;
    outcome = 'updated';
  } else {
    userId = (await firebaseAuth.createUser({ uid: randomUUID(), email, password: account.password, emailVerified: true })).uid;
    outcome = 'created';
  }

  // Profil prêt à l'emploi : actif, sans changement de mot de passe forcé.
  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: userId,
      email,
      role: account.role,
      full_name: account.fullName,
      level: account.role === 'student' ? (account.level ?? null) : null,
      status: 'active',
      must_change_password: false,
    },
    { onConflict: 'id' },
  );
  if (profileError) throw profileError;

  return outcome;
}

for (const account of DEMO_ACCOUNTS) {
  const outcome = await upsertDemoAccount(account);
  const verb = outcome === 'created' ? 'créé ' : 'mis à jour';
  console.log(`${verb} · ${account.role.padEnd(7)} · ${account.email}`);
}

console.log(`\nMot de passe commun : ${DEMO_PASSWORD}`);
console.log('Comptes prêts (statut actif, sans changement de mot de passe forcé).');
console.log('Note : le back-office admin exige la MFA (AAL2) tant que REQUIRE_ADMIN_MFA=true.');
