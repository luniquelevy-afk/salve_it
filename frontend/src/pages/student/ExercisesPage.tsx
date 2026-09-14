import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatPercent } from '../../lib/format';
import { CEFR_LEVELS, EXERCISE_TYPE_LABELS, type CefrLevel, type ExerciseSummary } from '../../lib/types';

type LevelFilter = CefrLevel | 'all' | '';

export function ExercisesPage() {
  const [level, setLevel] = useState<LevelFilter>('');
  const [data, setData] = useState<{ studentLevel: CefrLevel | null; exercises: ExerciseSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ studentLevel: CefrLevel | null; exercises: ExerciseSummary[] }>(`/api/exercises${level ? `?level=${level}` : ''}`)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les exercices.'));
  }, [level]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exercices</h1>
          <p className="text-stone-600">Correction immédiate, recommencez autant de fois que vous voulez.</p>
        </div>
        <select className="input ml-auto w-auto" aria-label="Niveau" value={level} onChange={(e) => setLevel(e.target.value as LevelFilter)}>
          <option value="">Mon niveau</option>
          <option value="all">Tous les niveaux</option>
          {CEFR_LEVELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <ErrorBanner message={error} />
      {data && data.exercises.length === 0 && <p className="text-stone-500">Aucun exercice disponible pour ce filtre.</p>}

      <div className="card divide-y divide-stone-100 p-0">
        {data?.exercises.map((exercise) => (
          <Link key={exercise.id} to={`/etudiant/exercices/${exercise.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-stone-50">
            <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-semibold text-verde-dark">{exercise.level}</span>
            <span className="font-medium">{exercise.title}</span>
            <span className="text-xs text-stone-500">
              {EXERCISE_TYPE_LABELS[exercise.exerciseType]} · {exercise.category}
            </span>
            <span className="ml-auto text-sm text-stone-600">
              {exercise.bestScore
                ? `Meilleur score : ${exercise.bestScore.score}/${exercise.bestScore.maxScore} (${formatPercent(exercise.bestScore.score, exercise.bestScore.maxScore)})`
                : 'Pas encore fait'}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
