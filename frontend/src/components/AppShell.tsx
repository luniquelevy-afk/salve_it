import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS, type AppRole } from '../lib/types';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

const NAV: Record<AppRole, { to: string; label: string }[]> = {
  student: [
    { to: '/etudiant', label: 'Tableau de bord' },
    { to: '/etudiant/cours', label: 'Cours' },
    { to: '/etudiant/exercices', label: 'Exercices' },
    { to: '/etudiant/devoirs', label: 'Mes devoirs' },
    { to: '/etudiant/simulations', label: 'Simulations' },
    { to: '/etudiant/entretien', label: 'Entretien consulaire' },
    { to: '/calendrier', label: 'Calendrier' },
    { to: '/etudiant/documents', label: 'Mes documents' },
    { to: '/etudiant/profil', label: 'Mon profil' },
  ],
  teacher: [
    { to: '/enseignant', label: 'Tableau de bord' },
    { to: '/classes', label: 'Classes' },
    { to: '/gestion/cours', label: 'Cours' },
    { to: '/gestion/exercices', label: 'Exercices' },
    { to: '/banque-questions', label: 'Banque de questions' },
    { to: '/calendrier', label: 'Calendrier' },
    { to: '/annonces', label: 'Annonces' },
  ],
  admin: [
    { to: '/admin/tableau-de-bord', label: 'Tableau de bord' },
    { to: '/admin/comptes', label: 'Comptes' },
    { to: '/classes', label: 'Classes' },
    { to: '/gestion/cours', label: 'Cours' },
    { to: '/gestion/exercices', label: 'Exercices' },
    { to: '/banque-questions', label: 'Banque de questions' },
    { to: '/annonces', label: 'Annonces' },
    { to: '/admin/prospects', label: 'Prospects' },
    { to: '/admin/modeles-de-test', label: 'Modèles de test' },
    { to: '/admin/ia', label: 'Agent IA' },
    { to: '/admin/conservation', label: 'Conservation des données' },
    { to: '/admin/checklist', label: 'Checklist visa' },
    { to: '/admin/site', label: 'Site public' },
    { to: '/admin/parametres', label: 'Paramètres' },
  ],
};

export function AppShell() {
  const { me, signOut } = useAuth();
  if (!me) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Logo />
          <nav className="flex gap-1">
            {NAV[me.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-verde/10 text-verde-dark' : 'text-stone-600 hover:bg-stone-100'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NotificationBell />
            <span className="hidden text-stone-600 sm:inline">
              {me.fullName} · <span className="font-medium">{ROLE_LABELS[me.role]}</span>
            </span>
            <button className="btn-secondary" onClick={() => void signOut()}>
              Se déconnecter
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
