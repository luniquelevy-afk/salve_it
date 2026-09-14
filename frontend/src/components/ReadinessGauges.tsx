import type { Readiness } from '../lib/types';
import { Meter } from './Meter';

const DIMENSIONS: { key: 'academic' | 'language' | 'financial' | 'visa'; label: string; source: string }[] = [
  { key: 'academic', label: 'Tests d’admission', source: 'simulations' },
  { key: 'language', label: 'Italien', source: 'niveau et exercices' },
  { key: 'financial', label: 'Clarté du financement', source: 'profil et entretiens' },
  { key: 'visa', label: 'Entretien consulaire', source: 'rapports d’entretien' },
];

// §9.1 / EF-40 : indicateur d'auto-évaluation, jamais une probabilité d'admission ou de visa.
export function ReadinessGauges({ readiness, title = 'Indicateur de préparation' }: { readiness: Readiness; title?: string }) {
  return (
    <section className="card space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-right">
          {readiness.overall === null ? (
            <span className="text-sm text-stone-500">Pas encore assez de données</span>
          ) : (
            <>
              <span className="text-4xl font-bold tabular-nums text-stone-900">{readiness.overall}</span>
              <span className="text-sm text-stone-500"> / 100</span>
            </>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {DIMENSIONS.map((dimension) => {
          const value = readiness[dimension.key];
          return (
            <div key={dimension.key}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="text-stone-700">{dimension.label}</span>
                <span className={value === null ? 'text-stone-400' : 'font-semibold tabular-nums text-stone-900'}>{value ?? '—'}</span>
              </div>
              {value === null ? <p className="text-xs text-stone-400">Pas encore de données ({dimension.source})</p> : <Meter value={value} label={dimension.label} />}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-stone-500">
        Basé sur {readiness.basis.simulations} simulation(s)
        {readiness.basis.targetTemplate && ` (${readiness.basis.targetTemplate})`}, {readiness.basis.exercises} exercice(s) récents et {readiness.basis.embassySessions} entretien(s).{' '}
        {readiness.notice}
      </p>
    </section>
  );
}
