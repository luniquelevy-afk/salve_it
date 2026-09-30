import { defineConfig } from 'vitest/config';

// Tests d'intégration contre les émulateurs Firebase : `pnpm test:integration` (racine) les démarre
// via `firebase emulators:exec`, qui fournit aussi FIRESTORE_EMULATOR_HOST & co.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      FIREBASE_PROJECT_ID: 'demo-salve-italia',
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080',
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099',
      FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199',
      AI_PROVIDER: 'fake',
      REQUIRE_ADMIN_MFA: 'false',
    },
  },
});
