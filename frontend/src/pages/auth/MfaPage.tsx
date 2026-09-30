import { multiFactor, TotpMultiFactorGenerator, type TotpSecret } from 'firebase/auth';
import QRCode from 'qrcode';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { Logo } from '../../components/Logo';
import { auth, authErrorCode } from '../../lib/firebase';
import { homeFor } from '../../lib/types';

interface Enrollment {
  qrCode: string;
  secret: string;
}

// MFA TOTP obligatoire pour les admins (checklist sécurité). Avec Firebase, le code d'un facteur déjà
// actif est demandé à la connexion (LoginPage) : cette page sert à l'activation au premier passage.
export function MfaPage() {
  const { me, refreshMe, signOut } = useAuth();
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !me?.mfaRequired) return;
    started.current = true;

    void (async () => {
      const user = auth.currentUser;
      if (!user) return;
      // Facteur déjà actif mais session sans second facteur : la reconnexion demandera le code.
      if (multiFactor(user).enrolledFactors.length > 0) {
        return signOut('Reconnectez-vous et saisissez le code de votre application d’authentification.');
      }
      try {
        const secret = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
        setTotpSecret(secret);
        const uri = secret.generateQrCodeUrl(user.email ?? 'admin', 'Salve Italia');
        setEnrollment({ qrCode: await QRCode.toDataURL(uri, { margin: 1, width: 176 }), secret: secret.secretKey });
      } catch (err) {
        if (authErrorCode(err) === 'auth/requires-recent-login') return signOut('Reconnectez-vous pour activer la vérification en deux étapes.');
        setError(
          import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST
            ? 'L’émulateur Firebase Auth ne gère pas la MFA TOTP : en local, passez REQUIRE_ADMIN_MFA=false dans backend/.env.'
            : 'Impossible de démarrer l’activation de la MFA.',
        );
      }
    })();
  }, [me?.mfaRequired, signOut]);

  if (me && !me.mfaRequired) return <Navigate to={homeFor(me.role)} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user || !totpSecret) return;
    setSubmitting(true);
    setError(null);
    try {
      await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code.trim()), 'Salve Italia');
    } catch {
      setError('Code invalide ou expiré. Réessayez.');
      setSubmitting(false);
      return;
    }
    // Le jeton renouvelé porte normalement le second facteur ; sinon, une reconnexion avec le code suffit.
    const token = await user.getIdTokenResult(true);
    if (!token.signInSecondFactor) {
      await signOut('Vérification en deux étapes activée. Reconnectez-vous avec le code de votre application.');
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
          <button type="submit" className="btn-primary w-full" disabled={submitting || !totpSecret}>
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
