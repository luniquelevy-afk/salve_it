import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { PronunciationAssistant } from '../../components/course/PronunciationAssistant';
import { api, ApiError } from '../../lib/api';
import { useStudentView } from '../../lib/student-view';
import { StudentViewBanner } from '../../components/course/StudentViewBanner';
import { formatPercent } from '../../lib/format';
import { EXERCISE_TYPE_LABELS, type ExerciseDetail, type GapFillContent, type GradeResult, type MatchingContent, type QcmContent } from '../../lib/types';

type Answers = Record<string, string>;
type ItemResult = GradeResult['items'][number] | undefined;

function feedbackClass(item: ItemResult): string {
  if (!item) return 'border-stone-300';
  return item.correct ? 'border-verde bg-verde/5' : 'border-rosso bg-rosso/5';
}

function QcmPlayer({ content, answers, onAnswer, result }: { content: QcmContent; answers: Answers; onAnswer: (id: string, value: string) => void; result: GradeResult | null }) {
  return (
    <div className="space-y-5">
      {content.questions.map((question, index) => {
        const item = result?.items.find((candidate) => candidate.id === question.id);
        return (
          <fieldset key={question.id} className="space-y-2">
            <legend className="font-medium">
              {index + 1}. {question.text}
            </legend>
            {question.options.map((option) => {
              const isExpected = item && option.key === item.expected;
              const isWrongChoice = item && !item.correct && option.key === answers[question.id];
              return (
                <label
                  key={option.key}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${isExpected ? 'border-verde bg-verde/10' : isWrongChoice ? 'border-rosso bg-rosso/5' : 'border-stone-200'}`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    className="accent-verde"
                    disabled={result !== null}
                    checked={answers[question.id] === option.key}
                    onChange={() => onAnswer(question.id, option.key)}
                  />
                  {option.text}
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}

function GapFillPlayer({ content, answers, onAnswer, result }: { content: GapFillContent; answers: Answers; onAnswer: (id: string, value: string) => void; result: GradeResult | null }) {
  return (
    <p className="text-lg leading-loose">
      {content.segments.map((segment, index) => {
        if (segment.type === 'text') return <span key={index} className="whitespace-pre-line">{segment.value}</span>;
        const item = result?.items.find((candidate) => candidate.id === segment.id);
        return (
          <span key={segment.id} className="inline-flex flex-col align-baseline">
            <input
              aria-label={`Trou ${segment.id.slice(1)}`}
              className={`mx-1 w-32 rounded-md border-b-2 bg-white px-2 py-0.5 text-base outline-none focus:border-verde ${feedbackClass(item)}`}
              disabled={result !== null}
              autoCapitalize="off"
              autoComplete="off"
              spellCheck={false}
              value={answers[segment.id] ?? ''}
              onChange={(e) => onAnswer(segment.id, e.target.value)}
            />
            {item && !item.correct && <span className="mx-1 text-xs text-verde-dark">{item.expected}</span>}
          </span>
        );
      })}
    </p>
  );
}

function MatchingPlayer({ content, answers, onAnswer, result }: { content: MatchingContent; answers: Answers; onAnswer: (id: string, value: string) => void; result: GradeResult | null }) {
  return (
    <div className="space-y-2">
      {content.left.map((left) => {
        const item = result?.items.find((candidate) => candidate.id === left.id);
        const expectedText = content.right.find((right) => right.id === item?.expected)?.text;
        return (
          <div key={left.id} className={`grid items-center gap-2 rounded-lg border px-3 py-2 sm:grid-cols-2 ${feedbackClass(item)}`}>
            <span className="font-medium">{left.text}</span>
            <div>
              <select className="input" aria-label={`Associer « ${left.text} »`} disabled={result !== null} value={answers[left.id] ?? ''} onChange={(e) => onAnswer(left.id, e.target.value)}>
                <option value="">— Choisir —</option>
                {content.right.map((right) => (
                  <option key={right.id} value={right.id}>
                    {right.text}
                  </option>
                ))}
              </select>
              {item && !item.correct && <p className="mt-1 text-xs text-verde-dark">Réponse attendue : {expectedText}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function itemCount(exercise: ExerciseDetail): number {
  if (exercise.exerciseType === 'qcm') return (exercise.content as QcmContent).questions.length;
  if (exercise.exerciseType === 'appariement') return (exercise.content as MatchingContent).left.length;
  return (exercise.content as GapFillContent).segments.filter((segment) => segment.type === 'gap').length;
}

export function ExercisePage() {
  const { id = '' } = useParams();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = useStudentView();

  useEffect(() => {
    api<{ exercise: ExerciseDetail }>(view.api.exercise(id))
      .then((response) => setExercise(response.exercise))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger l’exercice.'));
  }, [id, view.api]);

  const setAnswer = (itemId: string, value: string) => setAnswers((current) => ({ ...current, [itemId]: value }));

  async function submit() {
    if (!exercise) return;
    const answered = Object.values(answers).filter((value) => value.trim()).length;
    if (answered < itemCount(exercise) && !window.confirm('Certaines réponses sont vides. Valider quand même ?')) return;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await api<GradeResult>(view.api.attempt(id), { method: 'POST', body: { answers } }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Correction impossible. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setAnswers({});
    setResult(null);
  }

  if (!exercise) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const playerProps = { answers, onAnswer: setAnswer, result };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <StudentViewBanner />
      <PronunciationAssistant />
      <Link to={exercise.courseId ? view.paths.course(exercise.courseId) : view.paths.exercises} className="text-sm text-verde-dark hover:underline">
        ← Retour
      </Link>
      <div>
        <p className="text-xs text-stone-500">
          {exercise.level} · {EXERCISE_TYPE_LABELS[exercise.exerciseType]} · {exercise.category}
        </p>
        <h1 className="text-2xl font-bold">{exercise.title}</h1>
        {exercise.instructions && <p className="mt-1 text-stone-600">{exercise.instructions}</p>}
        {exercise.exerciseType === 'texte_a_trous' && !exercise.instructions && <p className="mt-1 text-stone-600">Complétez les trous. Attention aux accents.</p>}
      </div>

      {result && (
        <div className={`card flex flex-wrap items-center gap-4 ${result.score === result.maxScore ? 'border-verde/40 bg-verde/5' : ''}`} role="status">
          <p className="text-3xl font-bold">
            {result.score}
            <span className="text-lg text-stone-400"> / {result.maxScore}</span>
          </p>
          <p className="text-stone-700">{result.score === result.maxScore ? 'Parfait, tout est juste !' : `${formatPercent(result.score, result.maxScore)} de bonnes réponses. Les corrections sont indiquées ci-dessous.`}</p>
          <button className="btn-secondary ml-auto" onClick={retry}>
            Recommencer
          </button>
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="card">
        {exercise.exerciseType === 'qcm' && <QcmPlayer content={exercise.content as QcmContent} {...playerProps} />}
        {exercise.exerciseType === 'texte_a_trous' && <GapFillPlayer content={exercise.content as GapFillContent} {...playerProps} />}
        {exercise.exerciseType === 'appariement' && <MatchingPlayer content={exercise.content as MatchingContent} {...playerProps} />}
      </div>

      {!result && (
        <button className="btn-primary" disabled={submitting} onClick={() => void submit()}>
          {submitting ? 'Correction…' : 'Valider mes réponses'}
        </button>
      )}
    </div>
  );
}
