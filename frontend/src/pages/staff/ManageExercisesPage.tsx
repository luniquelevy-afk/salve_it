import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { CEFR_LEVELS, EXERCISE_TYPE_LABELS, type CefrLevel, type Course, type ExerciseInput, type ExerciseType, type ManagedExercise } from '../../lib/types';

interface Draft {
  id: string | null;
  title: string;
  level: CefrLevel;
  category: string;
  instructions: string;
  courseId: string;
  isPublished: boolean;
  exercise: ExerciseInput;
}

function emptyInput(type: ExerciseType): ExerciseInput {
  if (type === 'qcm') return { type, questions: [{ text: '', options: ['', '', ''], correctIndex: 0 }] };
  if (type === 'texte_a_trous') return { type, text: '' };
  return { type, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
}

const emptyDraft = (): Draft => ({ id: null, title: '', level: 'A1', category: '', instructions: '', courseId: '', isPublished: false, exercise: emptyInput('qcm') });

function QcmEditor({ value, onChange }: { value: Extract<ExerciseInput, { type: 'qcm' }>; onChange: (next: ExerciseInput) => void }) {
  const update = (index: number, patch: Partial<(typeof value.questions)[number]>) =>
    onChange({ ...value, questions: value.questions.map((question, i) => (i === index ? { ...question, ...patch } : question)) });

  return (
    <div className="space-y-4">
      {value.questions.map((question, index) => (
        <fieldset key={index} className="space-y-2 rounded-lg border border-stone-200 p-3">
          <div className="flex items-center gap-2">
            <legend className="font-medium">Question {index + 1}</legend>
            {value.questions.length > 1 && (
              <button type="button" className="ml-auto text-xs text-rosso hover:underline" onClick={() => onChange({ ...value, questions: value.questions.filter((_, i) => i !== index) })}>
                Retirer
              </button>
            )}
          </div>
          <input className="input" required placeholder="Énoncé" maxLength={1000} value={question.text} onChange={(e) => update(index, { text: e.target.value })} />
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${index}`}
                className="accent-verde"
                aria-label={`Bonne réponse ${optionIndex + 1}`}
                checked={question.correctIndex === optionIndex}
                onChange={() => update(index, { correctIndex: optionIndex })}
              />
              <input
                className="input"
                required
                maxLength={300}
                placeholder={`Option ${optionIndex + 1}`}
                value={option}
                onChange={(e) => update(index, { options: question.options.map((current, i) => (i === optionIndex ? e.target.value : current)) })}
              />
            </div>
          ))}
          <div className="flex gap-3 text-xs">
            {question.options.length < 6 && (
              <button type="button" className="text-verde-dark hover:underline" onClick={() => update(index, { options: [...question.options, ''] })}>
                + Option
              </button>
            )}
            {question.options.length > 2 && (
              <button
                type="button"
                className="text-stone-500 hover:underline"
                onClick={() => update(index, { options: question.options.slice(0, -1), correctIndex: Math.min(question.correctIndex, question.options.length - 2) })}
              >
                − Option
              </button>
            )}
          </div>
        </fieldset>
      ))}
      {value.questions.length < 30 && (
        <button type="button" className="btn-secondary" onClick={() => onChange({ ...value, questions: [...value.questions, { text: '', options: ['', '', ''], correctIndex: 0 }] })}>
          + Ajouter une question
        </button>
      )}
    </div>
  );
}

function GapFillEditor({ value, onChange }: { value: Extract<ExerciseInput, { type: 'texte_a_trous' }>; onChange: (next: ExerciseInput) => void }) {
  const gaps = [...value.text.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]!);
  return (
    <div className="space-y-2">
      <textarea
        className="input min-h-32"
        required
        maxLength={5000}
        placeholder="Io [[sono]] Grâce e [[abito|vivo]] a Brazzaville."
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
      />
      <p className="text-xs text-stone-500">
        Écrivez chaque trou entre doubles crochets : <code>[[réponse]]</code>. Plusieurs réponses acceptées : <code>[[abito|vivo]]</code>. La casse est tolérée, les accents comptent.
      </p>
      <p className="text-sm text-stone-600">{gaps.length} trou(s) : {gaps.join(' · ') || '—'}</p>
    </div>
  );
}

function MatchingEditor({ value, onChange }: { value: Extract<ExerciseInput, { type: 'appariement' }>; onChange: (next: ExerciseInput) => void }) {
  const update = (index: number, side: 'left' | 'right', text: string) =>
    onChange({ ...value, pairs: value.pairs.map((pair, i) => (i === index ? { ...pair, [side]: text } : pair)) });
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">Saisissez les paires correctes : la colonne de droite sera mélangée pour l’étudiant.</p>
      {value.pairs.map((pair, index) => (
        <div key={index} className="flex items-center gap-2">
          <input className="input" required maxLength={200} placeholder="Italien" value={pair.left} onChange={(e) => update(index, 'left', e.target.value)} />
          <span aria-hidden>↔</span>
          <input className="input" required maxLength={200} placeholder="Français" value={pair.right} onChange={(e) => update(index, 'right', e.target.value)} />
          {value.pairs.length > 2 && (
            <button type="button" className="text-xs text-rosso hover:underline" onClick={() => onChange({ ...value, pairs: value.pairs.filter((_, i) => i !== index) })}>
              Retirer
            </button>
          )}
        </div>
      ))}
      {value.pairs.length < 15 && (
        <button type="button" className="btn-secondary" onClick={() => onChange({ ...value, pairs: [...value.pairs, { left: '', right: '' }] })}>
          + Ajouter une paire
        </button>
      )}
    </div>
  );
}

export function ManageExercisesPage() {
  const [exercises, setExercises] = useState<ManagedExercise[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setExercises((await api<{ exercises: ManagedExercise[] }>('/api/manage/exercises')).exercises);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les exercices.');
    }
  }, []);

  useEffect(() => {
    void load();
    api<{ courses: Course[] }>('/api/manage/courses')
      .then((response) => setCourses(response.courses))
      .catch(() => setCourses([]));
  }, [load]);

  function edit(exercise: ManagedExercise) {
    setDraft({
      id: exercise.id,
      title: exercise.title,
      level: exercise.level,
      category: exercise.category,
      instructions: exercise.instructions ?? '',
      courseId: exercise.courseId ?? '',
      isPublished: exercise.isPublished,
      exercise: exercise.input,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const body = {
      title: draft.title,
      level: draft.level,
      category: draft.category,
      instructions: draft.instructions || null,
      courseId: draft.courseId || null,
      isPublished: draft.isPublished,
      exercise: draft.exercise,
    };
    try {
      await api(draft.id ? `/api/manage/exercises/${draft.id}` : '/api/manage/exercises', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible. Vérifiez que chaque élément est rempli.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(exercise: ManagedExercise) {
    if (!window.confirm(`Supprimer l’exercice « ${exercise.title} » et ses tentatives ?`)) return;
    try {
      await api(`/api/manage/exercises/${exercise.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  const setExercise = (exercise: ExerciseInput) => draft && setDraft({ ...draft, exercise });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Gestion des exercices</h1>
        <button className="btn-primary ml-auto" onClick={() => setDraft(draft ? null : emptyDraft())}>
          {draft ? 'Fermer' : 'Nouvel exercice'}
        </button>
      </div>

      <ErrorBanner message={error} />

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="font-semibold">{draft.id ? 'Modifier l’exercice' : 'Nouvel exercice'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-title">Titre</label>
              <input id="e-title" className="input" required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="e-type">Type</label>
                <select
                  id="e-type"
                  className="input"
                  disabled={draft.id !== null}
                  value={draft.exercise.type}
                  onChange={(e) => setDraft({ ...draft, exercise: emptyInput(e.target.value as ExerciseType) })}
                >
                  {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((type) => (
                    <option key={type} value={type}>
                      {EXERCISE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="e-level">Niveau</label>
                <select id="e-level" className="input" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as CefrLevel })}>
                  {CEFR_LEVELS.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="e-category">Catégorie</label>
                <input id="e-category" className="input" required maxLength={60} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="e-course">Cours (facultatif)</label>
                <select id="e-course" className="input" value={draft.courseId} onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}>
                  <option value="">Aucun</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.level} · {course.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="e-instructions">Consigne</label>
              <input id="e-instructions" className="input" maxLength={1000} value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </div>
          </div>

          {draft.exercise.type === 'qcm' && <QcmEditor value={draft.exercise} onChange={setExercise} />}
          {draft.exercise.type === 'texte_a_trous' && <GapFillEditor value={draft.exercise} onChange={setExercise} />}
          {draft.exercise.type === 'appariement' && <MatchingEditor value={draft.exercise} onChange={setExercise} />}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-verde" checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} />
            Publié (visible par les étudiants)
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}

      <div className="card divide-y divide-stone-100 p-0">
        {exercises?.length === 0 && <p className="px-4 py-6 text-center text-stone-500">Aucun exercice.</p>}
        {exercises?.map((exercise) => (
          <div key={exercise.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-semibold text-verde-dark">{exercise.level}</span>
            <div>
              <p className="font-medium">{exercise.title}</p>
              <p className="text-xs text-stone-500">
                {EXERCISE_TYPE_LABELS[exercise.exerciseType]} · {exercise.category}
                {exercise.courseId && ` · ${courses.find((course) => course.id === exercise.courseId)?.title ?? 'cours'}`}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${exercise.isPublished ? 'bg-verde/10 text-verde-dark' : 'bg-stone-100 text-stone-600'}`}>
              {exercise.isPublished ? 'Publié' : 'Brouillon'}
            </span>
            {exercise.canEdit && (
              <div className="ml-auto flex gap-2">
                <button className="btn-secondary px-3 py-1 text-xs" onClick={() => edit(exercise)}>
                  Modifier
                </button>
                <button className="btn-danger px-3 py-1 text-xs" onClick={() => void remove(exercise)}>
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
