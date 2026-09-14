import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatPercent, formatPoints } from '../../lib/format';
import { MODE_LABELS, type SimulationResults } from '../../lib/types';

export function SimulationResultsPage() {
  const { id = '' } = useParams();
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SimulationResults>(`/api/simulations/${id}/results`)
      .then(setResults)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les résultats.'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/etudiant/simulations" className="btn-secondary">
          Retour aux simulations
        </Link>
      </div>
    );
  }
  if (!results) return <p className="text-stone-500">Chargement…</p>;

  const sections = Object.values(results.bySection);
  const totals = sections.reduce(
    (sum, section) => ({ correct: sum.correct + section.correct, wrong: sum.wrong + section.wrong, blank: sum.blank + section.blank }),
    { correct: 0, wrong: 0, blank: 0 },
  );
  const { scoringRules: rules } = results;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold">Résultats</h1>
          <p className="text-stone-600">
            {results.template.name} · {MODE_LABELS[results.mode]}
            {results.completedAt && ` · ${formatDateTime(results.completedAt)}`}
          </p>
        </div>
        <Link to="/etudiant/simulations" className="btn-secondary ml-auto">
          Retour aux simulations
        </Link>
      </div>

      {results.challenge && (
        <div className={`card ${results.challenge.succeeded ? 'border-verde/40 bg-verde/5' : 'border-amber-200 bg-amber-50'}`} role="status">
          <p className="font-semibold">{results.challenge.succeeded ? 'Défi réussi !' : 'Défi non atteint cette fois'}</p>
          <p className="text-sm text-stone-700">
            {results.challenge.correct} bonne{results.challenge.correct > 1 ? 's' : ''} réponse{results.challenge.correct > 1 ? 's' : ''} sur {results.totalQuestions} — objectif : {results.challenge.target}.
          </p>
        </div>
      )}

      {results.previous && (
        <p className="text-sm text-stone-600">
          Tentative précédente ({formatDateTime(results.previous.completedAt)}) : {results.previous.correct} bonne{results.previous.correct > 1 ? 's' : ''} réponse
          {results.previous.correct > 1 ? 's' : ''}, score {formatPoints(results.previous.score)}.{' '}
          {(() => {
            const current = Object.values(results.bySection).reduce((sum, section) => sum + section.correct, 0);
            const delta = current - results.previous.correct;
            return delta === 0 ? 'Même résultat.' : delta > 0 ? `Progression de ${delta} bonne${delta > 1 ? 's' : ''} réponse${delta > 1 ? 's' : ''}.` : `${Math.abs(delta)} bonne${delta < -1 ? 's' : ''} réponse${delta < -1 ? 's' : ''} de moins.`;
          })()}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-stone-500">Score</p>
          <p className="text-3xl font-bold text-verde-dark">{formatPoints(results.score)}</p>
          <p className="text-xs text-stone-500">
            Barème : +{formatPoints(rules.correct)} / {formatPoints(rules.wrong)} / {formatPoints(rules.blank)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-stone-500">Bonnes réponses</p>
          <p className="text-3xl font-bold">{totals.correct}</p>
          <p className="text-xs text-stone-500">{formatPercent(totals.correct, results.totalQuestions)} des questions</p>
        </div>
        <div className="card">
          <p className="text-sm text-stone-500">Mauvaises réponses</p>
          <p className="text-3xl font-bold text-rosso">{totals.wrong}</p>
        </div>
        <div className="card">
          <p className="text-sm text-stone-500">Sans réponse</p>
          <p className="text-3xl font-bold text-stone-500">{totals.blank}</p>
        </div>
      </div>

      <section className="card overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Section</th>
              <th className="px-4 py-3">Bonnes</th>
              <th className="px-4 py-3">Mauvaises</th>
              <th className="px-4 py-3">Sans réponse</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sections.map((section) => (
              <tr key={section.name}>
                <td className="px-4 py-3 font-medium">{section.name}</td>
                <td className="px-4 py-3">
                  {section.correct} / {section.total} ({formatPercent(section.correct, section.total)})
                </td>
                <td className="px-4 py-3">{section.wrong}</td>
                <td className="px-4 py-3">{section.blank}</td>
                <td className="px-4 py-3 font-semibold">{formatPoints(section.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Corrections</h2>
        {results.questions.map((question) => (
          <article
            key={question.position}
            className={`card border-l-4 ${question.isCorrect ? 'border-l-verde' : question.answerGiven === null ? 'border-l-stone-300' : 'border-l-rosso'}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span className="font-semibold text-stone-700">Question {question.position + 1}</span>
              <span>· {question.sectionName}</span>
              <span>· {question.timeSpentSeconds} s</span>
              <span className="ml-auto font-medium">
                {question.isCorrect ? '✓ Correct' : question.answerGiven === null ? 'Sans réponse' : '✗ Incorrect'}
              </span>
            </div>
            <p className="whitespace-pre-line">{question.text}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {question.options.map((option) => {
                const isRight = option.key === question.correctAnswer;
                const isChosen = option.key === question.answerGiven;
                return (
                  <li
                    key={option.key}
                    className={`rounded-md px-3 py-1.5 ${isRight ? 'bg-verde/10 font-medium text-verde-dark' : isChosen ? 'bg-rosso/5 text-rosso' : 'text-stone-600'}`}
                  >
                    <span className="font-bold">{option.key}.</span> {option.text}
                    {isChosen && <span className="ml-2 text-xs">(votre réponse)</span>}
                  </li>
                );
              })}
            </ul>
            {question.explanation && <p className="mt-3 rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-700">{question.explanation}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
