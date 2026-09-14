import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { Logo } from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { homeFor } from '../../lib/types';

interface Enrollment {
  qrCode: string;
  secret: string;
}

// MFA TOTP obligatoire pour les admins (checklist sécurité) : enrôlement au premier passage, puis vérification.
export function MfaPage() {
  const { me, refreshMe, signOut } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !me?.mfaRequired) return;
    started.current = true;

    void (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError('Impossible de charger la configuration MFA.');

      const verified = data.totp.find((factor) => factor.status === 'verified');
      if (verified) return setFactorId(verified.id);

      // Nettoie un enrôlement abandonné lors d'une visite précédente.
      for (const factor of data.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Salve Italia',
      });
      if (enrollError) return setError('Impossible de démarrer l’activation de la MFA.');
      setFactorId(enrolled.id);
      setEnrollment({ qrCode: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
  }, [me?.mfaRequired]);

  if (me && !me.mfaRequired) return <Navigate to={homeFor(me.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setSubmitting(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (verifyError) {
      setError('Code invalide ou expiré. Réessayez.');
      setSubmitting(false);
      return;
    }
    await refreshMe();
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center text-xl"><Logo /></div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <h1 className="text-lg font-semibold">Vérification en deux étapes</h1>
            <p className="text-sm text-stone-600">
              {enrollment
                ? 'Scannez ce QR code avec une application d’authentification (Google Authenticator, Authy…), puis saisissez le code affiché.'
                : 'Saisissez le code à 6 chiffres de votre application d’authentification.'}
            </p>
          </div>

          {enrollment && (
            <div className="space-y-2 text-center">
              <img src={enrollment.qrCode} alt="QR code d’activation MFA" className="mx-auto h-44 w-44" />
              <details className="text-xs text-stone-500">
                <summary className="cursor-pointer">Saisie manuelle</summary>
                <code className="mt-1 block break-all">{enrollment.secret}</code>
              </details>
            </div>
          )}

          {error && <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">{error}</p>}

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
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting || !factorId}>
            {submitting ? 'Vérification…' : 'Vérifier'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => void signOut()}>
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
