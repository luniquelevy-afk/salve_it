import { Icon } from '../public/landing-icon';

// Design fourni « Calendrier & Échéances » (contenu de démonstration), coquille sombre.
export function CalendarPage() {
  const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const leading = [27, 28, 29, 30, 31];
  const month = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="cours space-y-8">
      {/* Titre de page */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">Calendrier &amp; Échéances</h1>
            <Icon name="twemoji:flag-congo-brazzaville" size={16} />
            <Icon name="twemoji:flag-italy" size={16} />
          </div>
          <p className="text-xs text-slate-400">Ateliers Brazzaville, Sessions IA &amp; Dates Universitaly</p>
        </div>
        <button className="rounded-full bg-[#0E8368] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#0E8368]/80">+ Prendre RDV Enseignant</button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Séances & échéances */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-white">Prochaines Séances &amp; Échéances Clés</h2>
            <span className="text-xs text-[#2DD4BF]">Février - Mars 2025</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4 rounded-3xl border border-[#0E8368]/30 bg-gradient-to-r from-[#0E8368]/10 to-[#0D131F] p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#0E8368] text-xs font-bold text-white shadow-sm"><span>JEU</span><span className="text-sm">20</span></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#0E8368]/20 px-2 py-0.5 text-[10px] font-bold text-[#2DD4BF]">En présentiel · Brazzaville</span>
                    <span className="text-[11px] text-slate-400">16:00 - 18:00</span>
                  </div>
                  <h3 className="mt-1 font-heading text-sm font-bold text-white">Atelier d&rsquo;Expression Orale Italienne &amp; Entretien</h3>
                  <p className="text-xs text-slate-300">Salle A2 · Centre de langue partenaire Brazzaville</p>
                </div>
              </div>
              <button className="shrink-0 rounded-xl bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.15]">Détails</button>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#38BDF8] text-xs font-bold text-[#070A0F] shadow-sm"><span>SAM</span><span className="text-sm">22</span></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#38BDF8]/20 px-2 py-0.5 text-[10px] font-bold text-[#38BDF8]">En ligne · Plateforme IA</span>
                    <span className="text-[11px] text-slate-400">10:00 - 11:30</span>
                  </div>
                  <h3 className="mt-1 font-heading text-sm font-bold text-white">Examen Blanc TOLC-E National Synchrone</h3>
                  <p className="text-xs text-slate-300">Session chronométrée avec classement instantané</p>
                </div>
              </div>
              <button className="shrink-0 rounded-xl bg-[#0E8368] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#0E8368]/80">Rejoindre</button>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-3xl border border-[#E2583E]/30 bg-gradient-to-r from-[#E2583E]/10 to-[#0D131F] p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#E2583E] text-xs font-bold text-white shadow-sm"><span>MAR</span><span className="text-sm">15</span></div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#E2583E]/20 px-2 py-0.5 text-[10px] font-bold text-[#E2583E]">Date Limite Consulat &amp; Universitaly</span>
                    <span className="text-[11px] text-slate-400">Mars 2025</span>
                  </div>
                  <h3 className="mt-1 font-heading text-sm font-bold text-white">Clôture des demandes de Déclaration de Valeur (DoV)</h3>
                  <p className="text-xs text-slate-300">Vérifiez la validation de tous vos relevés avec votre conseiller</p>
                </div>
              </div>
              <button className="shrink-0 rounded-xl bg-[#E2583E] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#c9452d]">Voir checklist</button>
            </div>
          </div>
        </div>

        {/* Mini-calendrier + conseiller */}
        <div className="space-y-4 lg:col-span-5">
          <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-white">Février 2025</h3>
              <div className="flex gap-2 text-slate-400">
                <button className="flex size-6 items-center justify-center rounded-lg bg-white/[0.05] hover:text-white">‹</button>
                <button className="flex size-6 items-center justify-center rounded-lg bg-white/[0.05] hover:text-white">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-[11px]">
              {days.map((d, i) => (<span key={`d${i}`} className="font-bold text-slate-500">{d}</span>))}
              {leading.map((d) => (<span key={`l${d}`} className="p-2 text-slate-600">{d}</span>))}
              {month.map((d) => {
                let cls = 'p-2 text-slate-300';
                if (d === 20) cls = 'rounded-xl bg-[#0E8368] p-2 font-bold text-white';
                else if (d === 22) cls = 'rounded-xl bg-[#38BDF8] p-2 font-bold text-[#070A0F]';
                return (<span key={`m${d}`} className={cls}>{d}</span>);
              })}
            </div>
          </div>
          <div className="space-y-3 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Votre Conseiller Dédié à Brazzaville</p>
            <div className="flex items-center gap-3">
              <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Conseiller" loading="lazy" className="size-10 rounded-full border border-[#0E8368] object-cover" />
              <div>
                <p className="text-xs font-bold text-white">Jean-Pierre Mabiala</p>
                <p className="text-[11px] text-[#2DD4BF]">Conseiller orientation Italie · Centre Brazzaville</p>
              </div>
            </div>
            <button className="w-full rounded-xl border border-[#0E8368]/30 bg-[#0E8368]/20 py-2.5 text-xs font-bold text-[#2DD4BF] transition-colors hover:bg-[#0E8368] hover:text-white">Écrire sur WhatsApp (+242 06 ...)</button>
          </div>
        </div>
      </div>
    </div>
  );
}
