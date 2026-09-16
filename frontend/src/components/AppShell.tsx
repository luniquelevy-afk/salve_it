import { useEffect, useState } from 'react';
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

type Theme = 'dark' | 'light';

function readTheme(): Theme {
  try {
    return localStorage.getItem('salve-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function AppShell() {
  const { me, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    try {
      localStorage.setItem('salve-theme', theme);
    } catch {
      // stockage indisponible : le thème reste celui de la session en cours.
    }
  }, [theme]);

  if (!me) return null;
  const dark = theme === 'dark';
  const nav = NAV[me.role];
  const home = nav[0]?.to ?? '/';

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? dark
          ? 'bg-[#0E8368]/15 text-[#2DD4BF]'
          : 'bg-verde/10 text-verde-dark'
        : dark
          ? 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
    }`;

  const barClass = dark
    ? 'border-white/[0.08] bg-[#070A0F]/85'
    : 'border-sand bg-white/90';
  const ghostBtn = dark
    ? 'border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'
    : 'border border-sand bg-white text-notte hover:bg-panna-alt';

  return (
    <div
      data-theme={dark ? 'dark' : undefined}
      className={`min-h-screen ${dark ? 'bg-[#070A0F] text-[#F1F5F9]' : 'bg-panna text-stone-800'}`}
    >
      {/* Barre supérieure */}
      <header className={`sticky top-0 z-30 border-b ${barClass} backdrop-blur-xl`}>
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 lg:px-8">
          <button
            className={`inline-flex size-9 items-center justify-center rounded-lg ${ghostBtn}`}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            aria-controls="app-drawer"
            onClick={() => setOpen(true)}
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to={home} aria-label="Accueil" className={dark ? 'text-white' : 'text-notte'}>
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button
              className={`inline-flex size-9 items-center justify-center rounded-lg ${ghostBtn}`}
              aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
              title={dark ? 'Thème clair' : 'Thème sombre'}
              onClick={() => setTheme(dark ? 'light' : 'dark')}
            >
              {dark ? (
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
            <NotificationBell />
            <span className={`hidden sm:inline ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
              {me.fullName} · <span className={`font-medium ${dark ? 'text-white' : 'text-notte'}`}>{ROLE_LABELS[me.role]}</span>
            </span>
            <button className={`btn ${ghostBtn}`} onClick={() => void signOut()}>
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      {/* Menu burger — drawer à gauche */}
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside
            id="app-drawer"
            className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r ${
              dark ? 'border-white/[0.08] bg-[#0D131F]' : 'border-sand bg-white'
            }`}
          >
            <div className={`flex h-16 items-center justify-between border-b px-5 ${dark ? 'border-white/[0.08]' : 'border-sand'}`}>
              <Link to={home} onClick={() => setOpen(false)} className={dark ? 'text-white' : 'text-notte'}>
                <Logo />
              </Link>
              <button
                aria-label="Fermer"
                className={`inline-flex size-8 items-center justify-center rounded-lg ${ghostBtn}`}
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav aria-label="Navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {nav.map((item) => (
                <NavLink key={item.to} to={item.to} end onClick={() => setOpen(false)} className={linkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className={`border-t p-3 ${dark ? 'border-white/[0.08]' : 'border-sand'}`}>
              <p className={`mb-2 px-2 text-xs ${dark ? 'text-slate-400' : 'text-stone-600'}`}>
                {me.fullName}
                <br />
                <span className={`font-medium ${dark ? 'text-white' : 'text-notte'}`}>{ROLE_LABELS[me.role]}</span>
              </p>
              <button className={`btn w-full ${ghostBtn}`} onClick={() => void signOut()}>
                Se déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
