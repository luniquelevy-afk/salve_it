import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatMinutes, formatPercent, formatPoints } from '../../lib/format';
import { MODE_LABELS, type ReviewSummary, type SimulationMode, type SimulationState, type SimulationSummary, type TestTemplate } from '../../lib/types';

const STATUS_LABELS: Record<SimulationSummary['status'], string> = {
  in_progress: 'En cours',
  expired: 'Temps écoulé',
  completed: 'Terminée',
  abandoned: 'Abandonnée',
};

export function SimulationsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlightedTemplate = params.get('modele');
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [history, setHistory] = useState<SimulationSummary[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [templatesResponse, historyResponse, reviewsResponse] = await Promise.all([
        api<{ templates: TestTemplate[] }>('/api/test-templates'),
        api<{ simulations: SimulationSummary[] }>('/api/simulations'),
        api<ReviewSummary>('/api/student/reviews'),
      ]);
      setTemplates(templatesResponse.templates);
      setHistory(historyResponse.simulations);
      setReviews(reviewsResponse);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les simulations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = history.find((simulation) => simulation.status === 'in_progress');

  async function start(mode: SimulationMode, template?: TestTemplate) {
    if (
      mode === 'examen' &&
      template &&
      !window.confirm(`Conditions d’examen : ${template.totalQuestions} questions, ${formatMinutes(template.totalDurationSeconds)}, chronomètre et aucun retour en arrière. Commencer ?`)
    ) {
      return;
    }
    setStarting(`${template?.id ?? 'revision'}:${mode}`);
    setError(null);
    try {
      const state = await api<SimulationState>('/api/simulations', { method: 'POST', body: { mode, ...(template && { templateId: template.id }) } });
      navigate(`/etudiant/simulations/${state.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de démarrer la simulation.');
      await load();
    } finally {
      setStarting(null);
    }
  }

  if (loading) return <p className="text-stone-500">Chargement…</p>;

  const canReview = reviews !== null && (reviews.dueCount > 0 || reviews.retryableCount > 0);
  const busy = Boolean(inProgress) || starting !== null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Simulations de type TOLC</h1>
        <p className="text-stone-600">Entraînez-vous, révisez vos erreurs au bon moment, et faites régulièrement le point en conditions d’examen.</p>
      </div>

      <ErrorBanner message={error} />

      {inProgress && (
        <div className="card flex flex-wrap items-center gap-3 border-verde/40 bg-verde/5">
          <div>
            <p className="font-semibold text-verde-dark">Simulation en cours</p>
            <p className="text-sm text-stone-600">
              {inProgress.template?.name} · {MODE_LABELS[inProgress.mode]} · démarrée le {formatDateTime(inProgress.startedAt)}
            </p>
          </div>
          <Link to={`/etudiant/simulations/${inProgress.id}`} className="btn-primary ml-auto">
            Reprendre
          </Link>
        </div>
      )}

      {reviews && reviews.trackedCount > 0 && (
        <section className="card flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <h2 className="font-semibold">Révision de mes erreurs</h2>
            <p className="text-sm text-stone-600">
              {reviews.dueCount > 0
                ? `${reviews.dueCount} question${reviews.dueCount > 1 ? 's' : ''} à réviser maintenant, avec correction immédiate.`
                : reviews.retryableCount > 0
                  ? 'Aucune échéance aujourd’hui, mais vous pouvez retravailler vos dernières erreurs.'
                  : reviews.nextReviewAt
                    ? `Tout est à jour. Prochaine révision le ${formatDateTime(reviews.nextReviewAt)}.`
                    : 'Tout est à jour.'}
            </p>
          </div>
          <button className="btn-primary" disabled={!canReview || busy} onClick={() => void start('revision')}>
            {starting === 'revision:revision' ? 'Démarrage…' : 'Réviser'}
          </button>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tests disponibles</h2>
        {templates.length === 0 && <p className="text-sm text-stone-500">Aucun test disponible pour le moment.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className={`card flex flex-col gap-3 ${highlightedTemplate === template.id ? 'border-verde/60 ring-2 ring-verde/20' : ''}`}>
              <div>
                <h3 className="font-semibold">{template.name}</h3>
                {highlightedTemplate === template.id && <p className="text-xs font-medium text-verde-dark">Votre test visé</p>}
                {template.description && <p className="mt-1 text-sm text-stone-600">{template.description}</p>}
              </div>
              <p className="text-sm text-stone-600">
                {template.totalQuestions} questions · {formatMinutes(template.totalDurationSeconds)} ·{' '}
                {template.sections.map((section) => `${section.name} (${section.questionCount})`).join(', ')}
              </p>
              <div className="mt-auto flex flex-wrap gap-2">
                <button className="btn-secondary" disabled={busy} onClick={() => void start('entrainement', template)}>
                  {starting === `${template.id}:entrainement` ? 'Démarrage…' : 'Entraînement'}
                </button>
                <button className="btn-secondary" disabled={busy} onClick={() => void start('defi', template)} title="5 questions en 5 minutes">
                  {starting === `${template.id}:defi` ? 'Démarrage…' : 'Défi · 5 min'}
                </button>
                <button className="btn-primary" disabled={busy} onClick={() => void start('examen', template)}>
                  {starting === `${template.id}:examen` ? 'Démarrage…' : 'Examen'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Bonnes réponses</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    Aucune simulation pour le moment.
                  </td>
                </tr>
              )}
              {history.map((simulation) => (
                <tr key={simulation.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(simulation.startedAt)}</td>
                  <td className="px-4 py-3">{simulation.template?.name ?? '—'}</td>
                  <td className="px-4 py-3">{MODE_LABELS[simulation.mode]}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {simulation.correct === null
                      ? STATUS_LABELS[simulation.status]
                      : `${simulation.correct} / ${simulation.totalQuestions} (${formatPercent(simulation.correct, simulation.totalQuestions)})`}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPoints(simulation.score)}</td>
                  <td className="px-4 py-3 text-right">
                    {simulation.status === 'in_progress' ? (
                      <Link to={`/etudiant/simulations/${simulation.id}`} className="text-verde-dark hover:underline">
                        Reprendre
                      </Link>
                    ) : (
                      <Link to={`/etudiant/simulations/${simulation.id}/resultats`} className="text-verde-dark hover:underline">
                        Résultats
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
