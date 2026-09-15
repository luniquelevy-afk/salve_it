import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePublicSite } from '../../lib/public-site';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

// Fonctionnalités réelles de la plateforme (aucune donnée inventée sur le centre).
const FEATURES = [
  { title: 'Cours d’italien du A1 au B2', text: 'Cours, exercices corrigés immédiatement et calendrier de vos séances.' },
  { title: 'Simulations de type TOLC', text: 'Tests chronométrés dans les conditions de l’examen, avec corrections détaillées.' },
  { title: 'Entraînement à l’entretien de visa', text: 'Un agent virtuel vous pose les questions de l’entretien consulaire et vous remet un rapport.' },
  { title: 'Suivi personnalisé', text: 'Vos résultats et votre progression, suivis avec vos enseignants.' },
];

// Coche verte réutilisable (aucune dépendance à une police d'icônes — ENF-03).
function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-[18px] shrink-0 text-verde" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.1 3.1 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// Motif d'arche décoratif (filigrane) — rappelle le portail académique du logo.
function ArchWatermark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 200" className={className} fill="currentColor">
      <path d="M100,10 C50,10 10,50 10,100 L10,190 L190,190 L190,100 C190,50 150,10 100,10 Z M100,30 C138,30 170,62 170,100 L170,170 L30,170 L30,100 C30,62 62,30 100,30 Z" />
      <path d="M70,170 L70,110 C70,93 83,80 100,80 C117,80 130,93 130,110 L130,170 Z" />
    </svg>
  );
}

// Vignette de module dans la composition du hero (illustratif, sans statistique inventée).
function HeroModule({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-sand bg-white p-4 shadow-[0_8px_24px_rgba(15,32,56,0.08)]">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-verde/10 text-verde">{children}</span>
        <div>
          <p className="eyebrow text-verde">{label}</p>
          <p className="text-sm font-semibold text-notte">{title}</p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { site } = usePublicSite();
  const settings = site?.settings;
  useDocumentTitle(null, settings?.centreName);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-sand bg-panna-alt/60">
        <ArchWatermark className="pointer-events-none absolute -right-16 -top-24 h-[520px] w-[520px] text-notte opacity-[0.04]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <span className="inline-flex items-center gap-2 self-start rounded-full bg-verde/10 px-3 py-1 text-verde">
              <span className="size-2 animate-pulse rounded-full bg-verde" />
              <span className="eyebrow">Accompagnement · Brazzaville → Italie</span>
            </span>
            <h1 className="max-w-3xl text-4xl leading-[1.1] sm:text-5xl">
              {settings?.tagline ?? 'Votre projet d’études en Italie commence ici'}
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-stone-600">
              Cours d’italien, simulations de tests d’admission de type TOLC, entraînement à l’entretien
              consulaire et suivi de votre projet — un accompagnement structuré et accessible.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link to="/test-de-niveau" className="btn-cta px-6 py-3 text-base">
                Évaluer mon niveau gratuitement
                <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor">
                  <path fillRule="evenodd" d="M10.5 3.3a1 1 0 0 1 1.4 0l5.8 5.8a1 1 0 0 1 0 1.4l-5.8 5.8a1 1 0 0 1-1.4-1.4l4-4H3.5a1 1 0 1 1 0-2h11l-4-4a1 1 0 0 1 0-1.4Z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link to="/contact" className="btn-secondary px-6 py-3 text-base">
                Nous contacter
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-stone-600">
              <span className="flex items-center gap-1.5"><Check /> Réponse en quelques minutes</span>
              <span className="flex items-center gap-1.5"><Check /> Sans création de compte</span>
              <span className="flex items-center gap-1.5"><Check /> 100 % en ligne</span>
            </div>
          </div>

          {/* Composition illustrative (bleu nuit + arche + modules réels de la plateforme). */}
          <div className="relative lg:col-span-5">
            <div className="relative overflow-hidden rounded-2xl bg-notte p-6 shadow-[0_20px_48px_rgba(15,32,56,0.16)]">
              <ArchWatermark className="pointer-events-none absolute -bottom-16 -right-10 h-64 w-64 text-white opacity-[0.06]" />
              <p className="eyebrow text-white/60">La plateforme</p>
              <p className="mt-1 max-w-xs font-serif text-2xl font-semibold text-white">
                Chaque étape de votre projet, au même endroit.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <HeroModule label="Admission" title="Simulations de type TOLC">
                  <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor"><path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm2 4h8v2H6V7Zm0 4h8v2H6v-2Z" /></svg>
                </HeroModule>
                <HeroModule label="Consulaire" title="Entretien de visa guidé">
                  <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor"><path d="M10 2a4 4 0 0 1 4 4v1a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4Zm-6 15a6 6 0 0 1 12 0 1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" /></svg>
                </HeroModule>
                <HeroModule label="Langue" title="Cours d’italien A1 → B2">
                  <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="currentColor"><path d="M3 4h9a2 2 0 0 1 2 2v9a2 2 0 0 0-2-2H3V4Zm14 0h.5A1.5 1.5 0 0 1 19 5.5V13a2 2 0 0 0-2 2V4Z" /></svg>
                </HeroModule>
              </div>
            </div>
          </div>
        </div>
      </section>

      {settings && settings.keyFigures.length > 0 && (
        <section aria-label="Chiffres clés" className="border-b border-sand bg-white">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-3 lg:grid-cols-6">
            {settings.keyFigures.map((figure) => (
              <div key={`${figure.value}-${figure.label}`} className="text-center">
                <dd className="font-serif text-3xl font-semibold text-verde">{figure.value}</dd>
                <dt className="mt-1 text-sm text-stone-600">{figure.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="eyebrow text-terracotta">Un seul espace</p>
        <h2 className="mt-2 text-2xl sm:text-3xl">Préparer chaque étape de votre projet</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card transition-shadow hover:shadow-[0_8px_24px_rgba(15,32,56,0.08)]">
              <span aria-hidden className="mb-3 grid size-10 place-items-center rounded-lg bg-notte/5 text-notte">
                <ArchWatermark className="size-5" />
              </span>
              <h3 className="text-base font-semibold text-notte">{feature.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {settings?.about && (
        <section className="border-y border-sand bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <p className="eyebrow text-terracotta">Le centre</p>
            <h2 className="mt-2 text-2xl sm:text-3xl">Un accompagnement humain</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-stone-700">{settings.about}</p>
          </div>
        </section>
      )}

      {site && site.programs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex flex-wrap items-end gap-3">
            <div>
              <p className="eyebrow text-terracotta">Formations</p>
              <h2 className="mt-2 text-2xl sm:text-3xl">Nos parcours d’italien</h2>
            </div>
            <Link to="/formations" className="ml-auto text-sm font-semibold text-verde hover:text-verde-dark hover:underline">
              Toutes les formations →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {site.programs.map((program) => (
              <Link
                key={program.id}
                to={`/formations/${program.slug}`}
                className="card block transition-all hover:-translate-y-0.5 hover:border-verde/40 hover:shadow-[0_8px_24px_rgba(15,32,56,0.08)]"
              >
                {program.level && (
                  <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-verde">
                    {program.level}
                  </span>
                )}
                <h3 className="mt-2 text-base font-semibold text-notte">{program.name}</h3>
                {program.summary && <p className="mt-1 text-sm text-stone-600">{program.summary}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {site && site.testimonials.length > 0 && (
        <section className="border-y border-sand bg-panna-alt/50">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="eyebrow text-terracotta">Témoignages</p>
            <h2 className="mt-2 text-2xl sm:text-3xl">Leur parcours avec la méthode</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {site.testimonials.map((testimonial) => (
                <figure key={testimonial.id} className="card flex flex-col gap-3">
                  <blockquote className="flex-1 leading-relaxed text-stone-700">« {testimonial.quote} »</blockquote>
                  <figcaption className="flex items-center gap-3 border-t border-sand pt-3">
                    {testimonial.photoUrl && <img src={testimonial.photoUrl} alt="" loading="lazy" className="size-10 rounded-full object-cover" />}
                    <span>
                      <span className="block font-semibold text-notte">{testimonial.authorName}</span>
                      {testimonial.authorContext && <span className="block text-xs text-stone-500">{testimonial.authorContext}</span>}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {site && site.gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-8 flex flex-wrap items-end gap-3">
            <div>
              <p className="eyebrow text-terracotta">En images</p>
              <h2 className="mt-2 text-2xl sm:text-3xl">Le centre au quotidien</h2>
            </div>
            <Link to="/galerie" className="ml-auto text-sm font-semibold text-verde hover:text-verde-dark hover:underline">
              Voir la galerie →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {site.gallery.slice(0, 4).map((image) => (
              <img key={image.id} src={image.imageUrl} alt={image.altText} loading="lazy" className="aspect-square w-full rounded-xl border border-sand object-cover" />
            ))}
          </div>
        </section>
      )}

      {/* CTA FINAL */}
      <section className="relative overflow-hidden bg-notte text-white">
        <ArchWatermark className="pointer-events-none absolute -left-16 -bottom-24 h-96 w-96 text-white opacity-[0.05]" />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-16">
          <div className="flex-1">
            <h2 className="text-2xl text-white sm:text-3xl">Donnez une direction concrète à votre projet d’Italie</h2>
            <p className="mt-2 max-w-xl text-stone-300">Évaluez votre niveau en quelques minutes, puis parlons de votre projet.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/test-de-niveau" className="btn-cta px-6 py-3 text-base">
              Test de niveau gratuit
            </Link>
            <Link to="/contact" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">
              Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
