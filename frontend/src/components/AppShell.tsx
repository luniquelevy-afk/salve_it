import { useEffect, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS, type AppRole } from '../lib/types';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  // Chemins supplémentaires qui rendent l'entrée active (pages sœurs, sous-pages).
  also?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Navigation par rôle, regroupée en sections (design de la console interne Alpha Academy).
const NAV: Record<AppRole, NavSection[]> = {
  student: [
    {
      title: 'Mon espace',
      items: [
        { to: '/etudiant', label: 'Tableau de bord', icon: '🏠' },
        { to: '/etudiant/simulations', label: 'Tests', icon: '⏱️' },
        { to: '/etudiant/entretien', label: 'Entretien IA', icon: '🎙️' },
        { to: '/etudiant/cours', label: 'Cours', icon: '📚', also: ['/etudiant/exercices', '/etudiant/devoirs'] },
        { to: '/etudiant/progression', label: 'Progression', icon: '📈' },
        { to: '/etudiant/documents', label: 'Documents', icon: '📄' },
        { to: '/calendrier', label: 'Calendrier', icon: '📅' },
        { to: '/etudiant/profil', label: 'Profil', icon: '👤' },
      ],
    },
  ],
  teacher: [
    {
      title: 'Suivi',
      items: [
        { to: '/enseignant', label: 'Tableau de bord', icon: '🏠', also: ['/suivi/etudiants'] },
        { to: '/classes', label: 'Classes', icon: '👥' },
        { to: '/calendrier', label: 'Calendrier', icon: '📅' },
        { to: '/annonces', label: 'Annonces', icon: '📣' },
      ],
    },
    {
      title: 'Contenus',
      items: [
        { to: '/gestion/cours', label: 'Cours et exercices', icon: '📚', also: ['/gestion/exercices'] },
        { to: '/vue-etudiant/cours', label: 'Vue étudiant', icon: '👁️', also: ['/vue-etudiant'] },
        { to: '/banque-questions', label: 'Tests et questions', icon: '❓' },
      ],
    },
  ],
  admin: [
    {
      title: 'Pilotage',
      items: [
        { to: '/admin/tableau-de-bord', label: 'Tableau de bord', icon: '🏠' },
        { to: '/admin/statistiques', label: 'Statistiques', icon: '📈' },
      ],
    },
    {
      title: 'Personnes',
      items: [
        { to: '/admin/comptes?role=student', label: 'Étudiants', icon: '🎓', also: ['/suivi/etudiants'] },
        { to: '/admin/comptes?role=teacher', label: 'Enseignants', icon: '🧑‍🏫' },
        { to: '/admin/prospects', label: 'Prospects', icon: '📥' },
      ],
    },
    {
      title: 'Pédagogie',
      items: [
        { to: '/classes#programmes', label: 'Programmes', icon: '📘' },
        { to: '/classes', label: 'Classes', icon: '👥' },
        { to: '/banque-questions', label: 'Tests et questions', icon: '❓', also: ['/admin/modeles-de-test'] },
        { to: '/gestion/cours', label: 'Cours et exercices', icon: '📚', also: ['/gestion/exercices'] },
        { to: '/vue-etudiant/cours', label: 'Vue étudiant', icon: '👁️', also: ['/vue-etudiant'] },
        { to: '/admin/documents', label: 'Documents', icon: '📄' },
        { to: '/annonces', label: 'Annonces', icon: '📣' },
      ],
    },
    {
      title: 'Paramètres',
      items: [
        { to: '/admin/parametres', label: 'Paramètres', icon: '⚙️' },
        { to: '/admin/ia', label: 'Agent IA', icon: '🤖' },
        { to: '/admin/checklist', label: 'Checklist visa', icon: '🛂' },
        { to: '/admin/site', label: 'Site public', icon: '🌐' },
        { to: '/admin/conservation', label: 'Conservation des données', icon: '🗄️' },
      ],
    },
  ],
};

// Barre inférieure mobile de l'espace étudiant.
const STUDENT_TABS: NavItem[] = [
  { to: '/etudiant', label: 'Accueil', icon: '🏠' },
  { to: '/etudiant/simulations', label: 'Tests', icon: '⏱️' },
  { to: '/etudiant/entretien', label: 'Entretien', icon: '🎙️' },
  { to: '/etudiant/cours', label: 'Cours', icon: '📚', also: ['/etudiant/exercices', '/etudiant/devoirs'] },
  { to: '/etudiant/profil', label: 'Profil', icon: '👤' },
];

const SPACE_LABELS: Record<AppRole, string> = { student: 'Espace étudiant', teacher: 'Espace enseignant', admin: 'Console admin' };

// Entrée active : même chemin (et même paramètre ou ancre s'il y en a), sous-page ou page sœur.
function isActive(item: NavItem, location: { pathname: string; search: string; hash: string }, home: string): boolean {
  const url = new URL(item.to, 'http://local');
  const samePath = location.pathname === url.pathname || (url.pathname !== home && location.pathname.startsWith(`${url.pathname}/`));
  if (samePath) {
    if (url.hash) return location.hash === url.hash;
    if (location.hash === '#programmes' && url.pathname === '/classes') return false;
    const current = new URLSearchParams(location.search);
    return [...url.searchParams].every(([key, value]) => current.get(key) === value);
  }
  return (item.also ?? []).some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
}

type Theme = 'dark' | 'light';

function readTheme(): Theme {
  try {
    return localStorage.getItem('salve-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AppShell() {
  const { me, signOut } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    try {
      localStorage.setItem('salve-theme', theme);
    } catch {
      // stockage indisponible : le thème reste celui de la session en cours.
    }
  }, [theme]);

  // Le tiroir mobile se referme à chaque changement de page.
  useEffect(() => setOpen(false), [location.pathname, location.search, location.hash]);

  if (!me) return null;
  const sections = NAV[me.role];
  const home = sections[0]?.items[0]?.to ?? '/';
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const student = me.role === 'student';

  const sidebar = (
    <Sidebar
      home={home}
      space={SPACE_LABELS[me.role]}
      footer={
        <>
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--c-primary-soft)] text-xs font-bold text-[var(--c-primary)]"
            >
              {initials(me.fullName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{me.fullName}</p>
              <p className="text-[11px] text-[var(--c-faint)]">{ROLE_LABELS[me.role]}</p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg border border-[var(--c-border)] px-3 text-xs font-medium text-[var(--c-danger)] transition hover:bg-[var(--c-danger-soft)]"
          >
            Se déconnecter
          </button>
        </>
      }
    >
      {sections.map((section) => (
        <div key={section.title}>
          {sections.length > 1 && <p className="px-3 pb-1 pt-5 text-[10px] font-semibold tracking-wider text-[var(--c-faint)] uppercase">{section.title}</p>}
          {sections.length === 1 && <div className="h-3" />}
          {section.items.map((item) => {
            const active = isActive(item, location, home);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  active ? 'bg-[var(--c-primary-soft)] text-[var(--c-primary)]' : 'text-[var(--c-muted)] hover:bg-[var(--c-subtle)] hover:text-[var(--c-text)]'
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </Sidebar>
  );

  return (
    <div data-theme={theme} className="app-shell flex min-h-dvh">
      {/* Barre latérale fixe (bureau) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--c-border)] bg-[var(--c-elev)] lg:flex">{sidebar}</aside>

      {/* Tiroir (mobile / tablette) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-black/55" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-[var(--c-border)] bg-[var(--c-elev)]">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-bg)]/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="inline-flex size-10 items-center justify-center rounded-lg border border-[var(--c-border)] lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold lg:hidden">{SPACE_LABELS[me.role]}</span>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main className={`mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 lg:px-8 ${student ? 'pb-24 lg:pb-6' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Barre inférieure (mobile, espace étudiant) */}
      {student && (
        <nav aria-label="Navigation rapide" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--c-border)] bg-[var(--c-elev)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {STUDENT_TABS.map((item) => {
            const active = isActive(item, location, home);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-[var(--c-primary)]' : 'text-[var(--c-muted)]'}`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function Sidebar({ home, space, children, footer }: { home: string; space: string; children: ReactNode; footer: ReactNode }) {
  return (
    <>
      <Link to={home} className="flex items-center gap-2.5 border-b border-[var(--c-border)] px-4 py-3.5">
        <Logo />
        <span className="sr-only">{space}</span>
      </Link>
      <p className="px-4 pt-3 text-[11px] font-medium text-[var(--c-faint)]">{space}</p>
      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-2 pb-4">
        {children}
      </nav>
      <div className="border-t border-[var(--c-border)] p-3">{footer}</div>
    </>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--c-border)] text-[var(--c-muted)] transition hover:bg-[var(--c-subtle)] hover:text-[var(--c-text)]"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
