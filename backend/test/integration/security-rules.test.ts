// Règles Firestore / Storage : aucun accès client direct, même authentifié (remplace le test RLS).
import { readFileSync } from 'node:fs';
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST as string).split(':');
  const [storageHost, storagePort] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST as string).split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-salve-italia',
    firestore: { rules: readFileSync(new URL('../../../firebase/firestore.rules', import.meta.url), 'utf8'), host: firestoreHost, port: Number(firestorePort) },
    storage: { rules: readFileSync(new URL('../../../firebase/storage.rules', import.meta.url), 'utf8'), host: storageHost, port: Number(storagePort) },
  });
  // Données présentes, écrites hors règles (comme le ferait le backend).
  await env.withSecurityRulesDisabled(async (context) => {
    await context.firestore().doc('profiles/u1').set({ id: 'u1', role: 'student' });
    await context.firestore().doc('site_settings/true').set({ id: true });
  });
});

afterAll(async () => {
  await env?.clearFirestore();
  await env?.clearStorage();
  await env?.cleanup();
});

describe('règles de sécurité', () => {
  const clients = () => [
    ['anonyme', env.unauthenticatedContext()],
    ['étudiant connecté (son propre profil)', env.authenticatedContext('u1')],
    ['admin avec MFA', env.authenticatedContext('admin', { firebase: { sign_in_second_factor: 'totp' } })],
  ] as const;

  it('refuse toute lecture et écriture Firestore côté client', async () => {
    for (const [, context] of clients()) {
      const firestore = context.firestore();
      await assertFails(firestore.doc('profiles/u1').get());
      await assertFails(firestore.collection('profiles').get());
      await assertFails(firestore.doc('site_settings/true').get());
      await assertFails(firestore.doc('profiles/u1').update({ role: 'admin' }));
      await assertFails(firestore.collection('audit_logs').add({ action: 'x' }));
      await assertFails(firestore.doc('_unique/abc').set({ id: 'u1' }));
    }
  });

  it('refuse tout accès direct aux fichiers des documents étudiants', async () => {
    for (const [, context] of clients()) {
      const file = context.storage().ref('student-documents/u1/passeport/fichier.pdf');
      await assertFails(file.getDownloadURL());
      await assertFails(file.putString('contenu'));
    }
  });
});
