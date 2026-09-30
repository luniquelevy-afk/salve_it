import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/auth-context';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { ANNOUNCEMENT_TARGET_LABELS, type Announcement, type AnnouncementTarget, type ClassSummary } from '../../lib/types';
import { useScrollToHash } from '../../hooks/useScrollToHash';

export function AnnouncementsPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const isStaff = me?.role === 'teacher' || isAdmin;
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  useScrollToHash(announcements !== null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [form, setForm] = useState<{ title: string; body: string; target: AnnouncementTarget; classId: string }>({
    title: '',
    body: '',
    target: isAdmin ? 'all' : 'class',
    classId: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAnnouncements((await api<{ announcements: Announcement[] }>('/api/announcements')).announcements);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les annonces.');
    }
  }, []);

  useEffect(() => {
    void load();
    if (isStaff) {
      api<{ classes: ClassSummary[] }>('/api/classes')
        .then((response) => setClasses(response.classes.filter((klass) => klass.isActive)))
        .catch(() => setClasses([]));
    }
  }, [load, isStaff]);

  // EF-29 : un enseignant publie uniquement pour ses classes.
  const targets: AnnouncementTarget[] = isAdmin ? ['all', 'students', 'teachers', 'class'] : ['class'];

  async function publish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/announcements', {
        method: 'POST',
        body: { title: form.title, body: form.body, target: form.target, classId: form.target === 'class' ? form.classId : null },
      });
      setForm({ ...form, title: '', body: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Publication impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(announcement: Announcement) {
    if (!window.confirm(`Supprimer l’annonce « ${announcement.title} » ?`)) return;
    try {
      await api(`/api/announcements/${announcement.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Annonces</h1>
      <ErrorBanner message={error} />

      {isStaff && (isAdmin || classes.length > 0) && (
        <form id="publier" onSubmit={publish} className="card scroll-mt-20 space-y-4">
          <h2 className="font-semibold">Nouvelle annonce</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="a-target">Destinataires</label>
              <select id="a-target" className="input" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as AnnouncementTarget })}>
                {targets.map((target) => (
                  <option key={target} value={target}>
                    {ANNOUNCEMENT_TARGET_LABELS[target]}
                  </option>
                ))}
              </select>
            </div>
            {form.target === 'class' && (
              <div>
                <label className="label" htmlFor="a-class">Classe</label>
                <select id="a-class" className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {classes.map((klass) => (
                    <option key={klass.id} value={klass.id}>
                      {klass.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="a-title">Titre</label>
            <input id="a-title" className="input" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="a-body">Message</label>
            <textarea id="a-body" className="input min-h-28" required maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Publication…' : 'Publier'}
          </button>
        </form>
      )}

      {announcements?.length === 0 && <p className="text-stone-500">Aucune annonce.</p>}
      {announcements?.map((announcement) => (
        <article key={announcement.id} className="card space-y-1">
          <div className="flex flex-wrap items-start gap-2">
            <h2 className="font-semibold">{announcement.title}</h2>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
              {announcement.className ?? ANNOUNCEMENT_TARGET_LABELS[announcement.target]}
            </span>
            {announcement.canDelete && (
              <button className="btn-danger ml-auto px-3 py-1 text-xs" onClick={() => void remove(announcement)}>
                Supprimer
              </button>
            )}
          </div>
          <p className="whitespace-pre-line text-stone-700">{announcement.body}</p>
          <p className="text-xs text-stone-400">
            {formatDateTime(announcement.publishedAt)}
            {announcement.authorName && ` · ${announcement.authorName}`}
          </p>
        </article>
      ))}
    </div>
  );
}
