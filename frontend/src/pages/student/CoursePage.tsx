import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CourseContent } from '../../components/CourseContent';
import { PronunciationAssistant } from '../../components/course/PronunciationAssistant';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { collectItalianSnippets, parseMarkdown } from '../../lib/markdown';
import { COURSE_TYPE_LABELS, EXERCISE_TYPE_LABELS, type Course, type ExerciseType } from '../../lib/types';

interface CourseResponse {
  course: Course;
  exercises: { id: string; title: string; exerciseType: ExerciseType }[];
}

export function CoursePage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<CourseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const body = data?.course.contentType === 'text' ? (data.course.body ?? '') : '';
  const words = useMemo(() => (body ? collectItalianSnippets(parseMarkdown(body)) : []), [body]);

  useEffect(() => {
    api<CourseResponse>(`/api/courses/${id}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le cours.'));
  }, [id]);

  if (error) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        <Link to="/etudiant/cours" className="btn-secondary">
          Retour aux cours
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-stone-500">Chargement…</p>;

  const { course, exercises } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PronunciationAssistant words={words} />
      <Link to="/etudiant/cours" className="text-sm text-verde-dark hover:underline">
        ← Tous les cours
      </Link>
      <div>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-verde/10 px-2 py-0.5 font-semibold text-verde-dark">{course.level}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{COURSE_TYPE_LABELS[course.contentType]}</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{course.category}</span>
        </div>
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.description && <p className="mt-1 text-stone-600">{course.description}</p>}
      </div>

      <div className="card">
        <CourseContent course={course} />
      </div>

      {exercises.length > 0 && (
        <section className="card space-y-2">
          <h2 className="font-semibold">S’entraîner</h2>
          {exercises.map((exercise) => (
            <Link key={exercise.id} to={`/etudiant/exercices/${exercise.id}`} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 hover:bg-stone-50">
              <span>{exercise.title}</span>
              <span className="text-xs text-stone-500">{EXERCISE_TYPE_LABELS[exercise.exerciseType]} →</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
