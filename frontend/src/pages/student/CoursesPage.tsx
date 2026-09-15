import { Icon } from '../public/landing-icon';

// Reproduction fidèle du design fourni (dashboard-cours.html), rendue dans la coquille
// interne (sidebar). Contenu de démonstration repris tel quel du maquettage.
export function CoursesPage() {
  return (
    <div className="cours relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#070A0F] p-5 text-[#F1F5F9] sm:p-8">
      {/* Décor */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-[10%] right-[10%] h-[500px] w-[700px] rounded-full bg-gradient-to-b from-[#0E8368]/20 via-[#0E8368]/5 to-transparent blur-[140px]" />
        <div className="absolute -bottom-[10%] -left-[10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-[#2DD4BF]/10 to-transparent blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 space-y-10">
        {/* Hero : module en cours + assiduité */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          <div className="relative flex flex-col justify-between space-y-6 overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#0D131F] via-[#0D131F] to-[#070A0F] p-6 shadow-2xl sm:p-8 lg:col-span-8">
            <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-[#0E8368]/20 blur-3xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#0E8368]/40 bg-[#0E8368]/20 px-3 py-1 text-xs font-bold text-[#2DD4BF]">
                  <span className="size-2 animate-ping rounded-full bg-[#2DD4BF]" />En cours · Module 4 sur 8
                </span>
                <span className="text-xs text-slate-400">Dernière session : il y a 2h</span>
              </div>
              <h1 className="font-heading text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
                Italien Académique B1 : Syntaxe, Discours Universitaire &amp; Argumentation
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                Maîtrisez les expressions idiomatiques, la concordance des temps en subjonctif italien
                (<em className="text-[#2DD4BF]">congiuntivo</em>) et la présentation formelle de vos motivations.
              </p>
            </div>
            <div className="relative z-10 flex flex-col items-stretch justify-between gap-4 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center">
              <div className="max-w-xs flex-1 space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-400">Progression du module</span>
                  <span className="font-bold text-[#2DD4BF]">65 %</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0E8368] to-[#2DD4BF]" style={{ width: '65%' }} />
                </div>
              </div>
              <button className="group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#E2583E] px-6 py-3.5 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c9452d] sm:text-sm">
                <Icon name="solar:play-bold" size={16} />
                <span>Reprendre la leçon 4.2</span>
                <Icon name="solar:arrow-right-linear" size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between space-y-5 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 lg:col-span-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assiduité</span>
                <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">🔥 14 Jours</span>
              </div>
              <p className="font-heading text-xl font-bold text-white">Rythme d&rsquo;apprentissage</p>
              <p className="text-xs leading-relaxed text-slate-400">
                Vous avez validé <strong>18 leçons</strong> ce mois-ci. Objectif B2 avant l&rsquo;ouverture des pré-inscriptions Universitaly.
              </p>
            </div>
            <div className="space-y-2 border-t border-white/[0.06] pt-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Activité hebdomadaire</span>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {[
                  { h: 'h-14', c: 'bg-[#0E8368]', d: 'L', dim: false },
                  { h: 'h-10', c: 'bg-[#0E8368]', d: 'M', dim: false },
                  { h: 'h-16', c: 'bg-[#2DD4BF] shadow-[0_0_10px_rgba(45,212,191,0.3)]', d: 'M', hi: true },
                  { h: 'h-12', c: 'bg-[#0E8368]', d: 'J', dim: false },
                  { h: 'h-8', c: 'bg-[#0E8368]/60', d: 'V', dim: false },
                  { h: 'h-6', c: 'bg-slate-800', d: 'S', dim: true },
                  { h: 'h-4', c: 'bg-slate-800', d: 'D', dim: true },
                ].map((bar, i) => (
                  <div key={i} className="space-y-1">
                    <div className={`${bar.h} w-full rounded-lg ${bar.c}`} />
                    <span className={`text-[9px] ${bar.hi ? 'font-bold text-[#2DD4BF]' : bar.dim ? 'text-slate-500' : 'text-slate-400'}`}>{bar.d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <Icon name="solar:clock-circle-bold" size={16} className="text-[#2DD4BF]" />Temps passé : 14h 30m
              </span>
              <span className="font-semibold text-[#2DD4BF]">+3h vs sem. passée</span>
            </div>
          </div>
        </div>

        {/* Onglets de catégories */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] pb-2 text-xs font-semibold">
          <button className="flex shrink-0 items-center gap-2 rounded-xl bg-[#0E8368] px-4 py-2 text-white shadow-sm">
            <Icon name="solar:book-2-bold" size={16} /><span>Tous mes cours (4)</span>
          </button>
          <button className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2 text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white">
            <Icon name="twemoji:flag-italy" size={14} /><span>Langue Italienne (A1-B2)</span>
          </button>
          <button className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2 text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white">
            <Icon name="solar:target-bold" size={16} className="text-[#2DD4BF]" /><span>CISIA &amp; TOLC-E (Logique &amp; Maths)</span>
          </button>
          <button className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2 text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white">
            <Icon name="solar:magic-stick-3-bold" size={16} className="text-purple-400" /><span>Entretien Consulaire IA</span>
          </button>
          <button className="flex shrink-0 items-center gap-2 rounded-xl bg-white/[0.04] px-4 py-2 text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white">
            <Icon name="solar:video-library-bold" size={16} className="text-[#E2583E]" /><span>Replays Centre Brazzaville</span>
          </button>
        </div>

        {/* Programme de préparation actif */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold text-white sm:text-2xl">Programme de préparation actif</h2>
              <p className="text-xs text-slate-400">Accédez aux modules enregistrés, exercices interactifs et replays.</p>
            </div>
            <span className="cursor-pointer text-xs font-semibold text-[#2DD4BF] hover:underline">Voir les archives →</span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Carte 1 */}
            <div className="group flex flex-col justify-between space-y-5 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#0E8368] hover:shadow-[0_20px_40px_rgba(14,131,104,0.2)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3 py-1 text-[10px] font-bold text-[#2DD4BF]">Italien · 8 Chapitres</span>
                  <span className="text-xs font-medium text-slate-400">65% complété</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-bold text-white transition-colors group-hover:text-[#2DD4BF]">Italien Académique B1</h3>
                  <p className="text-xs leading-relaxed text-slate-400">Syntaxe avancée, lexique universitaire, compréhension de documents administratifs et rédaction formelle.</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0E8368] to-[#2DD4BF]" style={{ width: '65%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><Icon name="solar:videocamera-record-bold" size={16} className="text-[#0E8368]" />12 vidéos · 4 quiz</span>
                <span className="flex items-center gap-1 font-bold text-[#2DD4BF] transition-transform group-hover:translate-x-1">Continuer <Icon name="solar:arrow-right-linear" size={14} /></span>
              </div>
            </div>
            {/* Carte 2 */}
            <div className="group flex flex-col justify-between space-y-5 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#0E8368] hover:shadow-[0_20px_40px_rgba(14,131,104,0.2)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[10px] font-bold text-[#2DD4BF]">CISIA TOLC-E · 12 Séries</span>
                  <span className="text-xs font-medium text-slate-400">78% complété</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-bold text-white transition-colors group-hover:text-[#2DD4BF]">Logique &amp; Compréhension de Texte</h3>
                  <p className="text-xs leading-relaxed text-slate-400">Méthodes de résolution rapide des syllogismes, analyse des pièges de rédaction et gestion du temps chronométré.</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#0E8368] to-[#2DD4BF]" style={{ width: '78%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><Icon name="solar:document-text-bold" size={16} className="text-[#2DD4BF]" />240 questions traitées</span>
                <span className="flex items-center gap-1 font-bold text-[#2DD4BF] transition-transform group-hover:translate-x-1">Pratiquer <Icon name="solar:arrow-right-linear" size={14} /></span>
              </div>
            </div>
            {/* Carte 3 */}
            <div className="group flex flex-col justify-between space-y-5 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#E2583E] hover:shadow-[0_20px_40px_rgba(226,88,62,0.2)]">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-[#E2583E]/40 bg-[#E2583E]/20 px-3 py-1 text-[10px] font-bold text-[#E2583E]">Priorité Révision · 55%</span>
                  <span className="text-xs font-medium text-slate-400">55% complété</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-heading text-lg font-bold text-white transition-colors group-hover:text-[#E2583E]">Mathématiques pour TOLC-E &amp; I</h3>
                  <p className="text-xs leading-relaxed text-slate-400">Fonctions, probabilités, algèbre linéaire et analyse géométrique indispensables pour les filières scientifiques et éco.</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-[#E2583E]" style={{ width: '55%' }} />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><Icon name="solar:calculator-bold" size={16} className="text-[#E2583E]" />8 chapitres de révision</span>
                <span className="flex items-center gap-1 font-bold text-[#E2583E] transition-transform group-hover:translate-x-1">Renforcer <Icon name="solar:arrow-right-linear" size={14} /></span>
              </div>
            </div>
          </div>
        </div>

        {/* Détail du parcours */}
        <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-xl sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
            <div>
              <h3 className="font-heading text-lg font-bold text-white">Détail du parcours : Italien Académique B1</h3>
              <p className="text-xs text-slate-400">Animé par Marco V. &amp; Équipe pédagogique Brazzaville</p>
            </div>
            <button className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.02] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.06]">
              <Icon name="solar:download-minimalistic-bold" size={16} className="text-[#2DD4BF]" /><span>Supports de cours PDF (24 MB)</span>
            </button>
          </div>
          <div className="space-y-3">
            {[
              { n: '1', title: "Chapitre 1 : Le lexique du campus et de l'administration italienne", sub: 'Vocabulaire · Matricola, Appello, CFU, Piano di studi · 45 min', pct: 'Validé · 100%' },
              { n: '2', title: "Chapitre 2 : Argumenter son choix d'université à l'oral", sub: 'Expression Orale · Simulation de réponse consulaire · 50 min', pct: 'Validé · 95%' },
              { n: '3', title: 'Chapitre 3 : Maîtrise des connecteurs logiques formels', sub: 'Grammaire · Tuttavia, pertanto, affinché, benché · 40 min', pct: 'Validé · 88%' },
            ].map((ch) => (
              <div key={ch.n} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.01] p-4 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#0E8368]/40 bg-[#0E8368]/20 text-xs font-bold text-[#2DD4BF]">✓</div>
                  <div>
                    <p className="text-xs font-bold text-white">{ch.title}</p>
                    <p className="text-[11px] text-slate-400">{ch.sub}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-400">{ch.pct}</span>
                  <button className="text-xs text-slate-400 underline hover:text-white">Revoir</button>
                </div>
              </div>
            ))}
            {/* Chapitre 4 — en cours */}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#0E8368]/50 bg-[#0E8368]/10 p-4 shadow-[0_0_20px_rgba(14,131,104,0.15)] sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0E8368] text-xs font-bold text-white shadow">4</div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white">Chapitre 4 : Le subjonctif présent &amp; passé en contexte académique</p>
                    <span className="size-2 animate-ping rounded-full bg-[#2DD4BF]" />
                  </div>
                  <p className="text-[11px] text-slate-300">En cours · Leçon 4.2 : Exercices d&rsquo;application TOLC · 30 min restantes</p>
                </div>
              </div>
              <button className="flex items-center gap-1.5 rounded-xl bg-[#0E8368] px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-[#0c7059]">
                <Icon name="solar:play-bold" size={14} /><span>Continuer</span>
              </button>
            </div>
            {/* Chapitre 5 — verrouillé */}
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-4 opacity-60 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-500">
                  <Icon name="solar:lock-keyhole-bold" size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">Chapitre 5 : Simulation orale d&rsquo;examen blanc B1</p>
                  <p className="text-[11px] text-slate-500">Évaluation finale avec l&rsquo;Agent IA &amp; note certifiée · 60 min</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-500">Débloqué après Chapitre 4</span>
            </div>
          </div>
        </div>

        {/* Quiz flash */}
        <div className="space-y-6 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0D131F] via-[#070A0F] to-[#070A0F] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0E8368] to-[#2DD4BF] text-sm text-white">
                <Icon name="solar:bolt-bold" size={18} />
              </div>
              <div>
                <h4 className="font-heading text-base font-bold text-white">Quiz Flash du jour : TOLC-E Vocabulaire &amp; Logique</h4>
                <p className="text-xs text-slate-400">3 minutes · 5 questions pour maintenir vos réflexes</p>
              </div>
            </div>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1 text-xs font-bold text-[#2DD4BF]">+50 XP</span>
          </div>
          <div className="space-y-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <p className="text-xs font-semibold text-white sm:text-sm">
              « Se tutti gli studenti di economia superano il TOLC-E, e Marco ha superato il TOLC-E, possiamo affermare con certezza che Marco studia economia ? »
            </p>
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              <button className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left text-xs text-slate-300 transition-all hover:border-[#2DD4BF] hover:bg-[#0E8368]/10">A) Sì, sicuramente</button>
              <button className="rounded-xl border border-[#2DD4BF] bg-[#0E8368]/20 p-3.5 text-left text-xs font-semibold text-white shadow-[0_0_15px_rgba(45,212,191,0.2)] transition-all">B) No, non è una deduzione necessaria ✓</button>
              <button className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left text-xs text-slate-300 transition-all hover:border-[#2DD4BF] hover:bg-[#0E8368]/10">C) Solo se Marco è iscritto a Bologna</button>
              <button className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-left text-xs text-slate-300 transition-all hover:border-[#2DD4BF] hover:bg-[#0E8368]/10">D) Non ci sono elementi per rispondere</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
