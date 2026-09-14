import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HomeworkStateBadge } from '../../components/ClassWorkPanels';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Meter } from '../../components/Meter';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { ATTENDANCE_LABELS, type HomeworkState, type MyAttendance, type MyHomework } from '../../lib/types';

// Ce qui demande une action d'abord, puis ce qui est rendu ou validé.
const ORDER: Record<HomeworkState, number> = { a_reprendre: 0, en_retard: 1, a_faire: 2, rendu: 3, valide: 4 };

// §13 : devoirs de l'étudiant et sa présence aux séances.
export function HomeworkPage() {
  const [homework, setHomework] = useState<MyHomework[] | null>(null);
  const [attendance, setAttendance] = useState<MyAttendance | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [homeworkResponse, attendanceResponse] = await Promise.all([
        api<{ homework: MyHomework[] }>('/api/student/work/homework'),
        api<MyAttendance>('/api/student/work/attendance'),
      ]);
      setHomework(homeworkResponse.homework);
      setAttendance(attendanceResponse);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger vos devoirs.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(item: MyHomework) {
    setBusyId(item.id);
    setError(null);
    try {
      await api(`/api/student/work/homework/${item.id}/submission`, { method: 'PUT', body: { answer: drafts[item.id]?.trim() || null } });
      setOpenId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Envoi impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...(homework ?? [])].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes devoirs</h1>
        <p className="text-stone-600">Les devoirs de vos classes et votre présence aux séances.</p>
      </div>

      <ErrorBanner message={error} />

      {attendance && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-semibold">Ma présence (90 derniers jours)</h2>
            {attendance.summary.ratePercent !== null && <span className="text-2xl font-bold tabular-nums">{attendance.summary.ratePercent} %</span>}
          </div>
          {attendance.summary.recorded === 0 ? (
            <p className="text-sm text-stone-500">Aucune présence enregistrée pour le moment.</p>
          ) : (
            <>
              {attendance.summary.ratePercent !== null && <Meter value={attendance.summary.ratePercent} label="Taux de présence" />}
              <p className="text-xs text-stone-500">
                {attendance.summary.present} présence(s) · {attendance.summary.late} retard(s) · {attendance.summary.absent} absence(s) · {attendance.summary.excused} excusée(s)
              </p>
              <ul className="divide-y divide-stone-100 text-sm">
                {attendance.records.slice(0, 8).map((record) => (
                  <li key={`${record.startsAt}-${record.title}`} className="flex flex-wrap gap-x-3 py-1.5">
                    <span className="text-stone-500">{formatDateTime(record.startsAt)}</span>
                    <span>{record.title}</span>
                    <span className="ml-auto font-medium">{ATTENDANCE_LABELS[record.attendance]}</span>
                    {record.note && <span className="w-full text-xs text-stone-500">{record.note}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {homework && homework.length === 0 && <p className="text-stone-500">Aucun devoir pour vos classes ces dernières semaines.</p>}

      <ul className="space-y-3">
        {sorted.map((item) => {
          const canSubmit = item.state !== 'valide';
          const draft = drafts[item.id] ?? item.submission?.answer ?? '';
          return (
            <li key={item.id} className="card space-y-2">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="text-xs text-stone-500">
                    {item.className} · à rendre avant le {formatDateTime(item.dueAt)}
                  </p>
                </div>
                <HomeworkStateBadge state={item.state} />
              </div>

              {item.instructions && <p className="whitespace-pre-line text-sm text-stone-700">{item.instructions}</p>}
              {(item.course || item.exercise) && (
                <p className="flex flex-wrap gap-3 text-sm">
                  {item.course && (
                    <Link to={`/etudiant/cours/${item.course.id}`} className="text-verde-dark hover:underline">
                      Cours : {item.course.title ?? 'ouvrir'}
                    </Link>
                  )}
                  {item.exercise && (
                    <Link to={`/etudiant/exercices/${item.exercise.id}`} className="text-verde-dark hover:underline">
                      Exercice : {item.exercise.title ?? 'ouvrir'}
                    </Link>
                  )}
                </p>
              )}

              {item.submission?.teacherComment && (
                <p className={`rounded-md px-3 py-2 text-sm ${item.state === 'a_reprendre' ? 'bg-amber-50 text-amber-900' : 'bg-stone-50 text-stone-700'}`}>
                  <span className="font-semibold">Commentaire de l’enseignant :</span> {item.submission.teacherComment}
                </p>
              )}
              {item.submission && (
                <p className="text-xs text-stone-500">
                  Rendu le {formatDateTime(item.submission.submittedAt)}
                  {item.submission.late && ' (après la date limite)'}
                </p>
              )}

              {canSubmit &&
                (openId === item.id ? (
                  <div className="space-y-2">
                    <label className="label" htmlFor={`answer-${item.id}`}>
                      Votre réponse (facultatif)
                    </label>
                    <textarea
                      id={`answer-${item.id}`}
                      className="input min-h-24"
                      maxLength={5000}
                      value={draft}
                      onChange={(e) => setDrafts({ ...drafts, [item.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busyId === item.id} onClick={() => void submit(item)}>
                        {busyId === item.id ? 'Envoi…' : item.submission ? 'Rendre à nouveau' : 'Rendre le devoir'}
                      </button>
                      <button className="btn-secondary" onClick={() => setOpenId(null)}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className={item.state === 'rendu' ? 'btn-secondary w-fit' : 'btn-primary w-fit'} onClick={() => setOpenId(item.id)}>
                    {item.state === 'rendu' ? 'Modifier mon rendu' : item.state === 'a_reprendre' ? 'Reprendre le devoir' : 'Rendre le devoir'}
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
