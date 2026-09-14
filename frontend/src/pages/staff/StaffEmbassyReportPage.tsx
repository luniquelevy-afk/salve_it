import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmbassyProgressPanel } from '../../components/EmbassyProgressPanel';
import { EmbassyReportView } from '../../components/EmbassyReportView';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { EMBASSY_STATUS_LABELS, VISA_LABELS, type EmbassyProgress, type EmbassySession } from '../../lib/types';

// V1.3 : rapport enseignant dédié — rapport complet (vue enseignant incluse), transcript et progression.
export function StaffEmbassyReportPage() {
  const { id = '', sessionId = '' } = useParams();
  const [data, setData] = useState<{ session: EmbassySession; progress: EmbassyProgress } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<{ session: EmbassySession; progress: EmbassyProgress }>(`/api/teacher/students/${id}/embassy-sessions/${sessionId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger le rapport.');
    }
  }, [id, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const { session, progress } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/suivi/etudiants/${id}`} className="text-sm text-verde-dark hover:underline">
          ← Fiche de l’étudiant
        </Link>
        <h1 className="text-2xl font-bold">Rapport d’entretien — {VISA_LABELS[session.visaType]}</h1>
        <p className="text-stone-600">
          {formatDateTime(session.startedAt)} · {session.scenario.label ?? 'Scénario retiré'} · {EMBASSY_STATUS_LABELS[session.status]} · {session.turnCount} réponse
          {session.turnCount > 1 ? 's' : ''}
        </p>
        <p className="text-sm text-stone-500">
          {session.usesProfile
            ? 'Profil transmis avec l’accord de l’étudiant : cohérence vérifiée face au profil et à l’entretien précédent.'
            : 'Profil non transmis : seules les contradictions internes à l’entretien sont relevées.'}
        </p>
      </div>

      <ErrorBanner message={error} />

      {session.costLimitReached && (
        <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-600">Entretien clôturé par la limite de coût par entretien.</p>
      )}

      {session.status === 'completed' && session.report ? (
        <EmbassyReportView report={session.report} audience="staff" />
      ) : (
        <p className="card text-sm text-stone-500">Aucun rapport pour cet entretien ({EMBASSY_STATUS_LABELS[session.status].toLowerCase()}).</p>
      )}

      <EmbassyProgressPanel progress={progress} audience="staff" />

      <section className="card space-y-3">
        <h2 className="font-semibold">Transcript</h2>
        {session.messages.length === 0 && <p className="text-sm text-stone-500">Aucun échange.</p>}
        {session.messages.map((message) => (
          <div key={message.sequenceNumber} className={`flex ${message.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${message.speaker === 'agent' ? 'rounded-tl-sm border border-stone-200 bg-white' : 'rounded-tr-sm bg-verde text-white'}`}
            >
              <p className={`mb-0.5 text-xs font-semibold ${message.speaker === 'agent' ? 'text-stone-500' : 'text-white/80'}`}>
                {message.speaker === 'agent' ? 'Agent consulaire' : 'Étudiant'}
              </p>
              <p className="whitespace-pre-line">{message.text}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
