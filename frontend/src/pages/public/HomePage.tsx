import { Link } from 'react-router-dom';
import { usePublicSite } from '../../components/PublicLayout';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

// Fonctionnalités réelles de la plateforme (aucune donnée inventée sur le centre).
const FEATURES = [
  { title: 'Cours d’italien du A1 au B2', text: 'Cours, exercices corrigés immédiatement et calendrier de vos séances.' },
  { title: 'Simulations de type TOLC', text: 'Tests chronométrés dans les conditions de l’examen, avec corrections détaillées.' },
  { title: 'Entraînement à l’entretien de visa', text: 'Un agent virtuel vous pose les questions de l’entretien consulaire et vous remet un rapport.' },
  { title: 'Suivi personnalisé', text: 'Vos résultats et votre progression, suivis avec vos enseignants.' },
];

export function HomePage() {
  const { site } = usePublicSite();
  const settings = site?.settings;
  useDocumentTitle(null, settings?.centreName);

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-verde">Brazzaville → Italie</p>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          {settings?.tagline ?? 'Préparez vos études en Italie, de l’apprentissage de l’italien jusqu’à l’entretien de visa.'}
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-stone-600">
          Cours d’italien, simulations de tests d’admission de type TOLC, entraînement à l’entretien consulaire et suivi de votre projet.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/test-de-niveau" className="btn-primary px-6 py-3 text-base">
            Tester mon niveau gratuitement
          </Link>
          <Link to="/contact" className="btn-secondary px-6 py-3 text-base">
            Nous contacter
          </Link>
        </div>
      </section>

      {settings && settings.keyFigures.length > 0 && (
        <section aria-label="Chiffres clés" className="border-y border-stone-200 bg-white">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-3 lg:grid-cols-6">
            {settings.keyFigures.map((figure) => (
              <div key={`${figure.value}-${figure.label}`} className="text-center">
                <dd className="text-3xl font-extrabold text-verde-dark">{figure.value}</dd>
                <dt className="text-sm text-stone-600">{figure.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="mb-6 text-2xl font-bold">Un accompagnement complet</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="card">
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {settings?.about && (
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-4 py-14">
            <h2 className="mb-4 text-2xl font-bold">Le centre</h2>
            <p className="whitespace-pre-line leading-relaxed text-stone-700">{settings.about}</p>
          </div>
        </section>
      )}

      {site && site.programs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <h2 className="text-2xl font-bold">Nos formations</h2>
            <Link to="/formations" className="ml-auto text-sm text-verde-dark hover:underline">
              Toutes les formations →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {site.programs.map((program) => (
              <Link key={program.id} to={`/formations/${program.slug}`} className="card block transition hover:border-verde/40 hover:shadow-md">
                {program.level && <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-semibold text-verde-dark">{program.level}</span>}
                <h3 className="mt-2 font-semibold">{program.name}</h3>
                {program.summary && <p className="mt-1 text-sm text-stone-600">{program.summary}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {site && site.testimonials.length > 0 && (
        <section className="bg-verde/5">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="mb-6 text-2xl font-bold">Ils témoignent</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {site.testimonials.map((testimonial) => (
                <figure key={testimonial.id} className="card flex flex-col gap-3">
                  <blockquote className="flex-1 text-stone-700">« {testimonial.quote} »</blockquote>
                  <figcaption className="flex items-center gap-3">
                    {testimonial.photoUrl && <img src={testimonial.photoUrl} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />}
                    <span>
                      <span className="block font-semibold">{testimonial.authorName}</span>
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
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-6 flex flex-wrap items-end gap-3">
            <h2 className="text-2xl font-bold">En images</h2>
            <Link to="/galerie" className="ml-auto text-sm text-verde-dark hover:underline">
              Voir la galerie →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {site.gallery.slice(0, 4).map((image) => (
              <img key={image.id} src={image.imageUrl} alt={image.altText} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </section>
      )}

      <section className="bg-stone-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-4 py-12">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Prêt à commencer ?</h2>
            <p className="mt-1 text-stone-300">Évaluez votre niveau en 5 minutes, puis parlons de votre projet.</p>
          </div>
          <Link to="/test-de-niveau" className="btn bg-white text-stone-900 hover:bg-stone-100">
            Test de niveau gratuit
          </Link>
          <Link to="/contact" className="btn border border-white/40 text-white hover:bg-white/10">
            Contact
          </Link>
        </div>
      </section>
    </>
  );
}
