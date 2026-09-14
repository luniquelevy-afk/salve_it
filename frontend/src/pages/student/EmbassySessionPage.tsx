import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmbassyReportView } from '../../components/EmbassyReportView';
import { ErrorBanner } from '../../components/ErrorBanner';
import { RECOGNITION_ERROR_MESSAGES, speak, speechSupport, stopSpeaking, useSpeechRecognition } from '../../hooks/useSpeech';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { VISA_LABELS, type EmbassySession, type EmbassyTurnResult } from '../../lib/types';

const REPORT_POLL_MS = 4000;

export function EmbassySessionPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<EmbassySession | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textFallback, setTextFallback] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const questionShownAt = useRef(Date.now());
  const spokenSequence = useRef<number | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);

  const recognition = useSpeechRecognition((text) => setDraft((current) => (current ? `${current} ${text}` : text)));

  const load = useCallback(async () => {
    try {
      setSession(await api<EmbassySession>(`/api/embassy/sessions/${id}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion perdue. Réessayez.');
    }
  }, [id]);

  useEffect(() => {
    void load();
    return () => stopSpeaking();
  }, [load]);

  // Rapport généré en tâche de fond : on relit la session jusqu'à son arrivée.
  useEffect(() => {
    if (session?.status !== 'report_pending') return;
    const timer = setInterval(() => void load(), REPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [session?.status, load]);

  const lastMessage = session?.messages.at(-1);
  const voiceMode = session?.inputMode === 'voice' && !textFallback && speechSupport.recognition();

  const readQuestion = useCallback((text: string) => {
    setSpeaking(true);
    speak(text, () => setSpeaking(false));
  }, []);

  // Nouvelle question de l'agent : lecture vocale (mode oral) et départ du chrono de réponse.
  useEffect(() => {
    if (!session || session.status !== 'in_progress' || lastMessage?.speaker !== 'agent') return;
    if (spokenSequence.current === lastMessage.sequenceNumber) return;
    spokenSequence.current = lastMessage.sequenceNumber;
    questionShownAt.current = Date.now();
    if (session.inputMode === 'voice') readQuestion(lastMessage.text);
    transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session, lastMessage, readQuestion]);

  useEffect(() => {
    if (recognition.error && recognition.error !== 'no-speech') setTextFallback(true);
  }, [recognition.error]);

  async function send() {
    if (!session || !lastMessage || lastMessage.speaker !== 'agent') return;
    const text = draft.trim();
    if (!text) return;
    recognition.stop();
    stopSpeaking();
    setSending(true);
    setError(null);
    try {
      const result = await api<EmbassyTurnResult>(`/api/embassy/sessions/${id}/messages`, {
        method: 'POST',
        body: {
          text,
          expectedSequence: lastMessage.sequenceNumber,
          responseTimeSeconds: Math.round((Date.now() - questionShownAt.current) / 1000),
        },
      });
      setDraft('');
      if (result.ended) {
        await load();
      } else {
        setSession({
          ...session,
          turnCount: result.turnCount,
          messages: [...session.messages, { sequenceNumber: lastMessage.sequenceNumber + 1, speaker: 'student', text }, result.agentMessage],
        });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Réponse non envoyée. Vérifiez votre connexion et réessayez.');
      // La session a pu être interrompue côté serveur (incident IA) : on relit son état.
      if (err instanceof ApiError && err.status !== 0) await load();
    } finally {
      setSending(false);
    }
  }

  async function endInterview() {
    if (!window.confirm('Terminer l’entretien maintenant ? Un rapport sera généré si vous avez répondu à au moins deux questions.')) return;
    recognition.stop();
    stopSpeaking();
    try {
      setSession(await api<EmbassySession>(`/api/embassy/sessions/${id}/end`, { method: 'POST' }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    }
  }

  async function deleteSession() {
    if (!window.confirm('Supprimer définitivement cet entretien, son transcript et son rapport ?')) return;
    try {
      await api(`/api/embassy/sessions/${id}`, { method: 'DELETE' });
      navigate('/etudiant/entretien', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Suppression impossible.');
    }
  }

  if (!session) {
    return (
      <div className="space-y-3">
        <ErrorBanner message={error} />
        {error ? (
          <button className="btn-primary" onClick={() => void load()}>
            Réessayer
          </button>
        ) : (
          <p className="text-stone-500">Chargement…</p>
        )}
      </div>
    );
  }

  const inProgress = session.status === 'in_progress';
  const awaitingAnswer = inProgress && lastMessage?.speaker === 'agent';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entretien — {VISA_LABELS[session.visaType]}</h1>
          <p className="text-sm text-stone-600">
            {formatDateTime(session.startedAt)}
            {session.scenario.label && ` · ${session.scenario.label}`}
            {inProgress && ` · question ${Math.min(session.turnCount + 1, session.maxTurns)} / ${session.maxTurns}`}
          </p>
          {session.usesProfile && <p className="text-xs text-stone-500">Profil utilisé avec votre accord pour repérer les incohérences.</p>}
        </div>
        <Link to="/etudiant/entretien" className="btn-secondary ml-auto">
          Mes entretiens
        </Link>
      </div>

      <ErrorBanner message={error} />

      {session.costLimitReached && (
        <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-600">
          Cet entretien a été clôturé car sa limite d’utilisation a été atteinte. Le rapport porte sur les réponses déjà données.
        </p>
      )}

      {session.status === 'report_pending' && (
        <div className="card flex items-center gap-3" role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-verde border-t-transparent" aria-hidden />
          <span>Entretien terminé. Votre rapport est en cours de rédaction, cela peut prendre une minute…</span>
        </div>
      )}
      {session.status === 'failed' && (
        <ErrorBanner message="L’entretien a été interrompu suite à un incident technique. Aucun rapport n’a été généré ; vous pouvez en commencer un nouveau." />
      )}
      {session.status === 'abandoned' && (
        <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-600">L’entretien s’est terminé trop tôt pour produire un rapport (au moins deux réponses sont nécessaires).</p>
      )}

      {session.status === 'completed' && session.report && <EmbassyReportView report={session.report} />}

      <section className={inProgress ? 'space-y-3' : 'card space-y-3'}>
        {!inProgress && <h2 className="font-semibold">Transcript</h2>}
        {session.messages.map((message) => (
          <div key={message.sequenceNumber} className={`flex ${message.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${message.speaker === 'agent' ? 'rounded-tl-sm border border-stone-200 bg-white' : 'rounded-tr-sm bg-verde text-white'}`}
            >
              <p className={`mb-0.5 text-xs font-semibold ${message.speaker === 'agent' ? 'text-stone-500' : 'text-white/80'}`}>
                {message.speaker === 'agent' ? 'Agent consulaire' : 'Vous'}
              </p>
              <p className="whitespace-pre-line">{message.text}</p>
            </div>
          </div>
        ))}
        {sending && (
          <p className="text-sm text-stone-500" role="status">
            L’agent consulaire prépare sa question…
          </p>
        )}
        <div ref={transcriptEnd} />
      </section>

      {awaitingAnswer && (
        <div className="card sticky bottom-2 space-y-3">
          {session.inputMode === 'voice' && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" disabled={speaking} onClick={() => readQuestion(lastMessage.text)}>
                {speaking ? 'Lecture…' : 'Je n’ai pas compris — répéter la question'}
              </button>
              {voiceMode &&
                (recognition.listening ? (
                  <button className="btn-danger px-3 py-1 text-xs" onClick={recognition.stop}>
                    ■ Arrêter la dictée
                  </button>
                ) : (
                  <button
                    className="btn-primary px-3 py-1 text-xs"
                    disabled={sending}
                    onClick={() => {
                      stopSpeaking();
                      recognition.start();
                    }}
                  >
                    🎤 Répondre à voix haute
                  </button>
                ))}
              {recognition.listening && <span className="text-xs text-rosso">● Écoute en cours</span>}
            </div>
          )}

          {recognition.error && RECOGNITION_ERROR_MESSAGES[recognition.error] && (
            <p className="text-sm text-rosso">{RECOGNITION_ERROR_MESSAGES[recognition.error]}</p>
          )}

          <div>
            <label className="label" htmlFor="answer">
              {session.inputMode === 'voice' ? 'Votre réponse (vérifiez et corrigez la transcription avant d’envoyer)' : 'Votre réponse'}
            </label>
            <textarea
              id="answer"
              className="input min-h-24"
              maxLength={2000}
              value={recognition.interim ? `${draft} ${recognition.interim}`.trim() : draft}
              readOnly={recognition.listening}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send();
              }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={sending || recognition.listening || !draft.trim()} onClick={() => void send()}>
              {sending ? 'Envoi…' : 'Envoyer la réponse'}
            </button>
            <button className="btn-secondary ml-auto" disabled={sending} onClick={() => void endInterview()}>
              Terminer l’entretien
            </button>
          </div>
        </div>
      )}

      {!inProgress && (
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/etudiant/entretien" className="btn-primary">
            Nouvel entretien
          </Link>
          <button className="btn-danger" onClick={() => void deleteSession()}>
            Supprimer cet entretien
          </button>
          <p className="w-full text-xs text-stone-500">Sur un ordinateur partagé, pensez à vous déconnecter en fin de séance.</p>
        </div>
      )}
    </div>
  );
}
