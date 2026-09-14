import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Fichiers générés / hors périmètre.
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'supabase/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend Node (Express, tests).
  {
    files: ['backend/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Frontend React (navigateur).
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // Règles classiques (correction des bugs de hooks). Le projet n'utilise pas le
      // React Compiler : on n'active pas les règles « recommended-latest » (purity,
      // set-state-in-effect…) qui imposeraient de réécrire le chargement de données.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Le code applicatif s'appuie sur des signatures typées ; un `any` explicite reste
  // signalé, mais on autorise les échappatoires ponctuelles quand elles sont voulues.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
