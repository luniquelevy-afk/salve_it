import { Icon } from '../public/landing-icon';
import photo from '../../assets/landing/images/zwLWRolYpET.jpeg';

// Design fourni « Mes Documents & Profil » (contenu de démonstration), coquille sombre.
export function DocumentsProfilPage() {
  return (
    <div className="cours space-y-8">
      {/* Titre de page */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-heading text-xl font-bold text-white sm:text-2xl">Mes Documents &amp; Profil</h1>
            <Icon name="twemoji:flag-congo-brazzaville" size={16} />
            <Icon name="twemoji:flag-italy" size={16} />
          </div>
          <p className="text-xs text-slate-400">Dossier consulaire Universitaly &amp; Paramètres</p>
        </div>
        <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3 py-1 text-xs font-semibold text-[#2DD4BF]">Dossier complet à 60%</span>
      </div>

      {/* Carte profil */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-r from-[#0D131F] via-[#0F1726] to-[#0D131F] p-6 shadow-xl sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative size-16 rounded-2xl bg-gradient-to-tr from-[#0E8368] to-[#2DD4BF] p-0.5 sm:size-20">
              <img src={photo} alt="Grâce Moukoko" className="h-full w-full rounded-2xl object-cover" />
              <span className="absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-[#070A0F] bg-emerald-500" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-white sm:text-xl">Grâce Moukoko</h2>
                <Icon name="twemoji:flag-congo-brazzaville" size={16} />
              </div>
              <p className="text-xs text-slate-300">
                Candidature : <strong>Université de Bologne</strong> <Icon name="twemoji:flag-italy" size={12} className="inline" /> · Laurea in Economia
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-slate-300">ID Étudiant: SI-2025-BZV-84</span>
                <span className="rounded-md bg-[#0E8368]/20 px-2 py-0.5 font-semibold text-[#2DD4BF]">Niveau actuel : Italien B1</span>
              </div>
            </div>
          </div>
          <button className="rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/[0.1]">Modifier profil</button>
        </div>
      </div>

      {/* Checklist documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-white">Checklist des Documents Obligatoires</h2>
          <span className="text-xs font-semibold text-[#2DD4BF]">+ Téléverser un document</span>
        </div>
        <div className="space-y-3">
          {[
            { border: 'border-emerald-500/30', icon: '✓', iconCls: 'bg-emerald-500/20 text-emerald-400', title: 'Relevés de notes du Baccalauréat (Légalisés)', sub: 'Validé par le conseiller Brazzaville le 10/02/2025', tag: { label: 'Validé', cls: 'bg-emerald-500/20 text-emerald-400' } },
            { border: 'border-emerald-500/30', icon: '✓', iconCls: 'bg-emerald-500/20 text-emerald-400', title: 'Passeport Congolais (Validité > 2 ans)', sub: 'Copie couleur haute définition vérifiée', tag: { label: 'Validé', cls: 'bg-emerald-500/20 text-emerald-400' } },
            { border: 'border-amber-500/30', icon: '⏳', iconCls: 'bg-amber-500/20 text-amber-300', title: "Attestation de niveau d'Italien B1 (CILS / CELI)", sub: 'Examen programmé fin mars au centre Brazzaville', tag: { label: 'En cours', cls: 'bg-amber-500/20 text-amber-300' } },
            { border: 'border-[#E2583E]/30', icon: '!', iconCls: 'bg-[#E2583E]/20 text-[#E2583E]', title: 'Déclaration de Valeur (Dichiarazione di Valore - DoV)', sub: 'Dépôt consulaire requis avant le 15 mars', btn: { label: 'Téléverser', cls: 'bg-[#E2583E] text-white hover:bg-[#c9452d]' } },
            { border: 'border-white/[0.08]', icon: '+', iconCls: 'bg-white/[0.05] text-slate-400', title: "Lettre de Motivation & Projet d'Études en Italien", sub: 'En cours de révision avec le module Agent IA', btn: { label: 'Finaliser', cls: 'bg-white/[0.08] text-slate-200 hover:bg-[#0E8368] hover:text-white' } },
          ].map((doc) => (
            <div key={doc.title} className={`flex items-center justify-between gap-4 rounded-2xl border ${doc.border} bg-[#0D131F] p-4`}>
              <div className="flex items-center gap-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${doc.iconCls}`}>{doc.icon}</div>
                <div>
                  <p className="text-xs font-bold text-white">{doc.title}</p>
                  <p className="text-[11px] text-slate-400">{doc.sub}</p>
                </div>
              </div>
              {doc.tag ? (
                <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${doc.tag.cls}`}>{doc.tag.label}</span>
              ) : doc.btn ? (
                <button className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${doc.btn.cls}`}>{doc.btn.label}</button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
