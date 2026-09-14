import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { CEFR_LEVELS, COURSE_TYPE_LABELS, type CefrLevel, type Course } from '../../lib/types';

type LevelFilter = CefrLevel | 'all' | '';

export function CoursesPage() {
  const [level, setLevel] = useState<LevelFilter>('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState<{ studentLevel: CefrLevel | null; courses: Course[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = level ? `?level=${level}` : '';
    api<{ studentLevel: CefrLevel | null; courses: Course[] }>(`/api/courses${query}`)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les cours.'));
  }, [level]);

  const categories = useMemo(() => [...new Set(data?.courses.map((course) => course.category) ?? [])].sort(), [data]);
  const courses = data?.courses.filter((course) => !category || course.category === category) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cours</h1>
        <p className="text-stone-600">
          {data?.studentLevel ? `Cours de votre niveau (${data.studentLevel}) par défaut.` : 'Ressources pédagogiques du centre.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" aria-label="Niveau" value={level} onChange={(e) => setLevel(e.target.value as LevelFilter)}>
          <option value="">Mon niveau</option>
          <option value="all">Tous les niveaux</option>
          {CEFR_LEVELS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Link to="/etudiant/exercices" className="btn-secondary ml-auto">
          Exercices
        </Link>
      </div>

      <ErrorBanner message={error} />
      {!data && !error && <p className="text-stone-500">Chargement…</p>}
      {data && courses.length === 0 && <p className="text-stone-500">Aucun cours disponible pour ce filtre.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <Link key={course.id} to={`/etudiant/cours/${course.id}`} className="card block transition hover:border-verde/40 hover:shadow-md">
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-verde/10 px-2 py-0.5 font-semibold text-verde-dark">{course.level}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{COURSE_TYPE_LABELS[course.contentType]}</span>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{course.category}</span>
            </div>
            <h2 className="font-semibold">{course.title}</h2>
            {course.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{course.description}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
