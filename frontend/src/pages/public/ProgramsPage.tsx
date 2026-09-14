import { Link, useParams } from 'react-router-dom';
import { usePublicSite } from '../../components/PublicLayout';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function ProgramsPage() {
  const { site, failed } = usePublicSite();
  useDocumentTitle('Formations', site?.settings.centreName);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-12">
      <div>
        <h1 className="text-3xl font-extrabold">Nos formations</h1>
        <p className="mt-2 max-w-2xl text-stone-600">Des cours d’italien du niveau débutant au niveau universitaire. Pas sûr de votre niveau ? Faites le test gratuit.</p>
      </div>
      {failed && <p className="text-rosso">Impossible de charger les formations. Réessayez plus tard.</p>}
      {!site && !failed && <p className="text-stone-500">Chargement…</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {site?.programs.map((program) => (
          <Link key={program.id} to={`/formations/${program.slug}`} className="card block transition hover:border-verde/40 hover:shadow-md">
            <div className="flex items-center gap-2">
              {program.level && <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-semibold text-verde-dark">{program.level}</span>}
              <h2 className="font-semibold">{program.name}</h2>
            </div>
            {program.summary && <p className="mt-2 text-stone-600">{program.summary}</p>}
            <p className="mt-2 text-sm text-stone-500">{[program.durationLabel, program.scheduleLabel].filter(Boolean).join(' · ')}</p>
          </Link>
        ))}
      </div>
      <Link to="/test-de-niveau" className="btn-primary">
        Tester mon niveau
      </Link>
    </div>
  );
}

export function ProgramPage() {
  const { slug = '' } = useParams();
  const { site, failed } = usePublicSite();
  const program = site?.programs.find((candidate) => candidate.slug === slug);
  useDocumentTitle(program?.name ?? 'Formation', site?.settings.centreName);

  if (!site) {
    return <p className="mx-auto max-w-3xl px-4 py-12 text-stone-500">{failed ? 'Impossible de charger la formation.' : 'Chargement…'}</p>;
  }
  if (!program) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
        <h1 className="text-2xl font-bold">Formation introuvable</h1>
        <Link to="/formations" className="btn-secondary">
          Voir toutes les formations
        </Link>
      </div>
    );
  }

  const details = [
    { label: 'Niveau', value: program.level },
    { label: 'Public', value: program.audience },
    { label: 'Durée', value: program.durationLabel },
    { label: 'Horaires', value: program.scheduleLabel },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));

  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <Link to="/formations" className="text-sm text-verde-dark hover:underline">
        ← Toutes les formations
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold">{program.name}</h1>
        {program.summary && <p className="mt-2 text-lg text-stone-600">{program.summary}</p>}
      </div>

      {details.length > 0 && (
        <dl className="card grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="text-xs font-semibold uppercase tracking-wider text-stone-500">{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {program.description && <p className="whitespace-pre-line leading-relaxed text-stone-700">{program.description}</p>}

      {program.objectives.length > 0 && (
        <section>
          <h2 className="mb-2 text-xl font-bold">Objectifs</h2>
          <ul className="list-disc space-y-1 pl-5 text-stone-700">
            {program.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link to={`/contact?formation=${encodeURIComponent(program.name)}`} className="btn-primary">
          Je suis intéressé(e)
        </Link>
        <Link to="/test-de-niveau" className="btn-secondary">
          Tester mon niveau
        </Link>
      </div>
    </article>
  );
}
