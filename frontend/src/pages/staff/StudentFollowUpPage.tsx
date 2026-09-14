import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { LearningPathPanel } from '../../components/LearningPathPanel';
import { ReadinessGauges } from '../../components/ReadinessGauges';
import { StaffDocumentsPanel } from '../../components/StaffDocumentsPanel';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatPercent, formatPoints } from '../../lib/format';
import { EMBASSY_STATUS_LABELS, MODE_LABELS, VISA_LABELS, type StudentFollowUp, type TeacherFeedback } from '../../lib/types';
import { PROFILE_LABELS } from '../student/ProfilePage';

type Target = { type: TeacherFeedback['targetType']; id: string; label: string };

function FeedbackForm({ studentId, target, onDone }: { studentId: string; target: Target; onDone: () => void }) {
  const [comment, setComment] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/teacher/feedback', {
        method: 'POST',
        body: { studentId, targetType: target.type, targetId: target.id, comment, followUpAt: followUpAt || null },
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 border-verde/40">
      <p className="text-sm font-semibold">Commentaire privé — {target.label}</p>
      <p className="text-xs text-stone-500">Visible par les enseignants de l’étudiant et l’administration uniquement, jamais par l’étudiant.</p>
      <ErrorBanner message={error} />
      <textarea className="input min-h-24" required maxLength={3000} aria-label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="feedback-follow-up">Date de suivi (facultatif)</label>
          <input id="feedback-follow-up" type="date" className="input" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary">
          Enregistrer
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Annuler
        </button>
      </div>
    </form>
  );
}

// EF-53 / §13 : fiche de suivi d'un étudiant pour son enseignant.
export function StudentFollowUpPage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<StudentFollowUp | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<StudentFollowUp>(`/api/teacher/students/${id}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la fiche.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(feedback: TeacherFeedback) {
    try {
      await api(`/api/teacher/feedback/${feedback.id}`, { method: 'PATCH', body: { status: feedback.status === 'traite' ? 'a_revoir' : 'traite' } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible.');
    }
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const { student, profile } = data;
  const feedbackCount = (targetId: string) => data.feedback.filter((feedback) => feedback.targetId === targetId).length;
  const profileItems = [
    ['Objectif', profile.studyObjective && PROFILE_LABELS.objective[profile.studyObjective]],
    ['Domaine', profile.desiredField],
    ['Étape du projet', profile.projectStage && PROFILE_LABELS.stage[profile.projectStage]],
    ['Rentrée visée', profile.targetIntake],
    ['Test visé', profile.targetTemplate?.name],
    ['Villes', profile.preferredCities.join(', ')],
    ['Financement', profile.financingSource && PROFILE_LABELS.financing[profile.financingSource]],
    ['Budget mensuel', profile.budgetRange && PROFILE_LABELS.budget[profile.budgetRange]],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Link to="/enseignant" className="text-sm text-verde-dark hover:underline">
            ← Tableau de bord
          </Link>
          <h1 className="text-2xl font-bold">{student.fullName}</h1>
          <p className="text-stone-600">
            Niveau {student.level ?? '—'}
            {student.status !== 'active' && ' · compte suspendu'}
          </p>
        </div>
      </div>

      <ErrorBanner message={error} />
      {target && (
        <FeedbackForm
          studentId={student.id}
          target={target}
          onDone={() => {
            setTarget(null);
            void load();
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {data.learningPath ? (
          <LearningPathPanel
            readOnly
            objective={data.learningPath.objective}
            actions={data.learningPath.actions}
            weeklyGoals={data.learningPath.weeklyGoals}
            progressPercent={data.learningPath.progressPercent}
          />
        ) : (
          <section className="card text-sm text-stone-500">Le parcours sera généré à la prochaine connexion de l’étudiant.</section>
        )}
        <div className="space-y-6">
          <ReadinessGauges readiness={data.readiness} />
          <section className="card space-y-2">
            <h2 className="font-semibold">Profil</h2>
            {profileItems.length === 0 ? (
              <p className="text-sm text-stone-500">Profil non renseigné.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {profileItems.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-stone-500">{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
      </div>

      <StaffDocumentsPanel studentId={student.id} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Simulations</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Test</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3 text-right">Bonnes réponses</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.simulations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    Aucune simulation.
                  </td>
                </tr>
              )}
              {data.simulations.map((simulation) => (
                <tr key={simulation.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(simulation.startedAt)}</td>
                  <td className="px-4 py-3">{simulation.template?.name}</td>
                  <td className="px-4 py-3">{MODE_LABELS[simulation.mode]}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {simulation.correct === null ? '—' : `${simulation.correct} / ${simulation.totalQuestions} (${formatPercent(simulation.correct, simulation.totalQuestions)})`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPoints(simulation.score)}</td>
                  <td className="px-4 py-3 text-right">
                    {simulation.status === 'completed' && (
                      <button
                        className="text-verde-dark hover:underline"
                        onClick={() => setTarget({ type: 'simulation', id: simulation.id, label: `${simulation.template?.name} (${MODE_LABELS[simulation.mode]}) du ${formatDateTime(simulation.startedAt)}` })}
                      >
                        Commenter{feedbackCount(simulation.id) > 0 && ` (${feedbackCount(simulation.id)})`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Entretiens consulaires</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scénario</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.embassySessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    Aucun entretien.
                  </td>
                </tr>
              )}
              {data.embassySessions.map((session) => (
                <tr key={session.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(session.startedAt)}</td>
                  <td className="px-4 py-3">{VISA_LABELS[session.visaType]}</td>
                  <td className="px-4 py-3">{session.scenarioLabel ?? '—'}</td>
                  <td className="px-4 py-3">{EMBASSY_STATUS_LABELS[session.status]}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {session.overallScore ?? '—'}
                    {session.inconsistencyCount > 0 && (
                      <span className="ml-2 text-xs text-amber-800" title="Points de cohérence à clarifier">
                        ⚠ {session.inconsistencyCount}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/suivi/etudiants/${student.id}/entretiens/${session.id}`} className="block text-verde-dark hover:underline">
                      {session.status === 'completed' ? 'Rapport' : 'Transcript'}
                    </Link>
                    {session.status === 'completed' && (
                      <button
                        className="text-verde-dark hover:underline"
                        onClick={() => setTarget({ type: 'embassy_session', id: session.id, label: `entretien ${VISA_LABELS[session.visaType]} du ${formatDateTime(session.startedAt)}` })}
                      >
                        Commenter{feedbackCount(session.id) > 0 && ` (${feedbackCount(session.id)})`}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Commentaires privés</h2>
        {data.feedback.length === 0 && <p className="text-sm text-stone-500">Aucun commentaire pour le moment.</p>}
        {data.feedback.map((feedback) => (
          <article key={feedback.id} className="card space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span>{feedback.targetType === 'simulation' ? 'Simulation' : 'Entretien'}</span>
              <span>· {feedback.teacherName ?? 'Enseignant'}</span>
              <span>· {formatDateTime(feedback.createdAt)}</span>
              {feedback.followUpAt && <span>· suivi le {new Date(feedback.followUpAt).toLocaleDateString('fr-FR')}</span>}
              <span className={`ml-auto font-medium ${feedback.status === 'traite' ? 'text-stone-500' : 'text-stone-900'}`}>
                {feedback.status === 'traite' ? '✓ Traité' : '○ À revoir'}
              </span>
              {feedback.canEdit && (
                <button className="btn-secondary px-2 py-0.5 text-xs" onClick={() => void toggleStatus(feedback)}>
                  {feedback.status === 'traite' ? 'Rouvrir' : 'Marquer traité'}
                </button>
              )}
            </div>
            <p className="whitespace-pre-line text-stone-800">{feedback.comment}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
