import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// En développement, on échoue immédiatement si la configuration manque (erreur de setup).
// En production, on n'empêche pas l'affichage du site public : seules les fonctionnalités
// authentifiées échoueront, à l'usage, tant que la configuration n'est pas fournie.
if (import.meta.env.DEV && (!config.apiKey || !config.projectId)) {
  throw new Error('VITE_FIREBASE_API_KEY et VITE_FIREBASE_PROJECT_ID sont requis (voir frontend/.env.example).');
}

// Firebase n'est utilisé que pour l'authentification : aucune donnée ni clé IA côté frontend
// (CDC §17.2), et pas d'Analytics (aucun traceur sans consentement).
const app = initializeApp({ ...config, apiKey: config.apiKey ?? 'unconfigured', projectId: config.projectId ?? 'unconfigured' });

// sessionStorage : la session ne survit pas à la fermeture de l'onglet — pas de
// « se souvenir de moi » par défaut sur des postes potentiellement partagés.
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });
auth.languageCode = 'fr';

const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });

// Codes d'erreur Firebase Auth → messages affichés.
export function authErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
}
