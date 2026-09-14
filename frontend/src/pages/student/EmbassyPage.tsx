import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmbassyProgressPanel } from '../../components/EmbassyProgressPanel';
import { RetentionNotice } from '../../components/RetentionNotice';
import { ErrorBanner } from '../../components/ErrorBanner';
import { checkMicrophone, speechSupport } from '../../hooks/useSpeech';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import {
  EMBASSY_STATUS_LABELS,
  VISA_LABELS,
  type EmbassyConfig,
  type EmbassyInputMode,
  type EmbassyProgress,
  type EmbassySession,
  type EmbassySessionSummary,
  type VisaType,
} from '../../lib/types';

export function EmbassyPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<EmbassyConfig | null>(null);
  const [sessions, setSessions] = useState<EmbassySessionSummary[]>([]);
  const [progress, setProgress] = useState<EmbassyProgress | null>(null);
  const [visaType, setVisaType] = useState<VisaType>('etudes');
  const [scenarioCode, setScenarioCode] = useState('standard');
  const voiceSupported = speechSupport.recognition() && speechSupport.synthesis();
  const [inputMode, setInputMode] = useState<EmbassyInputMode>(voiceSupported ? 'voice' : 'text');
  const [voiceConsent, setVoiceConsent] = useState(false);
  // EF-56 : consentement explicite à l'usage du profil, désactivé par défaut.
  const [useProfile, setUseProfile] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [configResponse, sessionsResponse, progressResponse] = await Promise.all([
        api<EmbassyConfig>('/api/embassy/config'),
        api<{ sessions: EmbassySessionSummary[] }>('/api/embassy/sessions'),
        api<EmbassyProgress>('/api/embassy/progress'),
      ]);
      setConfig(configResponse);
      setSessions(sessionsResponse.sessions);
      setProgress(progressResponse);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les entretiens.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = sessions.find((session) => session.status === 'in_progress');
  const quotaReached = config ? config.weeklyUsed >= config.weeklyLimit : false;
  const scenarioOptions = config?.scenarios.filter((option) => option.visaTypes.includes(visaType)) ?? [];
  // Un scénario non applicable au type de visa choisi retombe sur le premier disponible.
  const scenario = scenarioOptions.find((option) => option.code === scenarioCode) ?? scenarioOptions[0] ?? null;
  const profileConsent = useProfile && Boolean(config?.profileAvailable);
  const canStart =
    Boolean(config?.aiAvailable) && Boolean(scenario) && !quotaReached && !config?.budgetReached && !active && (inputMode === 'text' || voiceConsent);

  async function start() {
    if (!scenario) return;
    setStarting(true);
    setError(null);
    try {
      if (inputMode === 'voice') {
        const microphone = await checkMicrophone();
        if (microphone !== 'granted') {
          setError(
            microphone === 'denied'
              ? 'Accès au micro refusé. Autorisez le micro dans les réglages du navigateur, ou choisissez le mode écrit.'
              : 'Aucun micro utilisable. Branchez un micro ou choisissez le mode écrit.',
          );
          return;
        }
      }
      const session = await api<EmbassySession>('/api/embassy/sessions', {
        method: 'POST',
        body: { visaType, inputMode, scenarioCode: scenario.code, useProfile: profileConsent },
      });
      navigate(`/etudiant/entretien/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de démarrer l’entretien.');
      await load();
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Entretien consulaire</h1>
        <p className="text-stone-600">Entraînez-vous à l’entretien de visa avec un agent IA, à l’oral ou à l’écrit, puis recevez un rapport détaillé.</p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Outil d’entraînement pédagogique : l’agent ne représente pas l’ambassade et aucune décision de visa n’est simulée. Les informations
        administratives doivent être vérifiées sur le site officiel de l’ambassade d’Italie.
      </div>

      <ErrorBanner message={error} />

      {config && !config.aiAvailable && <ErrorBanner message="L’agent ambassade n’est pas encore activé sur la plateforme. Contactez le centre." />}

      {active ? (
        <div className="card flex flex-wrap items-center gap-3 border-verde/40 bg-verde/5">
          <div>
            <p className="font-semibold text-verde-dark">Entretien en cours</p>
            <p className="text-sm text-stone-600">
              {VISA_LABELS[active.visaType]}
              {active.scenarioLabel && ` · ${active.scenarioLabel}`} · démarré le {formatDateTime(active.startedAt)}
            </p>
          </div>
          <Link to={`/etudiant/entretien/${active.id}`} className="btn-primary ml-auto">
            Reprendre
          </Link>
        </div>
      ) : (
        <section className="card space-y-5">
          <h2 className="text-lg font-semibold">Nouvel entretien</h2>

          <fieldset>
            <legend className="label">Type de demande</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(VISA_LABELS) as VisaType[]).map((type) => (
                <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${visaType === type ? 'border-verde bg-verde/5' : 'border-stone-200'}`}>
                  <input type="radio" name="visa-type" className="accent-verde" checked={visaType === type} onChange={() => setVisaType(type)} />
                  {VISA_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

          {scenarioOptions.length > 0 && (
            <fieldset>
              <legend className="label">Scénario</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {scenarioOptions.map((option) => (
                  <label
                    key={option.code}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${scenario?.code === option.code ? 'border-verde bg-verde/5' : 'border-stone-200'}`}
                  >
                    <input type="radio" name="scenario" className="mt-1 accent-verde" checked={scenario?.code === option.code} onChange={() => setScenarioCode(option.code)} />
                    <span>
                      <span className="font-medium">{option.label}</span>
                      <span className="block text-xs text-stone-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="label">Mode de réponse</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${!voiceSupported ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${inputMode === 'voice' ? 'border-verde bg-verde/5' : 'border-stone-200'}`}
              >
                <input type="radio" name="input-mode" className="mt-1 accent-verde" disabled={!voiceSupported} checked={inputMode === 'voice'} onChange={() => setInputMode('voice')} />
                <span>
                  <span className="font-medium">À l’oral</span>
                  <span className="block text-xs text-stone-500">Questions lues à voix haute, réponses dictées au micro puis vérifiées avant envoi.</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${inputMode === 'text' ? 'border-verde bg-verde/5' : 'border-stone-200'}`}>
                <input type="radio" name="input-mode" className="mt-1 accent-verde" checked={inputMode === 'text'} onChange={() => setInputMode('text')} />
                <span>
                  <span className="font-medium">À l’écrit</span>
                  <span className="block text-xs text-stone-500">Recommandé avec une connexion lente ou sans micro.</span>
                </span>
              </label>
            </div>
            {!voiceSupported && (
              <p className="mt-2 text-xs text-stone-500">Votre navigateur ne gère pas la reconnaissance vocale : utilisez Chrome pour le mode oral.</p>
            )}
          </fieldset>

          {inputMode === 'voice' && (
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" className="mt-1 accent-verde" checked={voiceConsent} onChange={(e) => setVoiceConsent(e.target.checked)} />
              <span>
                J’accepte que ma voix soit transcrite par le service de reconnaissance vocale de mon navigateur. Aucun enregistrement audio n’est conservé par
                Salve Italia : seul le texte de mes réponses est enregistré, et je peux supprimer l’entretien à tout moment.
              </span>
            </label>
          )}

          <fieldset className="space-y-1">
            <legend className="label">Cohérence avec votre profil (facultatif)</legend>
            <label className={`flex items-start gap-2 text-sm ${config?.profileAvailable ? 'text-stone-700' : 'text-stone-400'}`}>
              <input
                type="checkbox"
                className="mt-1 accent-verde"
                disabled={!config?.profileAvailable}
                checked={profileConsent}
                onChange={(e) => setUseProfile(e.target.checked)}
              />
              <span>
                J’accepte que des informations de mon profil (objectif, domaine, villes, type de financement, fourchette de budget, niveau d’italien, rentrée visée)
                et les faits clés de mon entretien précédent soient transmis à l’agent IA pour repérer les incohérences de mon discours.
              </span>
            </label>
            <p className="text-xs text-stone-500">
              Sans cet accord, seules les contradictions au sein de l’entretien sont relevées.{' '}
              {config && !config.profileAvailable && (
                <>
                  Pour activer cette option,{' '}
                  <Link to="/etudiant/profil" className="text-verde-dark hover:underline">
                    complétez votre profil
                  </Link>
                  .
                </>
              )}
            </p>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={!canStart || starting} onClick={() => void start()}>
              {starting ? 'Préparation…' : 'Commencer l’entretien'}
            </button>
            {config && (
              <span className="text-sm text-stone-500">
                {config.weeklyUsed} / {config.weeklyLimit} entretiens cette semaine · {config.maxTurns} questions maximum
              </span>
            )}
          </div>
          {quotaReached && <p className="text-sm text-rosso">Limite hebdomadaire atteinte. Vous pourrez recommencer dans quelques jours.</p>}
          {config?.budgetReached && <p className="text-sm text-rosso">Limite d’utilisation mensuelle atteinte. Contactez le centre.</p>}
        </section>
      )}

      {progress && <EmbassyProgressPanel progress={progress} audience="student" />}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Mes entretiens</h2>
          <RetentionNotice context="embassy" />
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scénario</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    Aucun entretien pour le moment.
                  </td>
                </tr>
              )}
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(session.startedAt)}</td>
                  <td className="px-4 py-3">{VISA_LABELS[session.visaType]}</td>
                  <td className="px-4 py-3">{session.scenarioLabel ?? '—'}</td>
                  <td className="px-4 py-3">{EMBASSY_STATUS_LABELS[session.status]}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{session.overallScore ?? '—'}</span>
                    {session.inconsistencyCount > 0 && (
                      <span className="ml-2 whitespace-nowrap text-xs text-amber-800">
                        ⚠ {session.inconsistencyCount} point{session.inconsistencyCount > 1 ? 's' : ''} à clarifier
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/etudiant/entretien/${session.id}`} className="text-verde-dark hover:underline">
                      {session.status === 'in_progress' ? 'Reprendre' : 'Voir'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
