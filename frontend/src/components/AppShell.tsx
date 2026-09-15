import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
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

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-verde/10 text-verde-dark' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
  }`;

export function AppShell() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!me) return null;

  const nav = NAV[me.role];
  const home = nav[0]?.to ?? '/';

  const navLinks = (
    <nav aria-label="Navigation" className="flex flex-col gap-1">
      {nav.map((item) => (
        <NavLink key={item.to} to={item.to} end onClick={() => setOpen(false)} className={linkClass}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-panna lg:flex">
      {/* Sidebar verticale — desktop */}
      <aside className="hidden border-r border-sand bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex h-16 items-center border-b border-sand px-5">
          <Link to={home} aria-label="Accueil" className="text-notte">
            <Logo />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{navLinks}</div>
        <div className="border-t border-sand p-3">
          <p className="mb-2 px-2 text-xs text-stone-600">
            {me.fullName}
            <br />
            <span className="font-medium text-notte">{ROLE_LABELS[me.role]}</span>
          </p>
          <button className="btn-secondary w-full" onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Barre supérieure — mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-sand bg-white px-4 py-3 lg:hidden">
        <button
          className="btn-secondary"
          aria-expanded={open}
          aria-controls="app-mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Fermer' : 'Menu'}
        </button>
        <Link to={home} aria-label="Accueil" className="text-notte">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <button className="btn-secondary" onClick={() => void signOut()}>
            Sortir
          </button>
        </div>
      </header>
      {open && (
        <div id="app-mobile-nav" className="border-b border-sand bg-white px-3 py-3 lg:hidden">
          {navLinks}
        </div>
      )}

      {/* Contenu principal */}
      <div className="flex-1 lg:pl-64">
        {/* Barre supérieure — desktop */}
        <div className="hidden items-center justify-end gap-3 border-b border-sand bg-white px-6 py-3 lg:flex">
          <NotificationBell />
          <span className="text-sm text-stone-600">
            {me.fullName} · <span className="font-medium text-notte">{ROLE_LABELS[me.role]}</span>
          </span>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
