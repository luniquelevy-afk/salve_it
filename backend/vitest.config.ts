import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Suites sur émulateurs Firebase : pnpm test:integration (racine).
    exclude: ['test/integration/**'],
    env: {
      NODE_ENV: 'test',
      // Projet « demo-* » : réservé aux émulateurs Firebase, n'atteint jamais un vrai projet.
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ?? 'demo-salve-italia',
      REQUIRE_ADMIN_MFA: 'true',
    },
  },
});
