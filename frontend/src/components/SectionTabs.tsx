import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import type { AppRole } from '../lib/types';

// Onglets entre pages sœurs d'une même entrée de navigation (ex. « Cours et exercices »).
export function SectionTabs({ tabs, label }: { tabs: { to: string; label: string; roles?: AppRole[] }[]; label: string }) {
  const { me } = useAuth();
  const visible = tabs.filter((tab) => !tab.roles || (me && tab.roles.includes(me.role)));
  if (visible.length < 2) return null;
  return (
    <nav aria-label={label} className="no-scrollbar -mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-[var(--c-border)] px-1">
      {visible.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'border-[var(--c-primary)] text-[var(--c-primary)]' : 'border-transparent text-[var(--c-muted)] hover:text-[var(--c-text)]'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
