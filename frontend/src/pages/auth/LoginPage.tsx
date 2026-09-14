import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { Logo } from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { homeFor } from '../../lib/types';

function describeError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email ou mot de passe incorrect.';
  if (/banned/i.test(message)) return 'Ce compte est suspendu. Contactez le centre.';
  if (/rate limit|too many/i.test(message)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return 'Connexion impossible. Réessayez.';
}

export function LoginPage() {
  const { session, me, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session && me) return <Navigate to={homeFor(me.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    clearNotice();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(describeError(signInError.message));
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center text-xl">
          <Logo />
        </Link>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Connexion</h1>
            <p className="text-sm text-stone-600">Les comptes sont créés par le centre.</p>
          </div>

          {(notice || error) && (
            <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">
              {error ?? notice}
            </p>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
          <p className="text-center text-xs text-stone-500">Mot de passe oublié ? Contactez l’administration du centre.</p>
        </form>
      </div>
    </main>
  );
}
