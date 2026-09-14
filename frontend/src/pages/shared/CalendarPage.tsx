import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { AttendanceSheet } from '../../components/AttendanceSheet';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDay, formatTime, localDayKey } from '../../lib/format';
import type { ClassSession, ClassSummary } from '../../lib/types';

const EMPTY_FORM = { classId: '', title: '', date: '', startTime: '18:00', endTime: '19:30', location: '' };

export function CalendarPage() {
  const { me } = useAuth();
  const isStaff = me?.role === 'teacher' || me?.role === 'admin';
  const [sessions, setSessions] = useState<ClassSession[] | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ sessions: ClassSession[] }>('/api/calendar');
      setSessions(response.sessions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le calendrier.');
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

  const days = useMemo(() => {
    const groups = new Map<string, ClassSession[]>();
    for (const session of sessions ?? []) {
      const key = localDayKey(session.startsAt);
      groups.set(key, [...(groups.get(key) ?? []), session]);
    }
    return [...groups.entries()];
  }, [sessions]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const startsAt = new Date(`${form.date}T${form.startTime}`);
    const endsAt = new Date(`${form.date}T${form.endTime}`);
    if (endsAt <= startsAt) return setError('L’heure de fin doit être après l’heure de début.');
    setSaving(true);
    setError(null);
    try {
      await api('/api/calendar', {
        method: 'POST',
        body: { classId: form.classId, title: form.title, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), location: form.location || null },
      });
      setForm({ ...EMPTY_FORM, classId: form.classId });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(session: ClassSession) {
    if (!window.confirm(`Supprimer la séance « ${session.title} » ?`)) return;
    try {
      await api(`/api/calendar/${session.id}`, { method: 'DELETE' });
      if (attendanceFor === session.id) setAttendanceFor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendrier des cours</h1>
          <p className="text-stone-600">Séances de la veille et des 60 prochains jours.</p>
        </div>
        {isStaff && classes.length > 0 && (
          <button className="btn-primary ml-auto" onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Fermer' : 'Ajouter une séance'}
          </button>
        )}
      </div>

      <ErrorBanner message={error} />

      {showForm && (
        <form onSubmit={create} className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="s-class">Classe</label>
            <select id="s-class" className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">— Choisir —</option>
              {classes.map((klass) => (
                <option key={klass.id} value={klass.id}>
                  {klass.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="s-title">Intitulé</label>
            <input id="s-title" className="input" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-date">Date</label>
            <input id="s-date" type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="s-start">Début</label>
              <input id="s-start" type="time" className="input" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="s-end">Fin</label>
              <input id="s-end" type="time" className="input" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-location">Lieu (facultatif)</label>
            <input id="s-location" className="input" maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {sessions !== null && sessions.length === 0 && (
        <p className="text-stone-500">{me?.role === 'student' ? 'Aucune séance prévue pour vos classes.' : 'Aucune séance prévue.'}</p>
      )}

      {days.map(([day, daySessions]) => (
        <section key={day} className="space-y-2">
          <h2 className="font-semibold text-stone-700">{formatDay(daySessions[0]!.startsAt)}</h2>
          {daySessions.map((session) => (
            <div key={session.id} className="space-y-2">
              <article className="card flex flex-wrap items-center gap-3 py-3">
                <span className="font-mono text-sm font-semibold tabular-nums text-verde-dark">
                  {formatTime(session.startsAt)} – {formatTime(session.endsAt)}
                </span>
                <div>
                  <p className="font-medium">{session.title}</p>
                  <p className="text-xs text-stone-500">
                    {session.className}
                    {session.location && ` · ${session.location}`}
                  </p>
                </div>
                {session.canManage && (
                  <div className="ml-auto flex gap-2">
                    <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setAttendanceFor(attendanceFor === session.id ? null : session.id)}>
                      {attendanceFor === session.id ? 'Masquer la présence' : 'Présence'}
                    </button>
                    <button className="btn-danger px-3 py-1 text-xs" onClick={() => void remove(session)}>
                      Supprimer
                    </button>
                  </div>
                )}
              </article>
              {attendanceFor === session.id && <AttendanceSheet sessionId={session.id} onClose={() => setAttendanceFor(null)} />}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
