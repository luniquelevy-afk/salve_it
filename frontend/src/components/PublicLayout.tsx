import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { whatsappLink, type PublicSiteContext } from '../lib/public-site';
import type { PublicSite, SiteSettings } from '../lib/types';
import { Logo } from './Logo';

// EF-34 : coordonnées visibles sur toutes les pages publiques.
export function ContactDetails({ settings, className = '' }: { settings: SiteSettings; className?: string }) {
  const items = [
    settings.whatsapp && { label: 'WhatsApp', value: settings.whatsapp, href: whatsappLink(settings.whatsapp), external: true },
    settings.phone && { label: 'Téléphone', value: settings.phone, href: `tel:${settings.phone.replace(/[^\d+]/g, '')}` },
    settings.email && { label: 'Email', value: settings.email, href: `mailto:${settings.email}` },
    settings.address && { label: 'Adresse', value: settings.address, href: settings.mapUrl ?? undefined, external: true },
    settings.openingHours && { label: 'Horaires', value: settings.openingHours },
  ].filter(Boolean) as { label: string; value: string; href?: string; external?: boolean }[];

  if (items.length === 0) return null;

  return (
    <dl className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-semibold uppercase tracking-wider opacity-60">{item.label}</dt>
          <dd>
            {item.href ? (
              <a href={item.href} className="hover:underline" {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                {item.value}
              </a>
            ) : (
              <span className="whitespace-pre-line">{item.value}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PublicLayout() {
  const [site, setSite] = useState<PublicSite | null>(null);
  const [failed, setFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api<PublicSite>('/api/public/site')
      .then(setSite)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const settings = site?.settings;
  const name = settings?.centreName ?? 'Salve Italia';
  const nav = [
    { to: '/formations', label: 'Formations' },
    { to: '/test-de-niveau', label: 'Test de niveau' },
    { to: '/faq', label: 'FAQ' },
    ...(site && site.gallery.length > 0 ? [{ to: '/galerie', label: 'Galerie' }] : []),
    { to: '/contact', label: 'Contact' },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
      isActive ? 'text-[#2DD4BF]' : 'text-slate-300 hover:text-white'
    }`;

  return (
    <div data-theme="dark" className="flex min-h-screen flex-col bg-[#070A0F] text-[#F1F5F9]">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#070A0F]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" aria-label={`${name} — accueil`} className="text-white">
            <Logo className="text-lg" name={name} />
          </Link>
          <nav aria-label="Navigation principale" className="ml-auto hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/connexion"
              className="ml-2 inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-bold text-[#070A0F] transition-all duration-300 hover:bg-[#0E8368] hover:text-white"
            >
              Se connecter
            </Link>
            <Link to="/test-de-niveau" className="ml-1 inline-flex items-center rounded-full bg-[#E2583E] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#c9452d]">
              Évaluer mon niveau
            </Link>
          </nav>
          <button
            className="btn-secondary ml-auto lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Fermer' : 'Menu'}
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-menu" aria-label="Navigation mobile" className="flex flex-col gap-1 border-t border-white/[0.08] px-4 py-3 lg:hidden">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
            <Link to="/connexion" className="mt-1 inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-bold text-[#070A0F]">
              Se connecter
            </Link>
            <Link to="/test-de-niveau" className="mt-1 inline-flex items-center justify-center rounded-full bg-[#E2583E] px-4 py-2 text-sm font-bold text-white">
              Évaluer mon niveau
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet context={{ site, failed } satisfies PublicSiteContext} />
      </main>

      <footer className="border-t border-white/[0.08] bg-[#070A0F] text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div className="space-y-2">
            <Logo className="text-lg text-white" name={name} />
            {settings?.tagline && <p className="text-sm text-stone-400">{settings.tagline}</p>}
            <div className="flex gap-3 text-sm">
              {settings?.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Facebook
                </a>
              )}
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  Instagram
                </a>
              )}
            </div>
          </div>
          <nav aria-label="Liens du pied de page" className="flex flex-col gap-1 text-sm">
            {nav.map((item) => (
              <Link key={item.to} to={item.to} className="hover:underline">
                {item.label}
              </Link>
            ))}
            <Link to="/connexion" className="hover:underline">
              Espace membre
            </Link>
          </nav>
          {settings && <ContactDetails settings={settings} className="text-sm" />}
        </div>
        <p className="border-t border-white/[0.08] px-4 py-4 text-center text-xs text-slate-500">
          Simulations de type TOLC — plateforme indépendante, non affiliée au CISIA. Les informations sur les visas doivent être vérifiées auprès de l’ambassade d’Italie.
        </p>
      </footer>

      {settings?.whatsapp && (
        <a
          href={whatsappLink(settings.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed right-4 bottom-4 z-30 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:brightness-95"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}
