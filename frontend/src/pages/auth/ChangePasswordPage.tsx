import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Logo } from '../../components/Logo';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { api, ApiError } from '../../lib/api';
import { auth, authErrorCode } from '../../lib/firebase';
import { homeFor } from '../../lib/types';

function validate(password: string, confirmation: string): string | null {
  if (password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  if (password !== confirmation) return 'Les deux mots de passe ne correspondent pas.';
  return null;
}

export function ChangePasswordPage() {
  const { me, refreshMe, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (me && !me.mustChangePassword) return <Navigate to={homeFor(me.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate(password, confirmation);
    if (problem) return setError(problem);

    setSubmitting(true);
    setError(null);
    try {
      await api('/api/me/password', { method: 'POST', body: { password } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de changer le mot de passe.');
      setSubmitting(false);
      return;
    }
    // Firebase révoque les sessions à chaque changement de mot de passe : reconnexion immédiate.
    try {
      if (me) await signInWithEmailAndPassword(auth, me.email, password);
      await refreshMe();
    } catch (err) {
      await signOut(
        authErrorCode(err) === 'auth/multi-factor-auth-required'
          ? 'Mot de passe enregistré. Reconnectez-vous avec votre code de vérification.'
          : 'Mot de passe enregistré. Reconnectez-vous.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-xl"><Logo /></div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Choisissez votre mot de passe</h1>
            <p className="text-sm text-stone-600">
              Le mot de passe temporaire fourni par le centre doit être remplacé avant de continuer.
            </p>
          </div>
          {error && <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">{error}</p>}
          <div>
            <label className="label" htmlFor="new-password">Nouveau mot de passe</label>
            <input id="new-password" type="password" className="input" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-stone-500">10 caractères minimum, avec au moins une lettre et un chiffre.</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirmation</label>
            <input id="confirm-password" type="password" className="input" autoComplete="new-password" required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
