import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ATTENDANCE_LABELS, type AttendanceStatus, type SessionAttendance } from '../lib/types';
import { ErrorBanner } from './ErrorBanner';

const STATUSES = Object.keys(ATTENDANCE_LABELS) as AttendanceStatus[];

type Entries = Record<string, { status: AttendanceStatus | null; note: string }>;

const toEntries = (sheet: SessionAttendance): Entries => Object.fromEntries(sheet.students.map((student) => [student.id, { status: student.attendance, note: student.note ?? '' }]));

// §13 : feuille de présence d'une séance (enseignant titulaire ou admin).
export function AttendanceSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [sheet, setSheet] = useState<SessionAttendance | null>(null);
  const [entries, setEntries] = useState<Entries>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionAttendance>(`/api/staff/sessions/${sessionId}/attendance`)
      .then((next) => {
        setSheet(next);
        setEntries(toEntries(next));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger la feuille de présence.'));
  }, [sessionId]);

  const update = (studentId: string, patch: Partial<Entries[string]>) => {
    setSaved(false);
    setEntries((current) => ({ ...current, [studentId]: { ...current[studentId]!, ...patch } }));
  };

  function markRemainingPresent() {
    setSaved(false);
    setEntries((current) => Object.fromEntries(Object.entries(current).map(([id, entry]) => [id, entry.status ? entry : { ...entry, status: 'present' as const }])));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await api<SessionAttendance>(`/api/staff/sessions/${sessionId}/attendance`, {
        method: 'PUT',
        body: {
          entries: Object.entries(entries)
            .filter(([, entry]) => entry.status !== null)
            .map(([studentId, entry]) => ({ studentId, status: entry.status, note: entry.note.trim() || null })),
        },
      });
      setSheet(next);
      setEntries(toEntries(next));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  const filled = Object.values(entries).filter((entry) => entry.status !== null).length;

  return (
    <div className="card space-y-3 border-verde/40">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">Présence{sheet ? ` — ${sheet.session.title}` : ''}</h3>
        <button className="btn-secondary ml-auto px-3 py-1 text-xs" onClick={onClose}>
          Fermer
        </button>
      </div>
      <ErrorBanner message={error} />
      {!sheet && !error && <p className="text-sm text-stone-500">Chargement…</p>}
      {sheet && sheet.students.length === 0 && <p className="text-sm text-stone-500">Aucun étudiant dans cette classe.</p>}
      {sheet && sheet.students.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2 pr-3">Étudiant</th>
                  <th className="py-2 pr-3">Présence</th>
                  <th className="py-2">Remarque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sheet.students.map((student) => {
                  const entry = entries[student.id] ?? { status: null, note: '' };
                  return (
                    <tr key={student.id}>
                      <td className="py-2 pr-3">
                        {student.fullName}
                        {student.status !== 'active' && <span className="ml-2 text-xs text-rosso">suspendu</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <fieldset className="flex flex-wrap gap-1">
                          <legend className="sr-only">Présence de {student.fullName}</legend>
                          {STATUSES.map((status) => (
                            <label
                              key={status}
                              className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${entry.status === status ? 'border-verde bg-verde/10 font-semibold text-verde-dark' : 'border-stone-200 text-stone-600'}`}
                            >
                              <input type="radio" className="sr-only" name={`attendance-${student.id}`} checked={entry.status === status} onChange={() => update(student.id, { status })} />
                              {ATTENDANCE_LABELS[status]}
                            </label>
                          ))}
                        </fieldset>
                      </td>
                      <td className="py-2">
                        <input
                          className="input py-1 text-xs"
                          maxLength={300}
                          aria-label={`Remarque pour ${student.fullName}`}
                          placeholder="Facultatif"
                          value={entry.note}
                          onChange={(e) => update(student.id, { note: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary px-3 py-1 text-xs" onClick={markRemainingPresent}>
              Marquer les autres présents
            </button>
            <button className="btn-primary" disabled={saving || filled === 0} onClick={() => void save()}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <span className="text-xs text-stone-500">
              {filled} / {sheet.students.length} saisi{filled > 1 ? 's' : ''}
            </span>
            {saved && (
              <span className="text-sm text-verde-dark" role="status">
                ✓ Présence enregistrée
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
