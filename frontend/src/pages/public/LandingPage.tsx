import { useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Icon } from './landing-icon';
import heroStudent from '../../assets/landing/images/zwLWRolYpET.jpeg';
import centreBrazza from '../../assets/landing/images/q8S28WUPWgJ.jpeg';
import cardEval from '../../assets/landing/cards/c1-evaluation.jpg';
import cardTests from '../../assets/landing/cards/c2-tests.jpg';
import cardEntretien from '../../assets/landing/cards/c3-entretien.jpg';
import cardDocs from '../../assets/landing/cards/c4-documents.jpg';
import imgBooks from '../../assets/landing/cards/m-books.jpg';
import imgExam from '../../assets/landing/cards/m-exam.jpg';
import imgAi from '../../assets/landing/cards/m-ai.jpg';
import imgPlanning from '../../assets/landing/cards/m-planning.jpg';
import imgStudy from '../../assets/landing/cards/m-study.jpg';

// Landing page « cockpit » (design fourni, reproduit fidèlement). Page autonome :
// elle porte son propre bandeau, en-tête, pied de page et bouton WhatsApp, hors du
// PublicLayout clair. Les actions d'évaluation mènent au vrai test de niveau (EF-27).
export function LandingPage() {
  const navigate = useNavigate();
  useDocumentTitle(null, 'Salve Italia');

  // Le formulaire d'accroche renvoie vers le test de niveau réel.
  const goToTest = (event: FormEvent) => {
    event.preventDefault();
    navigate('/test-de-niveau');
  };

  // Motion : révèle les blocs marqués « reveal » quand ils entrent dans le viewport.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.landing .reveal'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing relative min-h-screen overflow-x-hidden bg-[#070A0F] font-sans text-[#F1F5F9] antialiased selection:bg-[#0E8368]/30 selection:text-white">
      {/* Décor : halos et grille en fond */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-10%] left-1/2 h-[550px] w-[850px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#0E8368]/20 via-[#0E8368]/5 to-transparent blur-[140px]" />
        <div className="absolute top-[35%] right-[-10%] h-[550px] w-[550px] rounded-full bg-gradient-to-br from-[#E2583E]/15 to-transparent blur-[160px]" />
        <div className="absolute top-[70%] left-[-10%] h-[600px] w-[600px] rounded-full bg-gradient-to-tr from-[#0E8368]/15 to-transparent blur-[160px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* En-tête flottant */}
      <header className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-full border border-white/[0.08] bg-[#0D131F]/85 px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 hover:border-white/[0.18]">
          <a href="#hero" className="group flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0E8368] to-[#2DD4BF] font-heading text-base font-extrabold text-white shadow-[0_4px_16px_rgba(14,131,104,0.35)] transition-transform duration-500 group-hover:rotate-6">
              SI
            </div>
            <span className="font-heading text-lg font-extrabold tracking-tight text-white transition-colors group-hover:text-[#2DD4BF] sm:text-xl">
              Salve Italia
            </span>
          </a>
          <nav className="hidden items-center gap-1 text-[13px] font-medium text-slate-300 md:flex">
            <a href="#vision" className="rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">Vision</a>
            <a href="#solutions" className="rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">Préparation</a>
            <a href="#ai-agent" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">
              <span>Agent IA</span>
              <span className="size-1.5 animate-pulse rounded-full bg-[#0E8368]" />
            </a>
            <a href="#stack-steps" className="rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">Étapes</a>
            <a href="#brazzaville" className="rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">Centre</a>
            <a href="#faq" className="rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/[0.05] hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/contact" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-4 py-2 text-xs font-bold text-[#070A0F] transition-all duration-500 hover:bg-[#0E8368] hover:text-white hover:shadow-[0_0_25px_rgba(14,131,104,0.4)] sm:px-5">
              <span>Contactez-nous</span>
              <Icon name="solar:arrow-right-linear" size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-28 pb-28 sm:space-y-40">
        {/* HERO */}
        <section id="hero" className="pt-14 sm:pt-20 lg:pt-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl space-y-6">
              <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Votre projet d&rsquo;études en Italie commence ici<span className="text-[#0E8368]">.</span>
              </h1>
              <p className="max-w-2xl text-base font-normal leading-relaxed text-slate-300 sm:text-xl">
                Préparez vos tests d&rsquo;admission <span className="font-medium text-white">CISIA / TOLC</span>, perfectionnez votre
                italien académique et entraînez-vous à l&rsquo;entretien consulaire avec une méthode structurée.
              </p>
              <div className="flex flex-col items-stretch gap-4 pt-2 sm:flex-row sm:items-center">
                <a href="#test-gratuit" className="group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-[#E2583E] px-8 py-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(226,88,62,0.3)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#c9452d] hover:shadow-[0_15px_40px_rgba(226,88,62,0.45)]">
                  <span>Évaluer mon niveau gratuitement</span>
                  <Icon name="solar:arrow-right-linear" size={16} className="transition-transform duration-300 group-hover:translate-x-1.5" />
                </a>
                <a href="#vision" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-7 py-4 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-white/[0.25] hover:bg-white/[0.08]">
                  <Icon name="solar:play-circle-bold" size={16} className="text-[#0E8368]" />
                  <span>Découvrir la méthode</span>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-2"><Icon name="solar:check-circle-bold" size={16} className="text-[#0E8368]" />Test indicatif sans création de compte</span>
                <span className="flex items-center gap-2"><Icon name="solar:check-circle-bold" size={16} className="text-[#0E8368]" />Optimisé smartphone Android &amp; iOS</span>
                <span className="flex items-center gap-2"><Icon name="solar:check-circle-bold" size={16} className="text-[#0E8368]" />Centre physique à Brazzaville</span>
              </div>
            </div>

            {/* Composition : photo + agent IA */}
            <div className="reveal mt-14 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <div className="group relative min-h-72 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0D131F]">
                <img src={heroStudent} alt="Étudiante congolaise préparant ses études en Italie" className="h-full w-full object-cover grayscale-[20%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070A0F] via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3.5 py-1.5 text-[11px] font-medium text-white backdrop-blur-md">
                    <Icon name="twemoji:flag-congo-brazzaville" size={14} />
                    <span>Étudiante accompagnée à Brazzaville</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col justify-center gap-4 rounded-3xl border border-white/[0.08] bg-[#0D131F]/90 p-6 backdrop-blur-md sm:p-8">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-bold text-white">
                    <Icon name="solar:magic-stick-3-bold" size={16} className="text-[#2DD4BF]" />Agent Ambassade IA
                  </span>
                  <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/15 px-2 py-0.5 text-[10px] font-bold text-[#2DD4BF]">Simulation Vocale</span>
                </div>
                <p className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 text-sm italic leading-relaxed text-slate-300">
                  « Qual è la tua motivazione principale per studiare in Italia ? »
                </p>
                <a href="#test-gratuit" className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-[#2DD4BF] transition-colors hover:text-white">
                  <Icon name="solar:play-bold" size={14} />
                  <span>Démarrer une simulation</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <section className="select-none overflow-hidden border-y border-white/[0.06] bg-[#0D131F]/40 py-6 backdrop-blur-sm">
          <div className="flex w-max animate-[marquee_30s_linear_infinite] items-center gap-12 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-slate-400">
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-12" aria-hidden={dup === 1}>
                <span className="flex items-center gap-3 text-white"><Icon name="twemoji:flag-congo-brazzaville" size={16} /><span className="size-1.5 rounded-full bg-[#0E8368]" />Préparation CISIA &amp; TOLC</span>
                <span className="text-slate-700">/</span>
                <span className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-[#0E8368]" />Centre partenaire à Brazzaville</span>
                <span className="text-slate-700">/</span>
                <span className="flex items-center gap-3 text-white"><Icon name="twemoji:flag-italy" size={16} /><span className="size-1.5 rounded-full bg-[#0E8368]" />Entraînement Entretien Consulaire IA</span>
                <span className="text-slate-700">/</span>
                <span className="flex items-center gap-3"><span className="size-1.5 rounded-full bg-[#0E8368]" />Italien Académique A1 à B2</span>
                <span className="text-slate-700">/</span>
                <span className="flex items-center gap-3 text-white"><Icon name="twemoji:flag-congo-brazzaville" size={16} /><span className="size-1.5 rounded-full bg-[#0E8368]" />Checklist Documentaire Étape par Étape</span>
                <span className="text-slate-700">/</span>
              </div>
            ))}
          </div>
        </section>

        {/* Vision */}
        <section id="vision" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal grid grid-cols-1 items-start gap-10 border-l border-[#0E8368]/40 pl-6 sm:pl-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">
                <Icon name="twemoji:flag-congo-brazzaville" size={14} />
                <span>Passerelle Congo - Italie</span>
                <Icon name="twemoji:flag-italy" size={14} />
              </div>
              <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Partir étudier en Italie demande plus qu&rsquo;un dossier. <span className="font-light text-slate-400">Il faut un projet préparé avec méthode.</span>
              </h2>
              <p className="max-w-2xl pt-2 text-base font-normal leading-relaxed text-slate-300 sm:text-xl">
                Salve Italia transforme une démarche complexe en un parcours clair et mesurable, combinant entraînement numérique de pointe et encadrement humain à Brazzaville.
              </p>
            </div>
            <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-sm sm:p-8 lg:col-span-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2DD4BF]">
                <Icon name="solar:shield-check-bold" size={16} />Rigueur Pédagogique
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Pas de fausses promesses. Nous entraînons rigoureusement les candidats aux tests réels du CISIA, à la langue italienne et à la clarté du discours devant les autorités consulaires.
              </p>
            </div>
          </div>
        </section>

        {/* Diagnostic — 4 défis (cartes empilées) */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal mb-10 max-w-2xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#E2583E]">Diagnostic</span>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Les étapes sont nombreuses. La préparation peut être plus claire.</h2>
            <p className="text-xs text-slate-400">Découvrez les 4 défis majeurs transformés en étapes maîtrisées.</p>
          </div>
          {/* Pile de cartes : chaque carte est « sticky » et occupe ~46vh de défilement,
              si bien que la suivante remonte du bas et recouvre la précédente (décalage de
              deck via un top croissant) ; en remontant, l'empilement se défait à l'envers. */}
          <div className="relative">
            {[
              { border: 'border-white/[0.1]', bg: 'bg-[#0D131F]', shadow: 'shadow-[0_-10px_30px_rgba(0,0,0,0.6)]', n: '01', tag: 'Évaluation Initiale', title: 'Comprendre son niveau sans biais', text: 'Situez précisément vos acquis en logique, mathématiques et langue italienne avant même de sélectionner vos universités en Italie.', icon: 'solar:chart-square-bold', img: cardEval },
              { border: 'border-white/[0.12]', bg: 'bg-[#0F1726]', shadow: 'shadow-[0_-15px_35px_rgba(0,0,0,0.7)]', n: '02', tag: 'Méthodologie Spécifique', title: 'Réussir les tests CISIA / TOLC', text: "Maîtrisez le format chronométré et le système de pénalités propre aux examens d'admission des universités italiennes.", icon: 'solar:target-bold', img: cardTests },
              { border: 'border-white/[0.14]', bg: 'bg-[#111C30]', shadow: 'shadow-[0_-20px_40px_rgba(0,0,0,0.8)]', n: '03', tag: 'Communication & Conviction', title: 'Présenter son projet avec assurance', text: "Apprenez à expliciter la cohérence entre votre parcours au Congo et votre diplôme visé en Italie lors de l'entretien consulaire.", icon: 'solar:user-speak-bold', img: cardEntretien },
              { border: 'border-white/[0.16]', bg: 'bg-[#132038]', shadow: 'shadow-[0_-25px_45px_rgba(0,0,0,0.85)]', n: '04', tag: 'Conformité Administrative', title: 'Organiser et sécuriser ses documents', text: 'Suivez rigoureusement les étapes de légalisation, Déclaration de Valeur (DoV) et pré-inscription Universitaly avec le centre de Brazzaville.', icon: 'solar:checklist-minimalistic-bold', img: cardDocs },
            ].map((step, i) => (
              <div
                key={step.n}
                style={{ top: `${5 + i}rem` }}
                className={`sticky flex min-h-[46vh] items-center overflow-hidden rounded-3xl border ${step.border} ${step.bg} p-8 ${step.shadow} transition-colors duration-500 hover:border-[#0E8368] sm:p-10`}
              >
                <img src={step.img} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#070A0F]/95 via-[#070A0F]/80 to-[#070A0F]/45" />
                <div className="relative z-10 flex w-full flex-col justify-between gap-6 md:flex-row md:items-center">
                  <div className="max-w-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-heading text-2xl font-black text-[#2DD4BF]">{step.n}</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{step.tag}</span>
                    </div>
                    <h3 className="font-heading text-xl font-bold text-white sm:text-2xl">{step.title}</h3>
                    <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{step.text}</p>
                  </div>
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[#0E8368]/30 bg-[#0E8368]/15 text-[#2DD4BF]">
                    <Icon name={step.icon} size={28} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Solutions */}
        <section id="solutions" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">L&rsquo;Écosystème Salve Italia</span>
              <h2 className="font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Un accompagnement numérique pour chaque étape</h2>
            </div>
            <p className="max-w-xs text-xs leading-relaxed text-slate-400">Quatre modules interconnectés conçus pour former des candidats crédibles et sereins.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {[
              { span: 'md:col-span-7', grad: 'bg-[#0D131F]', img: imgExam, tag: 'TOLC-I · TOLC-E · TOLC-F · TOLC-MED', tagCls: 'bg-white/[0.05] border-white/[0.1]', icon: 'solar:target-bold', title: 'Tests d’admission', text: 'Simulations chronométrées, exercices par compétence et corrections détaillées pour assimiler la logique des jurys italiens.', foot: 'Banque de plus de 1 200 questions types', wide: true },
              { span: 'md:col-span-5', grad: 'bg-gradient-to-br from-[#0D131F] to-[#070A0F]', img: imgAi, tag: 'Vocal & Écrit', tagCls: 'bg-[#0E8368]/20 border-[#0E8368]/40', icon: 'solar:magic-stick-3-bold', title: 'Entretien IA', text: 'Entraînez-vous à répondre à des questions réalistes avec retour pédagogique instantané sur la cohérence de vos propos.', foot: 'Entraînement illimité 24/7', wide: false },
              { span: 'md:col-span-5', grad: 'bg-[#0D131F]', img: imgBooks, tag: 'Niveaux A1 → B2', tagCls: 'bg-white/[0.05] border-white/[0.1]', icon: 'solar:book-bookmark-bold', title: 'Italien académique', text: 'Développez votre compréhension, enrichissez votre vocabulaire universitaire et préparez les certifications CILS / CELI.', foot: 'Exercices interactifs & phonétique', wide: false },
              { span: 'md:col-span-7', grad: 'bg-[#0D131F]', img: imgPlanning, tag: 'Checklist & Échéances', tagCls: 'bg-white/[0.05] border-white/[0.1]', icon: 'solar:checklist-minimalistic-bold', title: 'Suivi du projet', text: 'Visualisez vos progrès, archivez vos documents préparés et suivez les échéances en direct avec vos parents et nos conseillers.', foot: 'Visibilité partagée avec le centre de Brazzaville', wide: true },
            ].map((mod, i) => (
              <div key={mod.title} style={{ transitionDelay: `${i * 90}ms` }} className={`reveal group relative flex flex-col justify-between space-y-8 overflow-hidden rounded-3xl border border-white/[0.08] ${mod.grad} p-8 transition-all duration-500 hover:-translate-y-2 hover:border-[#0E8368] hover:shadow-[0_20px_40px_rgba(14,131,104,0.2)] sm:p-10 ${mod.span}`}>
                <img src={mod.img} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-105" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#070A0F]/92 via-[#070A0F]/80 to-[#070A0F]/55" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full border px-3.5 py-1 text-[11px] font-bold text-[#2DD4BF] ${mod.tagCls}`}>{mod.tag}</span>
                    <Icon name={mod.icon} size={24} className="text-[#2DD4BF] transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="font-heading text-2xl font-bold text-white">{mod.title}</h3>
                  <p className={`text-sm leading-relaxed text-slate-300 ${mod.wide ? 'max-w-lg' : ''}`}>{mod.text}</p>
                </div>
                <div className="relative z-10 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs font-semibold text-[#2DD4BF]">
                  <span>{mod.foot}</span>
                  <Icon name="solar:arrow-right-linear" size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Agent IA */}
        <section id="ai-agent" className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0D131F] via-[#070A0F] to-[#070A0F] px-6 py-16 sm:rounded-[2.5rem] sm:px-12 sm:py-24">
          <div className="pointer-events-none absolute top-1/2 right-0 size-96 -translate-y-1/2 rounded-full bg-[#0E8368]/15 blur-3xl" />
          <div className="reveal relative z-10 grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E8368]/30 bg-[#0E8368]/10 px-3.5 py-1 text-xs font-semibold text-[#2DD4BF]">
                <span className="size-2 animate-ping rounded-full bg-[#2DD4BF]" />
                <span>Simulateur d&rsquo;Entretien IA</span>
              </div>
              <h2 className="font-heading text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">Répondez avec plus de clarté. Entraînez-vous avant le jour de l&rsquo;entretien.</h2>
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">L&rsquo;agent Ambassade IA vous pose une question à la fois, vous permet de répondre oralement ou par écrit, puis génère un retour pédagogique sur votre préparation.</p>
              <div className="space-y-3 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-3"><Icon name="solar:check-circle-bold" size={16} className="text-[#2DD4BF]" /><span>Entraînez-vous à exprimer votre motivation avec clarté</span></div>
                <div className="flex items-center gap-3"><Icon name="solar:check-circle-bold" size={16} className="text-[#2DD4BF]" /><span>Conseils pédagogiques immédiats pour perfectionner votre argumentaire</span></div>
              </div>
              <div className="pt-4">
                <a href="#test-gratuit" className="inline-flex items-center gap-3 rounded-2xl bg-[#E2583E] px-7 py-4 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:bg-[#c9452d] sm:text-sm">
                  <span>Découvrir l&rsquo;entretien IA</span>
                  <Icon name="solar:arrow-right-linear" size={16} />
                </a>
              </div>
              <p className="text-[11px] italic text-slate-500">* Outil d&rsquo;entraînement pédagogique. Il ne remplace pas les informations officielles des autorités italiennes.</p>
            </div>
            <div className="lg:col-span-7">
              <div className="space-y-6 rounded-3xl border border-white/[0.12] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#0E8368] to-[#2DD4BF] text-xs font-bold text-white">
                      IA<span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-[#070A0F] bg-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Simulation Consulaire Salve Italia</p>
                      <p className="text-[10px] text-slate-400">Question 2 sur 6 · Mode Évaluation</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-3.5 py-1.5 text-[11px] text-slate-300">
                    <span className="size-2 animate-pulse rounded-full bg-[#2DD4BF]" /><span>Microphone actif</span>
                  </div>
                </div>
                <div className="space-y-4 text-xs sm:text-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0E8368]/20 text-[#2DD4BF]"><Icon name="solar:user-speak-bold" size={16} /></div>
                    <div className="max-w-[88%] rounded-2xl rounded-tl-none border border-white/[0.06] bg-white/[0.06] p-4 leading-relaxed text-slate-200">« Pourquoi avez-vous choisi cette formation en Italie ? »</div>
                  </div>
                  <div className="flex items-start justify-end gap-3">
                    <div className="max-w-[88%] rounded-2xl rounded-tr-none bg-[#0E8368] p-4 leading-relaxed text-white shadow-sm">« Cette formation correspond à mon parcours et à mon objectif professionnel. »</div>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl border border-[#0E8368]/30 bg-[#0E8368]/10 p-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-heading font-bold uppercase tracking-wide text-[#2DD4BF]"><Icon name="solar:notes-bold" size={16} />Rapport Pédagogique</span>
                    <span className="text-[10px] text-slate-400">Analyse instantanée</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-b border-white/[0.08] pb-3 pt-1 text-xs">
                    <div><span className="block text-[11px] text-slate-400">Cohérence :</span><span className="font-semibold text-emerald-400">Satisfaisante</span></div>
                    <div><span className="block text-[11px] text-slate-400">Clarté :</span><span className="font-semibold text-amber-300">À renforcer</span></div>
                  </div>
                  <div className="pt-1 text-xs leading-relaxed text-slate-200">
                    <span className="font-bold text-[#2DD4BF]">Conseil :</span> Donnez un exemple concret de votre futur métier et citez une matière du programme italien qui complète vos études au Congo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feuille de route */}
        <section id="stack-steps" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal mx-auto mb-12 max-w-2xl space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">Feuille de Route</span>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">De votre première évaluation à votre projet préparé</h2>
            <p className="text-xs text-slate-400">Un parcours progressif pensé pour les étudiants du Congo vers l&rsquo;Italie.</p>
          </div>
          <div className="mx-auto max-w-4xl space-y-6">
            {[
              { top: 'top-28', border: 'border-white/[0.1]', bg: 'bg-[#0D131F]', shadow: 'shadow-[0_-10px_30px_rgba(0,0,0,0.6)]', badge: 'bg-[#0E8368] text-white', num: '1', tagCls: 'text-[#2DD4BF]', tag: 'Étape 1 · Diagnostic', title: 'Évaluez votre niveau initial', text: "Passez un test diagnostique gratuit de 10 minutes pour situer vos compétences en logique et votre niveau d'italien de départ.", img: cardEval },
              { top: 'top-32', border: 'border-white/[0.14]', bg: 'bg-[#0F1726]', shadow: 'shadow-[0_-15px_35px_rgba(0,0,0,0.7)]', badge: 'bg-white text-[#070A0F]', num: '2', tagCls: 'text-white', tag: 'Étape 2 · Entraînement', title: 'Suivez un parcours personnalisé', text: 'Accédez aux séries d’exercices ciblées selon votre filière et participez aux séances de cours au centre de Brazzaville ou en ligne.', img: imgStudy },
              { top: 'top-36', border: 'border-white/[0.18]', bg: 'bg-[#111C30]', shadow: 'shadow-[0_-20px_40px_rgba(0,0,0,0.85)]', badge: 'bg-[#E2583E] text-white', num: '3', tagCls: 'text-[#E2583E]', tag: 'Étape 3 · Finalisation', title: 'Préparez vos tests et votre entretien consulaire', text: "Multipliez les simulations chronométrées et les entretiens oraux avec l'Agent IA jusqu'à maîtriser parfaitement votre dossier.", img: cardEntretien },
            ].map((step) => (
              <div key={step.num} className={`sticky ${step.top} overflow-hidden rounded-3xl border ${step.border} ${step.bg} p-8 ${step.shadow} transition-colors duration-500 hover:border-[#0E8368] sm:p-10`}>
                <img src={step.img} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#070A0F]/92 via-[#070A0F]/82 to-[#070A0F]/55" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`flex size-12 items-center justify-center rounded-2xl font-heading text-base font-extrabold shadow-md ${step.badge}`}>{step.num}</div>
                    <span className={`rounded-full bg-white/[0.05] px-3 py-1 text-xs font-semibold ${step.tagCls}`}>{step.tag}</span>
                  </div>
                  <h3 className="font-heading text-xl font-bold text-white sm:text-2xl">{step.title}</h3>
                  <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Test gratuit (formulaire) */}
        <section id="test-gratuit" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0D131F] to-[#070A0F] p-8 shadow-2xl sm:rounded-[2.5rem] sm:p-12 lg:p-16">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-5">
                <span className="inline-block rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3.5 py-1 text-xs font-bold text-[#2DD4BF]">Accès Immédiat · 100% Gratuit</span>
                <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">Commencez par comprendre votre niveau.</h2>
                <p className="text-sm leading-relaxed text-slate-300">Réalisez un test indicatif et découvrez les prochaines étapes adaptées à votre projet d&rsquo;études en Italie.</p>
                <div className="space-y-2.5 pt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2.5"><Icon name="solar:clock-circle-bold" size={16} className="text-[#2DD4BF]" /><span>Environ 10 minutes</span></div>
                  <div className="flex items-center gap-2.5"><Icon name="solar:shield-check-bold" size={16} className="text-[#2DD4BF]" /><span>Sans création de compte préalable</span></div>
                  <div className="flex items-center gap-2.5"><Icon name="solar:smartphone-bold" size={16} className="text-[#2DD4BF]" /><span>100 % accessible sur smartphone</span></div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-md sm:p-8 lg:col-span-7">
                <form className="space-y-4" onSubmit={goToTest}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-white">Nom complet *</label>
                      <input type="text" placeholder="Grâce Moukoko" required className="w-full rounded-2xl border border-white/[0.1] bg-[#070A0F] px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-white">Numéro WhatsApp *</label>
                      <input type="tel" placeholder="+242 06 000 00 00" required className="w-full rounded-2xl border border-white/[0.1] bg-[#070A0F] px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-white">Adresse email *</label>
                      <input type="email" placeholder="votre.email@domaine.com" required className="w-full rounded-2xl border border-white/[0.1] bg-[#070A0F] px-4 py-3 text-xs text-white placeholder:text-slate-600 focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-white">Niveau estimé en italien</label>
                      <select className="w-full rounded-2xl border border-white/[0.1] bg-[#070A0F] px-4 py-3 text-xs text-white focus:border-[#2DD4BF] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF]">
                        <option>Débutant complet (A0)</option>
                        <option>Notions de base (A1 - A2)</option>
                        <option>Intermédiaire (B1)</option>
                        <option>Avancé (B2 ou plus)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button type="submit" className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#E2583E] py-4 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:bg-[#c9452d] sm:text-sm">
                      <span>Faire le test gratuitement</span>
                      <Icon name="solar:arrow-right-linear" size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-slate-500">Résultats indicatifs immédiats · Vos données restent strictement confidentielles</p>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* Brazzaville */}
        <section id="brazzaville" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <div className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0D131F] shadow-lg">
                <img src={centreBrazza} alt="Enseignants et étudiants du centre à Brazzaville" className="h-80 w-full object-cover grayscale-[15%] transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0 sm:h-96" />
                <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#0D131F] p-4">
                  <div className="flex items-center gap-2">
                    <Icon name="twemoji:flag-congo-brazzaville" size={16} />
                    <div>
                      <p className="text-xs font-bold text-white">Centre de langue partenaire</p>
                      <p className="text-[11px] text-slate-400">Brazzaville, République du Congo</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3 py-1 text-[10px] font-bold text-[#2DD4BF]">Présentiel &amp; Hybride</span>
                </div>
              </div>
            </div>
            <div className="space-y-6 lg:col-span-6">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">Présence Locale</span>
              <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">La technologie ne remplace pas l&rsquo;accompagnement. Elle le renforce.</h2>
              <p className="text-sm leading-relaxed text-slate-300 sm:text-base">Les enseignants du centre de Brazzaville peuvent suivre vos résultats, proposer des recommandations et vous aider à progresser pas à pas.</p>
              <div className="space-y-4 pt-2">
                {[
                  { title: 'Conseils adaptés à votre situation', text: 'Orientation selon votre filière : ingénierie à Turin, économie à Bologne ou architecture à Florence.' },
                  { title: 'Suivi par des enseignants certifiés', text: 'Ateliers réguliers de pratique orale et corrections personnalisées de vos écrits.' },
                  { title: 'Clarté et sérénité pour les familles', text: "Des points d'étape réguliers pour rassurer l'étudiant ainsi que ses parents." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#0E8368]/20 text-xs font-bold text-[#2DD4BF]">✓</span>
                    <div>
                      <h3 className="text-xs font-bold text-white">{item.title}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="reveal mb-12 space-y-3 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2DD4BF]">Questions Fréquentes</span>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Foire aux questions</h2>
          </div>
          <div className="reveal divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {[
              { q: 'Qu’est-ce que Salve Italia ?', a: 'Salve Italia est une plateforme de préparation académique, linguistique et consulaire pour les candidats congolais souhaitant intégrer une université en Italie.' },
              { q: 'À qui s’adresse la plateforme ?', a: "Aux bacheliers, étudiants et professionnels préparant un départ vers une licence, un master ou souhaitant apprendre l'italien dès maintenant." },
              { q: 'Le test de niveau est-il gratuit ?', a: 'Oui, le test indicatif est 100 % gratuit et ne requiert aucune carte bancaire.' },
              { q: 'Salve Italia garantit-elle l’obtention d’un visa ?', a: 'Non. Seules les autorités consulaires et universitaires italiennes sont décisionnaires. Salve Italia agit uniquement comme organisme de préparation pédagogique.' },
              { q: 'L’entretien IA fonctionne-t-il sur smartphone ?', a: 'Oui, vous pouvez répondre par message écrit ou par la voix directement depuis votre navigateur mobile habituel.' },
            ].map((item) => (
              <details key={item.q} className="group py-5 transition [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between font-heading text-sm font-bold text-white sm:text-base">
                  <span>{item.q}</span>
                  <span className="flex size-6 items-center justify-center rounded-full border border-white/20 text-xs text-[#2DD4BF] transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-slate-400 sm:text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#0D131F] via-[#070A0F] to-[#070A0F] px-8 py-16 text-center text-white sm:rounded-[2.5rem] sm:px-16 sm:py-24">
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-[#0E8368]/20 blur-3xl" />
            <div className="relative z-10 mx-auto max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-4 py-1 text-xs font-bold text-[#2DD4BF]">
                <Icon name="twemoji:flag-congo-brazzaville" size={14} />
                <span>Sessions 2025/2026 Ouvertes</span>
                <Icon name="twemoji:flag-italy" size={14} />
              </div>
              <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Votre projet d&rsquo;Italie mérite une préparation claire.</h2>
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">Commencez par évaluer votre niveau et avancez avec une méthode adaptée à votre objectif.</p>
              <div className="flex flex-col items-center justify-center gap-4 pt-3 sm:flex-row">
                <a href="#test-gratuit" className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#E2583E] px-8 py-4 text-xs font-bold text-white shadow-xl transition-all duration-300 hover:bg-[#c9452d] sm:w-auto sm:text-sm">
                  <span>Évaluer mon niveau</span>
                  <Icon name="solar:arrow-right-linear" size={16} />
                </a>
                <a href="https://wa.me/242000000000" target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-7 py-4 text-xs font-semibold text-white transition-all duration-300 hover:bg-white/[0.08] sm:w-auto sm:text-sm">
                  <Icon name="solar:chat-round-line-bold" size={16} className="text-emerald-400" />
                  <span>Contacter sur WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Pied de page */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#070A0F] py-12 text-slate-300">
        <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
            <div className="space-y-3 md:col-span-5">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-[#0E8368] to-[#2DD4BF] font-heading text-[10px] font-extrabold text-white">SI</div>
                <span className="font-heading text-base font-bold text-white">Salve Italia</span>
                <div className="ml-1 flex items-center gap-1">
                  <Icon name="twemoji:flag-congo-brazzaville" size={14} />
                  <Icon name="twemoji:flag-italy" size={14} />
                </div>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-slate-400">Plateforme de préparation académique, linguistique et consulaire pour les candidats de la République du Congo vers l&rsquo;Italie.</p>
              <p className="text-[11px] text-slate-500">📍 Brazzaville, République du Congo</p>
            </div>
            <div className="space-y-2 text-xs md:col-span-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navigation</p>
              <ul className="space-y-1.5 text-slate-400">
                <li><a href="#solutions" className="transition-colors hover:text-[#2DD4BF]">Tests CISIA / TOLC</a></li>
                <li><a href="#ai-agent" className="transition-colors hover:text-[#2DD4BF]">Entretien IA</a></li>
                <li><a href="#solutions" className="transition-colors hover:text-[#2DD4BF]">Italien académique</a></li>
                <li><a href="#test-gratuit" className="transition-colors hover:text-[#2DD4BF]">Diagnostic gratuit</a></li>
              </ul>
            </div>
            <div className="space-y-2 text-xs md:col-span-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Centre &amp; Contact</p>
              <ul className="space-y-1.5 text-slate-400">
                <li>WhatsApp : +242 06 000 00 00</li>
                <li>Email : contact@salveitalia.cg</li>
                <li>Centre de langue partenaire · Brazzaville</li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-[11px] text-slate-500 sm:flex-row">
            <div className="flex items-center gap-2">
              <p>© 2025 Salve Italia. Tous droits réservés.</p>
              <Icon name="twemoji:flag-congo-brazzaville" size={12} />
              <Icon name="twemoji:flag-italy" size={12} />
            </div>
            <p>Entraînement pédagogique indépendant · Non affilié officiellement aux services consulaires</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp flottant */}
      <a href="https://wa.me/242000000000" target="_blank" rel="noopener noreferrer" aria-label="Contacter le centre sur WhatsApp" className="fixed bottom-6 right-6 z-50 flex size-13 items-center justify-center rounded-full bg-[#0E8368] p-3.5 text-white shadow-[0_10px_30px_rgba(14,131,104,0.4)] transition-all duration-300 hover:scale-105 active:scale-95">
        <Icon name="solar:chat-round-dots-bold" size={24} />
      </a>
    </div>
  );
}
