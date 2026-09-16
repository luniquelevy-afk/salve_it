import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

// Page 404 personnalisée, dans le thème sombre du site.
export function NotFoundPage() {
  return (
    <main data-theme="dark" className="cours relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070A0F] px-4 text-center text-[#F1F5F9]">
      {/* Décor */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#0E8368]/20 via-[#0E8368]/5 to-transparent blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_55%_45%_at_50%_10%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <Link to="/" aria-label="Accueil" className="text-white">
          <Logo className="text-lg" />
        </Link>

        <p className="bg-gradient-to-r from-[#0E8368] to-[#2DD4BF] bg-clip-text font-heading text-7xl font-extrabold tracking-tight text-transparent sm:text-8xl">
          404
        </p>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">Page introuvable</h1>
          <p className="mx-auto max-w-md text-sm text-slate-400">
            Cette page n&rsquo;existe pas ou a été déplacée. Vérifiez l&rsquo;adresse, ou revenez à l&rsquo;accueil.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center rounded-2xl bg-[#E2583E] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c9452d]">
            Retour à l&rsquo;accueil
          </Link>
          <Link to="/connexion" className="inline-flex items-center rounded-2xl border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]">
            Se connecter
          </Link>
        </div>
      </div>
    </main>
  );
}
