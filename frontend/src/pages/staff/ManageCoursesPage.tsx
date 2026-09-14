import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CourseContent } from '../../components/CourseContent';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { CEFR_LEVELS, COURSE_TYPE_LABELS, type CefrLevel, type ClassSummary, type Course, type CourseContentType } from '../../lib/types';

interface Draft {
  id: string | null;
  title: string;
  description: string;
  level: CefrLevel;
  category: string;
  contentType: CourseContentType;
  body: string;
  contentUrl: string;
  classId: string;
  isPublished: boolean;
}

const EMPTY: Draft = { id: null, title: '', description: '', level: 'A1', category: '', contentType: 'text', body: '', contentUrl: '', classId: '', isPublished: false };

export function ManageCoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCourses((await api<{ courses: Course[] }>('/api/manage/courses')).courses);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les cours.');
    }
  }, []);

  useEffect(() => {
    void load();
    api<{ classes: ClassSummary[] }>('/api/classes')
      .then((response) => setClasses(response.classes))
      .catch(() => setClasses([]));
  }, [load]);

  function edit(course: Course) {
    setDraft({
      id: course.id,
      title: course.title,
      description: course.description ?? '',
      level: course.level,
      category: course.category,
      contentType: course.contentType,
      body: course.body ?? '',
      contentUrl: course.contentUrl ?? '',
      classId: course.classId ?? '',
      isPublished: course.isPublished,
    });
    setPreview(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const body = {
      title: draft.title,
      description: draft.description || null,
      level: draft.level,
      category: draft.category,
      contentType: draft.contentType,
      body: draft.contentType === 'text' ? draft.body : null,
      contentUrl: draft.contentType === 'text' ? null : draft.contentUrl,
      classId: draft.classId || null,
      isPublished: draft.isPublished,
    };
    try {
      await api(draft.id ? `/api/manage/courses/${draft.id}` : '/api/manage/courses', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(course: Course) {
    if (!window.confirm(`Supprimer le cours « ${course.title} » ? Les exercices rattachés seront détachés.`)) return;
    try {
      await api(`/api/manage/courses/${course.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  const className = (id: string | null) => classes.find((klass) => klass.id === id)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Gestion des cours</h1>
        <button className="btn-primary ml-auto" onClick={() => setDraft(draft ? null : EMPTY)}>
          {draft ? 'Fermer' : 'Nouveau cours'}
        </button>
      </div>

      <ErrorBanner message={error} />

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="font-semibold">{draft.id ? 'Modifier le cours' : 'Nouveau cours'}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-title">Titre</label>
              <input id="c-title" className="input" required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-description">Description courte</label>
              <input id="c-description" className="input" maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="c-level">Niveau</label>
                <select id="c-level" className="input" value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as CefrLevel })}>
                  {CEFR_LEVELS.map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="c-category">Catégorie</label>
                <input id="c-category" className="input" required maxLength={60} placeholder="grammaire, oral…" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="c-type">Type</label>
                <select id="c-type" className="input" value={draft.contentType} onChange={(e) => setDraft({ ...draft, contentType: e.target.value as CourseContentType })}>
                  {(Object.keys(COURSE_TYPE_LABELS) as CourseContentType[]).map((type) => (
                    <option key={type} value={type}>
                      {COURSE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="c-class">Visibilité</label>
                <select id="c-class" className="input" value={draft.classId} onChange={(e) => setDraft({ ...draft, classId: e.target.value })}>
                  <option value="">Tous les étudiants</option>
                  {classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      Classe : {klass.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {draft.contentType === 'text' ? (
            <div>
              <label className="label" htmlFor="c-body">Contenu</label>
              <textarea id="c-body" className="input min-h-48 font-mono text-sm" required value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="c-url">Lien (https)</label>
              <input
                id="c-url"
                type="url"
                className="input"
                required
                pattern="https://.*"
                placeholder={draft.contentType === 'video' ? 'https://www.youtube.com/watch?v=…' : 'https://…'}
                value={draft.contentUrl}
                onChange={(e) => setDraft({ ...draft, contentUrl: e.target.value })}
              />
              <p className="mt-1 text-xs text-stone-500">Hébergez les fichiers volumineux sur un service adapté (YouTube, Drive…) : les étudiants ont souvent une connexion limitée.</p>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-verde" checked={draft.isPublished} onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })} />
            Publié (visible par les étudiants)
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPreview((open) => !open)}>
              {preview ? 'Masquer l’aperçu' : 'Aperçu'}
            </button>
          </div>

          {preview && (
            <div className="rounded-lg border border-dashed border-stone-300 p-4">
              <CourseContent
                course={{ ...draft, id: draft.id ?? 'preview', description: draft.description || null, body: draft.body, contentUrl: draft.contentUrl, classId: draft.classId || null, publishedAt: null, updatedAt: '' }}
              />
            </div>
          )}
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Cours</th>
              <th className="px-4 py-3">Niveau</th>
              <th className="px-4 py-3">Visibilité</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {courses?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-stone-500">
                  Aucun cours.
                </td>
              </tr>
            )}
            {courses?.map((course) => (
              <tr key={course.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{course.title}</div>
                  <div className="text-xs text-stone-500">
                    {COURSE_TYPE_LABELS[course.contentType]} · {course.category} · modifié le {formatDateTime(course.updatedAt)}
                  </div>
                </td>
                <td className="px-4 py-3">{course.level}</td>
                <td className="px-4 py-3">{course.classId ? (className(course.classId) ?? 'Classe') : 'Tous'}</td>
                <td className="px-4 py-3">
                  {course.isPublished ? (
                    <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-medium text-verde-dark">Publié</span>
                  ) : (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">Brouillon</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {course.canEdit && (
                    <div className="flex justify-end gap-2">
                      <button className="btn-secondary px-3 py-1 text-xs" onClick={() => edit(course)}>
                        Modifier
                      </button>
                      <button className="btn-danger px-3 py-1 text-xs" onClick={() => void remove(course)}>
                        Supprimer
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
