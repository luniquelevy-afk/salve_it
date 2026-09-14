import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiDownload, ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { HOMEWORK_STATE_LABELS, type ClassAttendance, type ClassHomework, type HomeworkDetail, type HomeworkState } from '../lib/types';
import { ErrorBanner } from './ErrorBanner';
import { Meter } from './Meter';

const STATE_STYLES: Record<HomeworkState, { icon: string; className: string }> = {
  a_faire: { icon: '○', className: 'text-stone-600' },
  en_retard: { icon: '⚠', className: 'text-amber-800' },
  rendu: { icon: '◔', className: 'text-stone-700' },
  valide: { icon: '✓', className: 'text-verde-dark' },
  a_reprendre: { icon: '↺', className: 'text-amber-800' },
};

// Statut porté par une icône et un libellé, jamais par la couleur seule.
export function HomeworkStateBadge({ state }: { state: HomeworkState }) {
  const style = STATE_STYLES[state];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${style.className}`}>
      <span aria-hidden>{style.icon}</span>
      {HOMEWORK_STATE_LABELS[state]}
    </span>
  );
}

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'classe';

// ── Présence et rapport ─────────────────────────────────────

export function ClassAttendancePanel({ classId, className }: { classId: string; className: string }) {
  const [data, setData] = useState<ClassAttendance | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api<ClassAttendance>(`/api/staff/classes/${classId}/attendance`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger la présence.'));
  }, [classId]);

  async function exportReport() {
    setExporting(true);
    setError(null);
    try {
      await apiDownload(`/api/staff/classes/${classId}/report`, `rapport-classe-${slug(className)}-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export impossible.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-semibold">Présence</h3>
          {data && <p className="text-xs text-stone-500">{data.pastSessions} séance(s) passée(s) · saisie depuis le calendrier</p>}
        </div>
        <button className="btn-secondary ml-auto px-3 py-1 text-xs" disabled={exporting} onClick={() => void exportReport()}>
          {exporting ? 'Export…' : 'Exporter le rapport de classe (CSV)'}
        </button>
      </div>
      <ErrorBanner message={error} />
      {data && data.students.length === 0 && <p className="text-sm text-stone-500">Aucun étudiant.</p>}
      {data && data.students.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-stone-200 text-xs uppercase text-stone-500">
              <tr>
                <th className="py-2 pr-3">Étudiant</th>
                <th className="w-40 py-2 pr-3">Taux</th>
                <th className="py-2 pr-2 text-right" title="Présent">
                  P
                </th>
                <th className="py-2 pr-2 text-right" title="En retard">
                  R
                </th>
                <th className="py-2 pr-2 text-right" title="Absent">
                  A
                </th>
                <th className="py-2 text-right" title="Excusé">
                  E
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.students.map((student) => (
                <tr key={student.id}>
                  <td className="py-2 pr-3">{student.fullName}</td>
                  <td className="py-2 pr-3">
                    {student.ratePercent === null ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right tabular-nums">{student.ratePercent} %</span>
                        <div className="flex-1">
                          <Meter value={student.ratePercent} label={`Présence de ${student.fullName}`} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{student.present}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{student.late}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{student.absent}</td>
                  <td className="py-2 text-right tabular-nums">{student.excused}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Devoirs ─────────────────────────────────────────────────

const EMPTY_FORM = { title: '', date: '', time: '18:00', instructions: '' };

export function ClassHomeworkPanel({ classId }: { classId: string }) {
  const [items, setItems] = useState<ClassHomework[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM | null>(null);
  const [detail, setDetail] = useState<HomeworkDetail | null>(null);
  const [rework, setRework] = useState<{ studentId: string; comment: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ homework: ClassHomework[] }>(`/api/staff/classes/${classId}/homework`)).homework);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les devoirs.');
    }
  }, [classId]);

  useEffect(() => {
    setItems(null);
    setDetail(null);
    setForm(null);
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    void run(async () => {
      await api(`/api/staff/classes/${classId}/homework`, {
        method: 'POST',
        body: { title: form.title, instructions: form.instructions.trim() || null, dueAt: new Date(`${form.date}T${form.time}`).toISOString() },
      });
      setForm(null);
      await load();
    });
  };

  const open = (item: ClassHomework) =>
    void run(async () => {
      setRework(null);
      setDetail(detail?.assignment.id === item.id ? null : await api<HomeworkDetail>(`/api/staff/homework/${item.id}`));
    });

  const remove = (item: ClassHomework) =>
    window.confirm(`Supprimer le devoir « ${item.title} » et tous les rendus des étudiants ?`) &&
    void run(async () => {
      await api(`/api/staff/homework/${item.id}`, { method: 'DELETE' });
      if (detail?.assignment.id === item.id) setDetail(null);
      await load();
    });

  const review = (studentId: string, status: 'valide' | 'a_reprendre', comment?: string) =>
    detail &&
    void run(async () => {
      setDetail(await api<HomeworkDetail>(`/api/staff/homework/${detail.assignment.id}/submissions/${studentId}`, { method: 'PUT', body: { status, comment: comment ?? null } }));
      setRework(null);
      await load();
    });

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold">Devoirs</h3>
        <button className="btn-primary ml-auto px-3 py-1 text-xs" onClick={() => setForm(form ? null : EMPTY_FORM)}>
          {form ? 'Fermer' : 'Nouveau devoir'}
        </button>
      </div>
      <ErrorBanner message={error} />

      {form && (
        <form onSubmit={create} className="grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="hw-title">
              Titre
            </label>
            <input id="hw-title" className="input" required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="hw-date">
              À rendre le
            </label>
            <input id="hw-date" type="date" className="input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="hw-time">
              Avant
            </label>
            <input id="hw-time" type="time" className="input" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="hw-instructions">
              Consignes
            </label>
            <textarea id="hw-instructions" className="input min-h-20" maxLength={5000} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              Publier le devoir
            </button>
            <span className="ml-3 text-xs text-stone-500">Les étudiants actifs de la classe sont notifiés.</span>
          </div>
        </form>
      )}

      {items && items.length === 0 && <p className="text-sm text-stone-500">Aucun devoir pour cette classe.</p>}
      <ul className="divide-y divide-stone-100">
        {items?.map((item) => {
          const missing = Math.max(0, item.counts.students - item.counts.submitted);
          const overdue = Date.parse(item.dueAt) < Date.now();
          return (
            <li key={item.id} className="space-y-2 py-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <button className="font-medium text-left hover:text-verde-dark hover:underline" onClick={() => open(item)}>
                  {item.title}
                </button>
                <span className="text-xs text-stone-500">à rendre le {formatDateTime(item.dueAt)}</span>
                <span className="ml-auto text-xs tabular-nums text-stone-600">
                  {item.counts.submitted} / {item.counts.students} rendu(s)
                  {item.counts.toReview > 0 && ` · ${item.counts.toReview} à corriger`}
                  {overdue && missing > 0 && <span className="text-amber-800"> · ⚠ {missing} non rendu(s)</span>}
                </span>
                <button className="text-xs text-rosso hover:underline" disabled={busy} onClick={() => remove(item)}>
                  Supprimer
                </button>
              </div>

              {detail?.assignment.id === item.id && (
                <div className="space-y-2 rounded-lg bg-stone-50 p-3">
                  {detail.assignment.instructions && <p className="whitespace-pre-line text-sm text-stone-700">{detail.assignment.instructions}</p>}
                  <ul className="divide-y divide-stone-200">
                    {detail.students.map((student) => (
                      <li key={student.id} className="space-y-1 py-2 text-sm">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium">{student.fullName}</span>
                          <HomeworkStateBadge state={student.state} />
                          {student.submittedAt && (
                            <span className="text-xs text-stone-500">
                              rendu le {formatDateTime(student.submittedAt)}
                              {student.late && ' (en retard)'}
                            </span>
                          )}
                          {(student.state === 'rendu' || student.state === 'a_reprendre' || student.state === 'valide') && (
                            <span className="ml-auto flex gap-2">
                              {student.state !== 'valide' && (
                                <button className="btn-primary px-2 py-0.5 text-xs" disabled={busy} onClick={() => review(student.id, 'valide')}>
                                  Valider
                                </button>
                              )}
                              <button
                                className="btn-secondary px-2 py-0.5 text-xs"
                                disabled={busy}
                                onClick={() => setRework(rework?.studentId === student.id ? null : { studentId: student.id, comment: student.teacherComment ?? '' })}
                              >
                                Demander une reprise
                              </button>
                            </span>
                          )}
                        </div>
                        {student.answer && <p className="whitespace-pre-line rounded bg-white px-3 py-2 text-stone-700">{student.answer}</p>}
                        {student.teacherComment && rework?.studentId !== student.id && <p className="text-xs text-stone-500">Votre commentaire : {student.teacherComment}</p>}
                        {rework?.studentId === student.id && (
                          <div className="flex flex-wrap items-end gap-2">
                            <textarea
                              className="input min-h-16 flex-1"
                              maxLength={2000}
                              aria-label={`Ce que ${student.fullName} doit reprendre`}
                              placeholder="Ce que l’étudiant doit reprendre (obligatoire)"
                              value={rework.comment}
                              onChange={(e) => setRework({ studentId: student.id, comment: e.target.value })}
                            />
                            <button className="btn-primary px-3 py-1 text-xs" disabled={busy || !rework.comment.trim()} onClick={() => review(student.id, 'a_reprendre', rework.comment)}>
                              Envoyer
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
