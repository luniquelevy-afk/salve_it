import type { AppRole } from '../lib/types';

// Groupes d'onglets partagés entre les pages concernées.
export const CONTENT_TABS = [
  { to: '/gestion/cours', label: 'Cours' },
  { to: '/gestion/exercices', label: 'Exercices' },
];
export const TEST_TABS = [
  { to: '/banque-questions', label: 'Banque de questions' },
  { to: '/admin/modeles-de-test', label: 'Modèles de test', roles: ['admin'] as AppRole[] },
];
export const STUDENT_LEARNING_TABS = [
  { to: '/etudiant/cours', label: 'Cours' },
  { to: '/etudiant/exercices', label: 'Exercices' },
  { to: '/etudiant/devoirs', label: 'Devoirs' },
];
