import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { SessionSettings } from '../../lib/types';

// EF-05 / §22 #5 : durée d'inactivité avant déconnexion automatique, administrable
// sans redéploiement (ENF-10). Postes partagés / cybercafés : une valeur basse est prudente.
export function AdminSessionSettingsPage() {
  const [settings, setSettings] = useState<SessionSettings | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: SessionSettings) => {
    setSettings(next);
    setDraft(String(next.idleTimeoutMinutes));
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api<SessionSettings>('/api/admin/learning/session-settings'));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les réglages de session.');
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const minutes = Number(draft);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
      setError('La durée doit être un entier entre 1 et 240 minutes.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      apply(await api<SessionSettings>('/api/admin/learning/session-settings', { method: 'PUT', body: { idleTimeoutMinutes: minutes } }));
      setError(null);
      setNotice('Durée d’inactivité enregistrée. Elle s’applique à la prochaine connexion des utilisateurs.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Paramètres de session</h1>
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const changed = draft.trim() !== String(settings.idleTimeoutMinutes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres de session</h1>
        <p className="text-stone-600">Sécurité des comptes sur postes partagés (EF-05).</p>
      </div>

      <ErrorBanner message={error} />
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={save} className="card max-w-xl space-y-4">
        <div>
          <label htmlFor="idle" className="block font-medium">
            Déconnexion après inactivité
          </label>
          <p className="mt-1 text-sm text-stone-500">
            Un utilisateur inactif est déconnecté automatiquement au bout de cette durée. Recommandé : 15 à 30 minutes.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="idle"
              type="number"
              min={1}
              max={240}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="input w-28"
            />
            <span className="text-stone-600">minutes</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={busy || !changed}>
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {!settings.configured && <span className="text-xs text-stone-500">Valeur par défaut ({settings.defaultMinutes} min) tant que non enregistrée.</span>}
        </div>

        <p className="border-t border-stone-100 pt-3 text-xs text-stone-500">
          Dernière modification : {formatDateTime(settings.updatedAt)}
        </p>
      </form>
    </div>
  );
}
