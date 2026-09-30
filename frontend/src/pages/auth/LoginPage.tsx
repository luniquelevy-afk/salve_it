import {
  getMultiFactorResolver,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from 'firebase/auth';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Logo } from '../../components/Logo';
import { auth, authErrorCode } from '../../lib/firebase';
import { homeFor } from '../../lib/types';

function describeError(code: string): string {
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(code)) return 'Email ou mot de passe incorrect.';
  if (code === 'auth/user-disabled') return 'Ce compte est suspendu. Contactez le centre.';
  if (code === 'auth/too-many-requests') return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (code === 'auth/invalid-verification-code') return 'Code invalide ou expiré. Réessayez.';
  if (code === 'auth/network-request-failed') return 'Connexion au serveur impossible. Vérifiez votre connexion internet.';
  return 'Connexion impossible. Réessayez.';
}

export function LoginPage() {
  const { session, me, notice, clearNotice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // Compte protégé par MFA : la connexion se termine par le code de l'application TOTP.
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session && me) return <Navigate to={homeFor(me.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    clearNotice();
    try {
      if (resolver) {
        const hint = resolver.hints.find((candidate) => candidate.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!hint) throw Object.assign(new Error('no totp factor'), { code: 'auth/unsupported-first-factor' });
        await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()));
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      if (authErrorCode(err) === 'auth/multi-factor-auth-required') {
        setResolver(getMultiFactorResolver(auth, err as MultiFactorError));
      } else {
        setError(describeError(authErrorCode(err)));
      }
    }
    setSubmitting(false);
  }

  return (
    <main data-theme="dark" className="flex min-h-screen items-center justify-center bg-[#070A0F] p-4 text-[#F1F5F9]">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center text-xl text-white">
          <Logo />
        </Link>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">{resolver ? 'Vérification en deux étapes' : 'Connexion'}</h1>
            <p className="text-sm text-stone-600">
              {resolver ? 'Saisissez le code à 6 chiffres de votre application d’authentification.' : 'Les comptes sont créés par le centre.'}
            </p>
          </div>

          {(notice || error) && (
            <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">
              {error ?? notice}
            </p>
          )}

          {resolver ? (
            <div>
              <label className="label" htmlFor="totp">Code</label>
              <input
                id="totp"
                className="input text-center font-mono text-lg tracking-widest"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="password">Mot de passe</label>
                <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? (resolver ? 'Vérification…' : 'Connexion…') : resolver ? 'Vérifier' : 'Se connecter'}
          </button>
          {resolver ? (
            <button type="button" className="btn-secondary w-full" onClick={() => { setResolver(null); setCode(''); setError(null); }}>
              Retour
            </button>
          ) : (
            <p className="text-center text-xs text-stone-500">
              <Link to="/mot-de-passe-oublie" className="font-semibold text-verde hover:underline">
                Mot de passe oublié ?
              </Link>
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
