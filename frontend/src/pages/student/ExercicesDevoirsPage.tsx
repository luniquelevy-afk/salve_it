import { Icon } from '../public/landing-icon';

// Design fourni « Exercices & Devoirs » (contenu de démonstration), dans la coquille sombre.
export function ExercicesDevoirsPage() {
  return (
    <div className="cours space-y-8">
      {/* Titre de page */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">Exercices &amp; Devoirs</h1>
            <Icon name="twemoji:flag-congo-brazzaville" size={16} />
            <Icon name="twemoji:flag-italy" size={16} />
          </div>
          <p className="text-xs text-slate-400">Banque d&rsquo;entraînement CISIA &amp; Devoirs assignés</p>
        </div>
        <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/15 px-3 py-1 text-xs font-semibold text-[#2DD4BF]">Score moyen : 74 %</span>
      </div>

      {/* Onglets */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-white/[0.08] pb-3">
        <button className="shrink-0 rounded-xl bg-[#0E8368] px-4 py-2 text-xs font-bold text-white">Tous les exercices (48)</button>
        <button className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 hover:text-white">Devoirs à rendre (2)</button>
        <button className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 hover:text-white">Exercices corrigés (32)</button>
        <button className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 hover:text-white">Points faibles ciblés</button>
      </div>

      {/* Devoir prioritaire */}
      <div className="rounded-3xl border border-[#E2583E]/30 bg-gradient-to-r from-[#E2583E]/10 via-[#0D131F] to-[#0D131F] p-5 shadow-lg sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#E2583E] text-white shadow-md">
              <Icon name="solar:bell-bing-bold" size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#E2583E]/20 px-2 py-0.5 text-[10px] font-bold text-[#E2583E]">À rendre avant Vendredi 18:00</span>
                <span className="text-[11px] text-slate-400">Prof. Marco Rossi (Brazzaville)</span>
              </div>
              <h2 className="mt-1 font-heading text-base font-bold text-white">Devoir #4 : Dissertation d&rsquo;analyse textuelle en italien</h2>
              <p className="text-xs text-slate-300">Rédigez un résumé de 250 mots sur le passage fourni et justifiez votre avis.</p>
            </div>
          </div>
          <button className="shrink-0 rounded-xl bg-[#E2583E] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#c9452d]">Déposer mon devoir</button>
        </div>
      </div>

      {/* Exercices par compétence */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-white">Exercices par Compétence CISIA</h2>
          <span className="text-xs text-[#2DD4BF]">Filtrer par type</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { badge: 'Logique TOLC', badgeCls: 'bg-[#0E8368]/20 text-[#2DD4BF]', meta: '15 questions · 20 min', title: 'Syllogismes & Déductions complexes', desc: 'Identifiez la conclusion nécessaire à partir de prémisses formelles.', status: 'Dernier score : 85 %', statusCls: 'text-emerald-400', btn: 'Recommencer', btnCls: 'bg-white/[0.05] text-slate-200 hover:bg-[#0E8368] hover:text-white' },
            { badge: 'Italien B1', badgeCls: 'bg-[#38BDF8]/20 text-[#38BDF8]', meta: '20 questions · 15 min', title: 'Conjonctions & Subjonctif présent', desc: 'Complétez les phrases académiques avec la concordance des temps exacte.', status: 'À faire · Niveau moyen', statusCls: 'text-amber-300', btn: 'Démarrer', btnCls: 'bg-[#0E8368] text-white hover:bg-[#0E8368]/80' },
            { badge: 'Maths TOLC-E', badgeCls: 'bg-[#A855F7]/20 text-[#A855F7]', meta: '12 questions · 25 min', title: 'Probabilités & Statistiques descriptives', desc: 'Calculs de combinaisons, espérances et graphiques de distribution.', status: 'Score à renforcer (55%)', statusCls: 'text-[#E2583E]', btn: "S'entraîner", btnCls: 'bg-[#0E8368] text-white hover:bg-[#0E8368]/80' },
          ].map((ex) => (
            <div key={ex.title} className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#0E8368]">
              <div className="flex items-center justify-between">
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${ex.badgeCls}`}>{ex.badge}</span>
                <span className="text-[11px] text-slate-400">{ex.meta}</span>
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-white">{ex.title}</h3>
                <p className="mt-1 text-xs text-slate-400">{ex.desc}</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-xs">
                <span className={`font-medium ${ex.statusCls}`}>{ex.status}</span>
                <button className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${ex.btnCls}`}>{ex.btn}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Devoirs corrigés */}
      <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6">
        <h2 className="font-heading text-base font-bold text-white">Derniers devoirs corrigés par les enseignants</h2>
        <div className="space-y-3">
          {[
            { grade: 'A', title: 'Devoir #3 : Test blanc de Compréhension écrite', sub: 'Corrigé par Enseignant Brazzaville · Note : 18/20' },
            { grade: 'B+', title: "Devoir #2 : Vocabulaire de l'enseignement supérieur italien", sub: 'Corrigé il y a 5 jours · Note : 15/20' },
          ].map((d) => (
            <div key={d.title} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-xs font-bold text-emerald-400">{d.grade}</div>
                <div>
                  <p className="text-xs font-bold text-white">{d.title}</p>
                  <p className="text-[10px] text-slate-400">{d.sub}</p>
                </div>
              </div>
              <button className="shrink-0 text-xs font-semibold text-[#2DD4BF] hover:underline">Voir correction →</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
