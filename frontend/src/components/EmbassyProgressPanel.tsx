import { formatDateTime } from '../lib/format';
import { REPORT_DIMENSION_LABELS, VISA_LABELS, type EmbassyProgress } from '../lib/types';
import { Meter } from './Meter';

// Écart affiché par une flèche et un signe : la couleur ne porte jamais seule l'information.
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-stone-400">—</span>;
  const text = value > 0 ? `↑ +${value}` : value < 0 ? `↓ −${Math.abs(value)}` : '= 0';
  return <span className="tabular-nums">{text}</span>;
}

// V1.3 : progression entre entretiens (étudiant et enseignant).
export function EmbassyProgressPanel({ progress, audience }: { progress: EmbassyProgress; audience: 'student' | 'staff' }) {
  const { summary, sessions } = progress;
  const title = audience === 'student' ? 'Ma progression' : 'Progression aux entretiens';

  if (!summary) {
    return (
      <section className="card space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-stone-500">
          {audience === 'student' ? 'Terminez un premier entretien pour suivre votre progression.' : 'Aucun entretien terminé pour le moment.'}
        </p>
      </section>
    );
  }

  const recent = sessions.slice(-6).reverse();

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-sm text-stone-500">
          {summary.count} entretien{summary.count > 1 ? 's' : ''} terminé{summary.count > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-sm text-stone-500">Dernier score</p>
          <p className="text-3xl font-bold tabular-nums">
            {summary.overall.latest}
            <span className="text-base font-medium text-stone-400"> / 100</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-stone-500">Depuis le précédent</p>
          <p className="text-xl font-semibold">
            <Delta value={summary.overall.deltaFromPrevious} />
          </p>
        </div>
        <div>
          <p className="text-sm text-stone-500">Depuis le premier</p>
          <p className="text-xl font-semibold">
            <Delta value={summary.overall.deltaFromFirst} />
          </p>
        </div>
      </div>

      {summary.count === 1 && (
        <p className="text-sm text-stone-500">La comparaison apparaîtra après {audience === 'student' ? 'votre prochain entretien' : 'le prochain entretien'}.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
            <tr>
              <th className="py-2 pr-4">Dimension</th>
              <th className="py-2 pr-4 text-right">Dernier</th>
              <th className="py-2 pr-4 text-right">vs précédent</th>
              <th className="py-2 text-right">vs premier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {summary.dimensions.map((dimension) => (
              <tr key={dimension.key}>
                <td className="py-2 pr-4">
                  <span className="block">{REPORT_DIMENSION_LABELS[dimension.key]}</span>
                  {dimension.latest !== null && (
                    <span className="mt-1 block max-w-56">
                      <Meter value={dimension.latest} label={REPORT_DIMENSION_LABELS[dimension.key]} />
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums">{dimension.latest ?? '—'}</td>
                <td className="py-2 pr-4 text-right">
                  <Delta value={dimension.deltaFromPrevious} />
                </td>
                <td className="py-2 text-right">
                  <Delta value={dimension.deltaFromFirst} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {summary.weakestDimension && (
        <p className="text-sm text-stone-700">
          Point à travailler en priorité : <span className="font-semibold">{REPORT_DIMENSION_LABELS[summary.weakestDimension.key]}</span> ({summary.weakestDimension.score} / 100).
        </p>
      )}

      {summary.recurringInconsistencies.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <p className="font-semibold text-amber-900">⚠ Sujets d’incohérence qui reviennent</p>
          <ul className="mt-1 list-disc pl-5 text-amber-900">
            {summary.recurringInconsistencies.map((item) => (
              <li key={item.topic}>
                {item.topic} — {item.sessions} entretiens
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-sm font-semibold">Derniers entretiens terminés</h3>
        <ul className="divide-y divide-stone-100 text-sm">
          {recent.map((session) => (
            <li key={session.sessionId} className="flex flex-wrap items-center gap-x-3 py-1.5">
              <span className="whitespace-nowrap text-stone-500">{formatDateTime(session.completedAt)}</span>
              <span>{session.scenarioLabel ?? VISA_LABELS[session.visaType]}</span>
              {session.inconsistencyTopics.length > 0 && <span className="text-xs text-amber-800">⚠ {session.inconsistencyTopics.length}</span>}
              <span className="ml-auto font-semibold tabular-nums">{session.overallScore}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
