import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Meter } from '../../components/Meter';
import { usePublicSite } from '../../components/PublicLayout';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiError } from '../../lib/api';
import { CEFR_LEVELS, type CefrLevel, type LevelTestQuestion, type LevelTestResult } from '../../lib/types';

const LEVEL_DESCRIPTIONS: Record<CefrLevel | 'none', string> = {
  none: 'Débutant : vous découvrez l’italien. Le programme A1 est fait pour vous.',
  A1: 'A1 — Découverte : vous comprenez des phrases simples du quotidien.',
  A2: 'A2 — Élémentaire : vous communiquez dans les situations courantes.',
  B1: 'B1 — Intermédiaire : vous êtes autonome, une bonne base pour préparer les études.',
  B2: 'B2 — Avancé : un niveau proche des exigences universitaires.',
};

// EF-27 : test gratuit sans compte pour qualifier les prospects.
export function LevelTestPage() {
  const { site } = usePublicSite();
  useDocumentTitle('Test de niveau gratuit', site?.settings.centreName);
  const [questions, setQuestions] = useState<LevelTestQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wantsContact, setWantsContact] = useState(false);
  const [contact, setContact] = useState({ fullName: '', phone: '', email: '', desiredProgram: '', consent: false });
  const [result, setResult] = useState<LevelTestResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ questions: LevelTestQuestion[] }>('/api/public/level-test')
      .then((response) => setQuestions(response.questions))
      .catch(() => setError('Le test est momentanément indisponible. Réessayez plus tard.'));
  }, []);

  const answered = Object.keys(answers).length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (questions && answered < questions.length && !window.confirm('Vous n’avez pas répondu à toutes les questions. Voir votre résultat quand même ?')) return;
    if (wantsContact && !contact.phone.trim() && !contact.email.trim()) return setError('Indiquez un téléphone ou un email pour être recontacté.');
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        answers,
        contact: wantsContact
          ? { consent: contact.consent, fullName: contact.fullName, phone: contact.phone || undefined, email: contact.email || undefined, desiredProgram: contact.desiredProgram || undefined }
          : null,
      };
      setResult(await api<LevelTestResult>('/api/public/level-test', { method: 'POST', body }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? 'Trop de tentatives depuis cette connexion. Réessayez dans une heure.' : err instanceof ApiError ? err.message : 'Envoi impossible. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
        {result ? (
          <section className="space-y-5">
            <div className="card space-y-3 border-verde/40 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-verde">Votre niveau estimé</p>
              <p className="text-5xl font-extrabold">{result.estimatedLevel ?? 'Débutant'}</p>
              <p className="text-stone-700">{LEVEL_DESCRIPTIONS[result.estimatedLevel ?? 'none']}</p>
              <p className="text-sm text-stone-500">
                {result.score} bonnes réponses sur {result.total}
              </p>
            </div>

            <div className="card space-y-3">
              {CEFR_LEVELS.map((level) => {
                const tally = result.byLevel[level];
                if (!tally) return null;
                return (
                  <div key={level}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{level}</span>
                      <span className="tabular-nums">
                        {tally.correct} / {tally.total}
                      </span>
                    </div>
                    <Meter value={tally.correct} max={tally.total} label={`Réussite au niveau ${level}`} />
                  </div>
                );
              })}
            </div>

            <p className="text-center text-stone-700">
              {result.contactSaved
                ? 'Merci ! Le centre vous recontactera pour vous proposer le programme adapté.'
                : 'Pour aller plus loin, contactez le centre : un test oral complétera cette estimation.'}
            </p>
            <p className="text-center text-xs text-stone-500">Ce test rapide donne une estimation indicative, qui ne remplace pas une certification officielle.</p>
            <div className="text-center">
              <Link to="/" className="btn-secondary">
                Retour à l’accueil
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-extrabold">Test de niveau d’italien gratuit</h1>
              <p className="mt-2 text-stone-600">
                {questions ? `${questions.length} questions, environ 5 minutes.` : ''} Sans inscription. Répondez sans chercher : c’est une estimation.
              </p>
            </div>

            <ErrorBanner message={error} />
            {!questions && !error && <p className="text-stone-500">Chargement…</p>}

            {questions && (
              <form onSubmit={submit} className="space-y-4">
                {questions.map((question, index) => (
                  <fieldset key={question.id} className="card space-y-2">
                    <legend className="font-medium">
                      {index + 1}. {question.text}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {question.options.map((option) => (
                        <label
                          key={option.key}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 ${answers[question.id] === option.key ? 'border-verde bg-verde/5' : 'border-stone-200'}`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            className="accent-verde"
                            checked={answers[question.id] === option.key}
                            onChange={() => setAnswers({ ...answers, [question.id]: option.key })}
                          />
                          {option.text}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}

                <div className="card space-y-3">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="accent-verde" checked={wantsContact} onChange={(e) => setWantsContact(e.target.checked)} />
                    Je souhaite être recontacté(e) par le centre (facultatif)
                  </label>
                  {wantsContact && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="input" required minLength={2} maxLength={120} placeholder="Nom complet" aria-label="Nom complet" value={contact.fullName} onChange={(e) => setContact({ ...contact, fullName: e.target.value })} />
                      <input className="input" type="tel" maxLength={30} placeholder="Téléphone / WhatsApp" aria-label="Téléphone" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
                      <input className="input" type="email" maxLength={200} placeholder="Email" aria-label="Email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
                      <input className="input" maxLength={120} placeholder="Projet (ex. licence en Italie)" aria-label="Projet" value={contact.desiredProgram} onChange={(e) => setContact({ ...contact, desiredProgram: e.target.value })} />
                      <label className="flex items-start gap-2 text-sm text-stone-600 sm:col-span-2">
                        <input type="checkbox" className="mt-1 accent-verde" required checked={contact.consent} onChange={(e) => setContact({ ...contact, consent: e.target.checked })} />
                        J’accepte que le centre conserve ces coordonnées et mon résultat pour me recontacter au sujet de ses formations.
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={submitting}>
                    {submitting ? 'Calcul…' : 'Voir mon niveau'}
                  </button>
                  <span className="text-sm text-stone-500">
                    {answered} / {questions.length} réponses
                  </span>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
