// Migrations Firestore versionnées. Firestore n'ayant pas de schéma, une migration pose des
// données de référence ou une configuration ; le schéma lui-même vit dans lib/db/schema.ts.
// Chaque migration est idempotente et enregistrée dans la collection technique `_migrations`
// une fois appliquée. Ne jamais modifier une migration publiée : en ajouter une nouvelle.
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/db/index.js';
import { firebaseAuth, firestore, usingEmulators } from '../lib/firebase.js';
import { BADGES, CHECKLIST_REQUIREMENTS, DOCUMENT_TYPES, EMBASSY_SCENARIOS } from './reference-data.js';

export interface Migration {
  id: string;
  description: string;
  up(log: (message: string) => void): Promise<void>;
}

const REGISTRY = '_migrations';

async function insertMissing(table: string, rows: Record<string, unknown>[], onConflict: string) {
  const { error } = await db.from(table).upsert(rows, { onConflict, ignoreDuplicates: true });
  if (error) throw error;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '0001_reference_data',
    description: 'Réglages (site, IA, conservation, session), types de documents, checklist visa, scénarios d’entretien, badges',
    async up(log) {
      // Lignes uniques de réglages (ex-tables à clé booléenne `id = true`).
      await insertMissing('site_settings', [{ id: true }], 'id');
      await insertMissing('ai_settings', [{ id: true }], 'id');
      await insertMissing('retention_settings', [{ id: true }], 'id');
      await insertMissing('session_settings', [{ id: true, idle_timeout_minutes: 30 }], 'id');
      await insertMissing('document_types', DOCUMENT_TYPES, 'code');
      await insertMissing('checklist_requirements', CHECKLIST_REQUIREMENTS, 'code');
      await insertMissing('embassy_scenarios', EMBASSY_SCENARIOS, 'code');
      await insertMissing('badges', BADGES, 'code');
      log(`${DOCUMENT_TYPES.length} types de documents, ${CHECKLIST_REQUIREMENTS.length} exigences, ${EMBASSY_SCENARIOS.length} scénarios, ${BADGES.length} badges`);
    },
  },
  {
    id: '0002_enable_totp_mfa',
    description: 'Active la MFA par application TOTP (obligatoire pour les admins, checklist sécurité)',
    async up(log) {
      if (usingEmulators) {
        log('émulateur : configuration MFA ignorée (non prise en charge par l’émulateur Auth)');
        return;
      }
      // Exige Firebase Authentication with Identity Platform (console Firebase → Authentication → Paramètres).
      await firebaseAuth.projectConfigManager().updateProjectConfig({
        multiFactorConfig: { state: 'ENABLED', providerConfigs: [{ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }] },
      });
      log('MFA TOTP activée sur le projet');
    },
  },
];

export async function appliedMigrations(): Promise<Set<string>> {
  const snapshot = await firestore.collection(REGISTRY).get();
  return new Set(snapshot.docs.map((doc) => doc.id));
}

export async function runMigrations(log: (message: string) => void = console.log): Promise<string[]> {
  const applied = await appliedMigrations();
  const ran: string[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    log(`→ ${migration.id} : ${migration.description}`);
    await migration.up((message) => log(`  ${message}`));
    await firestore.collection(REGISTRY).doc(migration.id).set({ description: migration.description, applied_at: FieldValue.serverTimestamp() });
    ran.push(migration.id);
  }
  return ran;
}
