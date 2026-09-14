import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatClock } from '../../lib/format';
import { MODE_LABELS, type AnswerFeedback, type AnswerResult, type SimulationState } from '../../lib/types';

export function SimulationRunPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<SimulationState | null>(null);
  // Écart entre l'horloge serveur et celle du navigateur : le chrono affiché suit le serveur.
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [finishedAfterFeedback, setFinishedAfterFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToResults = useCallback(() => navigate(`/etudiant/simulations/${id}/resultats`, { replace: true }), [id, navigate]);

  const load = useCallback(async () => {
    try {
      const next = await api<SimulationState>(`/api/simulations/${id}`);
      setClockOffsetMs(Date.parse(next.serverNow) - Date.now());
      if (next.status !== 'in_progress') return goToResults();
      setState(next);
      setSelected(null);
      setFeedback(null);
      setError(null);
    } catch (err) {
      // Connexion instable : l'état est conservé côté serveur, on peut réessayer sans rien perdre (EF-11).
      setError(err instanceof ApiError ? err.message : 'Connexion perdue. Réessayez.');
    }
  }, [id, goToResults]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const remainingMs = state ? Date.parse(state.deadlineAt) - (now + clockOffsetMs) : 0;
  const expired = state !== null && remainingMs <= 0;

  // À l'échéance, le serveur clôture la simulation ; on relit l'état jusqu'à la redirection.
  useEffect(() => {
    if (!expired) return;
    void load();
    const retry = setInterval(() => void load(), 3000);
    return () => clearInterval(retry);
  }, [expired, load]);

  async function submit(answer: string | null) {
    if (!state?.question) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api<AnswerResult>(`/api/simulations/${id}/answers`, {
        method: 'POST',
        body: { position: state.question.position, answer },
      });
      if (result.feedback) {
        setFeedback(result.feedback);
        setFinishedAfterFeedback(result.finished);
      } else if (result.finished) {
        goToResults();
      } else {
        await load();
      }
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'time_over' || err.code === 'simulation_closed')) return goToResults();
      if (err instanceof ApiError && err.code === 'out_of_sequence') return void load();
      setError(err instanceof ApiError ? err.message : 'Réponse non envoyée. Vérifiez votre connexion et réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!state?.question) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        {error ? (
          <button className="btn-primary" onClick={() => void load()}>
            Réessayer
          </button>
        ) : (
          <p className="text-stone-500">Chargement…</p>
        )}
      </div>
    );
  }

  const { question } = state;
  const lowTime = remainingMs < 60_000;
  const progress = (question.position / state.totalQuestions) * 100;

  function optionClass(key: string): string {
    const base = 'flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition';
    if (feedback) {
      if (key === feedback.correctAnswer) return `${base} border-verde bg-verde/10`;
      if (key === selected) return `${base} border-rosso bg-rosso/5`;
      return `${base} border-stone-200 bg-white opacity-60`;
    }
    return key === selected
      ? `${base} border-verde bg-verde/5 ring-2 ring-verde/20`
      : `${base} border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-3 py-3">
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">{MODE_LABELS[state.mode]}</span>
        <span className="text-sm text-stone-600">
          Question <span className="font-semibold text-stone-900">{question.position + 1}</span> / {state.totalQuestions} · {question.sectionName}
        </span>
        <span
          role="timer"
          aria-label="Temps restant"
          className={`ml-auto font-mono text-lg font-bold tabular-nums ${lowTime ? 'text-rosso' : 'text-stone-900'}`}
        >
          {formatClock(remainingMs)}
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
          <div className="h-full bg-verde transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ErrorBanner message={error} />

      <div className="card space-y-5">
        <p className="text-lg leading-relaxed whitespace-pre-line">{question.text}</p>

        <div role="radiogroup" aria-label="Réponses" className="space-y-2">
          {question.options.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected === option.key}
              disabled={submitting || feedback !== null || expired}
              className={optionClass(option.key)}
              onClick={() => setSelected(option.key)}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-300 text-xs font-bold">
                {option.key}
              </span>
              <span>{option.text}</span>
            </button>
          ))}
        </div>

        {feedback ? (
          <div className={`rounded-lg px-4 py-3 text-sm ${feedback.isCorrect ? 'bg-verde/10 text-verde-dark' : 'bg-rosso/5 text-rosso'}`}>
            <p className="font-semibold">
              {feedback.isCorrect ? 'Bonne réponse !' : selected ? `Réponse incorrecte — la bonne réponse était ${feedback.correctAnswer}.` : `Sans réponse — la bonne réponse était ${feedback.correctAnswer}.`}
            </p>
            {feedback.explanation && <p className="mt-1 text-stone-700">{feedback.explanation}</p>}
            <button className="btn-primary mt-3" onClick={() => (finishedAfterFeedback ? goToResults() : void load())}>
              {finishedAfterFeedback ? 'Voir les résultats' : 'Question suivante'}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" disabled={submitting || expired} onClick={() => void submit(null)}>
              Passer
            </button>
            <button className="btn-primary" disabled={submitting || expired || selected === null} onClick={() => void submit(selected)}>
              {submitting ? 'Envoi…' : 'Valider'}
            </button>
            {state.mode === 'examen' && <p className="ml-auto text-xs text-stone-500">Pas de retour en arrière possible.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
