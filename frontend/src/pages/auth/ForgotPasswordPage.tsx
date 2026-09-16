import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { supabase } from '../../lib/supabase';

// Écran dédié « Mot de passe oublié ». Les comptes étant gérés par le centre, on propose
// à la fois l'envoi d'un lien de réinitialisation (Supabase Auth) et le contact du centre.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/mot-de-passe`,
    });
    // On confirme l'envoi sans révéler si l'adresse existe (bonne pratique de sécurité).
    if (resetError && /rate limit|too many/i.test(resetError.message)) {
      setError('Trop de demandes. Réessayez dans quelques minutes.');
    } else {
      setSent(true);
    }
    setSubmitting(false);
  }

  return (
    <main data-theme="dark" className="flex min-h-screen items-center justify-center bg-[#070A0F] p-4 text-[#F1F5F9]">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center text-xl text-white">
          <Logo />
        </Link>

        {sent ? (
          <div className="card space-y-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#0E8368]/20 text-2xl text-[#2DD4BF]">✓</div>
            <div>
              <h1 className="text-lg font-semibold">Demande envoyée</h1>
              <p className="mt-1 text-sm text-slate-400">
                Si un compte est associé à <span className="font-medium text-white">{email}</span>, un lien de réinitialisation vient d&rsquo;être envoyé. Pensez à vérifier vos spams.
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Sans réponse, contactez l&rsquo;administration du centre qui pourra réinitialiser votre accès.
            </p>
            <Link to="/connexion" className="btn-primary w-full">Retour à la connexion</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <h1 className="text-lg font-semibold">Mot de passe oublié</h1>
              <p className="text-sm text-slate-400">Saisissez votre email : nous vous enverrons un lien pour définir un nouveau mot de passe.</p>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-rosso/10 px-3 py-2 text-sm text-red-300">{error}</p>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? 'Envoi…' : 'Recevoir un lien de réinitialisation'}
            </button>
            <p className="text-center text-xs text-slate-500">
              Les comptes sont gérés par le centre. En cas de difficulté,{' '}
              <Link to="/contact" className="text-[#2DD4BF] hover:underline">contactez l&rsquo;administration</Link>.
            </p>
            <p className="text-center text-xs">
              <Link to="/connexion" className="text-slate-400 hover:text-white hover:underline">← Retour à la connexion</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
