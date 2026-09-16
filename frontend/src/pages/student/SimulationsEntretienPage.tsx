import { Icon } from '../public/landing-icon';

// Design fourni « Simulations & Entretien IA » (contenu de démonstration), coquille sombre.
export function SimulationsEntretienPage() {
  return (
    <div className="cours space-y-8">
      {/* Titre de page */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">Simulations &amp; Entretien IA</h1>
            <Icon name="twemoji:flag-congo-brazzaville" size={16} />
            <Icon name="twemoji:flag-italy" size={16} />
          </div>
          <p className="text-xs text-slate-400">Épreuves TOLC en conditions réelles &amp; Entraînement Consulat</p>
        </div>
        <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3 py-1 text-xs font-semibold text-[#2DD4BF]">4 simulations restantes</span>
      </div>

      {/* Hero entretien IA */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#0D131F] via-[#0F1726] to-[#070A0F] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute top-0 right-0 size-80 bg-[#0E8368]/10 blur-3xl" />
        <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-3 py-1 text-xs font-bold text-[#2DD4BF]">
              <span className="size-2 animate-ping rounded-full bg-[#2DD4BF]" />
              <span>Simulateur d&rsquo;Entretien Consulaire IA Actif</span>
            </div>
            <h2 className="font-heading text-2xl font-extrabold text-white sm:text-3xl">Prêt pour votre simulation orale consulaire ?</h2>
            <p className="max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
              L&rsquo;agent IA teste votre motivation, votre niveau d&rsquo;italien et la cohérence de vos études entre Brazzaville et l&rsquo;université italienne de votre choix.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button className="inline-flex items-center gap-2 rounded-2xl bg-[#E2583E] px-6 py-3 text-xs font-bold text-white shadow-lg transition-all hover:bg-[#c9452d] sm:text-sm">
                <Icon name="solar:microphone-3-bold" size={16} /><span>Lancer l&rsquo;entretien vocal (15 min)</span>
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.04] px-5 py-3 text-xs font-semibold text-white transition-all hover:bg-white/[0.08] sm:text-sm">
                <span>Mode écrit uniquement</span>
              </button>
            </div>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-black/40 p-4 lg:col-span-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Dernier rapport d&rsquo;entretien</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Score de cohérence :</span><span className="font-bold text-emerald-400">82 %</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Aisance linguistique :</span><span className="font-bold text-amber-300">B1 intermédiaire</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Gestion du stress :</span><span className="font-bold text-[#2DD4BF]">Très bonne</span></div>
            </div>
            <p className="border-t border-white/[0.06] pt-1 text-[10px] italic text-slate-400">« Bon argumentaire sur Turin, citez davantage votre projet de master. »</p>
          </div>
        </div>
      </div>

      {/* Examens blancs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-white">Examens Blancs CISIA TOLC (Chronométrés)</h2>
          <span className="text-xs text-[#2DD4BF]">Conditions officielles</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 transition-all hover:border-[#0E8368]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#0E8368] px-2.5 py-1 text-xs font-bold text-white">TOLC-E Blanc #4</span>
                <span className="text-xs text-slate-400">Économie &amp; Gestion</span>
              </div>
              <span className="text-xs font-semibold text-[#2DD4BF]">90 min · 36 QCM</span>
            </div>
            <p className="text-xs text-slate-300">Comprend : Logique (13 q), Compréhension verbale (10 q) et Mathématiques (13 q) avec barème officiel (+1 bonne réponse, -0.25 mauvaise).</p>
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-xs text-slate-400">Meilleur score : <strong className="text-white">28.5 / 36 pts</strong></span>
              <button className="rounded-xl bg-[#0E8368] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0E8368]/80">Démarrer le test blanc</button>
            </div>
          </div>
          <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 transition-all hover:border-[#0E8368]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-[#38BDF8] px-2.5 py-1 text-xs font-bold text-[#070A0F]">TOLC-I Blanc #2</span>
                <span className="text-xs text-slate-400">Ingénierie &amp; Sciences</span>
              </div>
              <span className="text-xs font-semibold text-[#2DD4BF]">110 min · 50 QCM</span>
            </div>
            <p className="text-xs text-slate-300">Comprend : Mathématiques (20 q), Logique (10 q), Sciences (10 q) et Compréhension verbale (10 q).</p>
            <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
              <span className="text-xs text-slate-400">Statut : <strong className="text-amber-300">Non tenté</strong></span>
              <button className="rounded-xl bg-white/[0.06] px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-[#0E8368] hover:text-white">Commencer l&rsquo;épreuve</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
