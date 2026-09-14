import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import type { StudentDashboardSummary } from '../lib/types';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

// Écart signalé par une flèche et un signe, jamais par la couleur seule.
function progressionText(points: number) {
  if (points > 0) return `↑ +${points} pts depuis la première`;
  if (points < 0) return `↓ −${Math.abs(points)} pts depuis la première`;
  return '= stable depuis la première';
}

function Tile({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="card block space-y-1 transition hover:border-verde/40 hover:shadow-md">
      <p className="flex items-center justify-between text-sm text-stone-500">
        {title}
        <span aria-hidden className="text-verde">
          →
        </span>
      </p>
      {children}
    </Link>
  );
}

// §16.1 : dernier score, progression, entretiens et cohérence, documents manquants, prochaines échéances.
export function StudentOverview({ summary }: { summary: StudentDashboardSummary }) {
  const { simulations, embassy, documents, upcoming } = summary;
  const toDo = documents.missing + documents.needsCorrection + documents.expired;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile title="Simulations" to="/etudiant/simulations">
          {simulations.latest ? (
            <>
              <p className="text-3xl font-bold tabular-nums">
                {simulations.latest.percent} %<span className="ml-1 text-sm font-medium text-stone-500">de bonnes réponses</span>
              </p>
              <p className="text-xs text-stone-500">
                Dernière le {formatDateTime(simulations.latest.completedAt)} · moyenne {simulations.averagePercent} % sur {simulations.count}
              </p>
              {simulations.progressionPoints !== null && <p className="text-sm font-medium">{progressionText(simulations.progressionPoints)}</p>}
            </>
          ) : (
            <p className="text-sm text-stone-600">Aucune simulation terminée : lancez-en une en mode entraînement.</p>
          )}
        </Tile>

        <Tile title="Entretiens consulaires" to="/etudiant/entretien">
          {embassy.count > 0 ? (
            <>
              <p className="text-3xl font-bold tabular-nums">
                {embassy.averageScore}
                <span className="ml-1 text-sm font-medium text-stone-500">/ 100 en moyenne</span>
              </p>
              <p className="text-xs text-stone-500">
                {embassy.count} entretien{embassy.count > 1 ? 's' : ''} terminé{embassy.count > 1 ? 's' : ''}
                {embassy.averageCoherence !== null && ` · cohérence moyenne ${embassy.averageCoherence} / 100`}
              </p>
              {embassy.latestInconsistencies !== null && embassy.latestInconsistencies > 0 && (
                <p className="text-sm font-medium text-amber-800">
                  ⚠ {embassy.latestInconsistencies} point{embassy.latestInconsistencies > 1 ? 's' : ''} à clarifier au dernier entretien
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-600">Aucun entretien terminé : entraînez-vous avec l’agent consulaire.</p>
          )}
        </Tile>

        <Tile title="Documents" to="/etudiant/documents">
          <p className="text-3xl font-bold tabular-nums">
            {documents.validated} / {documents.total}
            <span className="ml-1 text-sm font-medium text-stone-500">vérifiés</span>
          </p>
          {toDo > 0 ? (
            <p className="text-sm font-medium">
              {[
                documents.missing > 0 && `${documents.missing} manquant${documents.missing > 1 ? 's' : ''}`,
                documents.needsCorrection > 0 && `${documents.needsCorrection} à corriger`,
                documents.expired > 0 && `${documents.expired} expiré${documents.expired > 1 ? 's' : ''}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : (
            <p className="text-xs text-stone-500">{documents.total > 0 ? 'Aucun document en attente.' : 'Précisez votre projet dans votre profil.'}</p>
          )}
        </Tile>
      </div>

      <section className="card space-y-2">
        <h2 className="font-semibold">Prochaines échéances</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-stone-500">Rien de prévu dans les deux prochaines semaines.</p>
        ) : (
          <ul className="divide-y divide-stone-100 text-sm">
            {upcoming.map((item) => (
              <li key={`${item.kind}-${item.date}-${item.title}`}>
                <Link to={item.link} className="flex flex-wrap items-baseline gap-x-3 py-2 hover:text-verde-dark">
                  <span className="w-28 shrink-0 font-medium tabular-nums">
                    {item.kind === 'class_session' ? dayFormat.format(new Date(item.date)) : new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span aria-hidden>{item.kind === 'class_session' ? '📅 ' : '⏰ '}</span>
                    {item.title}
                    {item.detail && <span className="text-stone-500"> · {item.detail}</span>}
                  </span>
                  {item.kind === 'class_session' && (
                    <span className="text-xs text-stone-500">{new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
