import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { env } from '../config/env.js';

// SDK Admin : contourne les règles de sécurité. Réservé au backend, seul point d'accès aux
// données (les règles Firestore/Storage refusent tout accès client, cf. firestore.rules).
function credential() {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return undefined; // émulateurs ou identifiants par défaut (ADC)
  const raw = env.FIREBASE_SERVICE_ACCOUNT.trim();
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return cert(JSON.parse(json) as Record<string, string>);
}

function createApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const serviceAccount = credential();
  return initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    storageBucket: env.FIREBASE_STORAGE_BUCKET ?? `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    ...(serviceAccount ? { credential: serviceAccount } : {}),
  });
}

export const firebaseApp = createApp();

export const firestore = getFirestore(firebaseApp);
// Les colonnes absentes d'une écriture ne doivent pas faire échouer l'appel.
firestore.settings({ ignoreUndefinedProperties: true });

export const firebaseAuth = getAuth(firebaseApp);
export const storageBucket = () => getStorage(firebaseApp).bucket();

export const usingEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
