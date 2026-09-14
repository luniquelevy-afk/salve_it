import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { ContactDetails } from '../../components/PublicLayout';
import { usePublicSite } from '../../lib/public-site';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { api, ApiError } from '../../lib/api';

// EF-32 : la demande est enregistrée comme prospect à recontacter.
export function ContactPage() {
  const { site } = usePublicSite();
  const [params] = useSearchParams();
  useDocumentTitle('Contact', site?.settings.centreName);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    desiredProgram: params.get('formation') ?? '',
    message: '',
    consent: false,
    website: '',
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.phone.trim() && !form.email.trim()) return setError('Indiquez un téléphone ou un email pour que nous puissions vous répondre.');
    setSending(true);
    setError(null);
    try {
      await api('/api/public/contact', {
        method: 'POST',
        body: {
          fullName: form.fullName,
          phone: form.phone || undefined,
          email: form.email || undefined,
          desiredProgram: form.desiredProgram || undefined,
          message: form.message || undefined,
          consent: form.consent,
          website: form.website,
        },
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Trop de demandes envoyées depuis cette connexion. Réessayez plus tard ou contactez-nous directement.'
          : err instanceof ApiError
            ? err.message
            : 'Envoi impossible. Vérifiez votre connexion.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-5">
        <div>
          <h1 className="text-3xl font-extrabold">Contact et inscription</h1>
          <p className="mt-2 text-stone-600">Parlez-nous de votre projet : le centre vous recontacte pour vous présenter les formations adaptées.</p>
        </div>

        {sent ? (
          <div className="card border-verde/40 bg-verde/5" role="status">
            <p className="font-semibold text-verde-dark">Merci, votre demande a bien été envoyée.</p>
            <p className="mt-1 text-stone-700">Le centre vous recontactera rapidement.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <ErrorBanner message={error} />
            <div>
              <label className="label" htmlFor="contact-name">Nom complet</label>
              <input id="contact-name" className="input" required minLength={2} maxLength={120} autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="contact-phone">Téléphone / WhatsApp</label>
                <input id="contact-phone" type="tel" className="input" maxLength={30} autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="contact-email">Email</label>
                <input id="contact-email" type="email" className="input" maxLength={200} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="contact-program">Formation souhaitée</label>
              <select id="contact-program" className="input" value={form.desiredProgram} onChange={(e) => setForm({ ...form, desiredProgram: e.target.value })}>
                <option value="">Je ne sais pas encore</option>
                {site?.programs.map((program) => (
                  <option key={program.id} value={program.name}>
                    {program.name}
                  </option>
                ))}
                {form.desiredProgram && !site?.programs.some((program) => program.name === form.desiredProgram) && (
                  <option value={form.desiredProgram}>{form.desiredProgram}</option>
                )}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="contact-message">Votre projet (facultatif)</label>
              <textarea id="contact-message" className="input min-h-28" maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            {/* Champ piège anti-robots : invisible et ignoré par les lecteurs d'écran. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="contact-website">Site web</label>
              <input id="contact-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>

            <label className="flex items-start gap-2 text-sm text-stone-600">
              <input type="checkbox" className="mt-1 accent-verde" required checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
              J’accepte que le centre conserve ces informations pour me recontacter au sujet de ses formations.
            </label>
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? 'Envoi…' : 'Envoyer ma demande'}
            </button>
          </form>
        )}
      </section>

      {site && (
        <aside className="card h-fit space-y-4">
          <h2 className="font-semibold">Nous joindre</h2>
          <ContactDetails settings={site.settings} />
          {!site.settings.phone && !site.settings.email && !site.settings.whatsapp && (
            <p className="text-sm text-stone-500">Les coordonnées du centre seront bientôt disponibles.</p>
          )}
        </aside>
      )}
    </div>
  );
}
