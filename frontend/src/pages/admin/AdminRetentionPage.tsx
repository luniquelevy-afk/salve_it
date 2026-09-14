import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import type { RetentionKey, RetentionRun, RetentionSettings } from '../../lib/types';

type Draft = Record<RetentionKey, string>;

const toDraft = (settings: RetentionSettings): Draft => Object.fromEntries(settings.rules.map((rule) => [rule.key, rule.months === null ? '' : String(rule.months)])) as Draft;
const toBody = (draft: Draft) => Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() === '' ? null : Number(value)])) as Record<RetentionKey, number | null>;

// ENF-09 / ENF-11 : durées de conservation des données sensibles, purge quotidienne.
export function AdminRetentionPage() {
  const [settings, setSettings] = useState<RetentionSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<RetentionSettings['preview'] | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | 'run' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((next: RetentionSettings) => {
    setSettings(next);
    setDraft(toDraft(next));
    setPreview(next.preview);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api<RetentionSettings>('/api/admin/retention'));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les réglages de conservation.');
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!settings || !draft) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Conservation des données</h1>
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const unitOf = (key: RetentionKey) => settings.rules.find((rule) => rule.key === key)?.unit ?? '';
  const labelOf = (key: RetentionKey) => settings.rules.find((rule) => rule.key === key)?.label ?? key;
  const savedEnabled = settings.rules.filter((rule) => rule.months !== null);

  async function computePreview() {
    if (!draft) return;
    setBusy('preview');
    setError(null);
    try {
      setPreview((await api<{ preview: RetentionSettings['preview'] }>('/api/admin/retention/preview', { method: 'POST', body: toBody(draft) })).preview);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Aperçu impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const body = toBody(draft);
    const enabled = Object.values(body).some((value) => value !== null);
    if (
      enabled &&
      !window.confirm(
        'Une fois enregistrées, ces durées déclenchent chaque jour la suppression définitive des données plus anciennes (sans corbeille ni restauration). Avez-vous validé ces durées avec le centre ?',
      )
    )
      return;
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      apply(await api<RetentionSettings>('/api/admin/retention', { method: 'PUT', body }));
      setNotice(enabled ? 'Durées enregistrées : la purge automatique s’appliquera lors du prochain passage quotidien.' : 'Aucune durée active : rien ne sera supprimé automatiquement.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    if (!settings) return;
    const details = savedEnabled.map((rule) => `• ${rule.label} : ${settings.preview[rule.key] ?? 0} ${rule.unit}`).join('\n');
    if (!window.confirm(`Lancer la purge maintenant ? Suppression définitive :\n${details}`)) return;
    setBusy('run');
    setError(null);
    setNotice(null);
    try {
      const { run } = await api<{ run: RetentionRun | null }>('/api/admin/retention/run', { method: 'POST' });
      setNotice(run ? 'Purge terminée.' : 'Aucune durée active : rien n’a été supprimé.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Purge impossible.');
    } finally {
      setBusy(null);
    }
  }

  const lastRun = settings.lastRunResult;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conservation des données</h1>
        <p className="text-stone-600">
          Durée pendant laquelle les données sensibles sont gardées avant suppression automatique (passage quotidien). Laissez un champ vide pour ne rien
          supprimer automatiquement.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
        Les durées dépendent du cadre applicable à la protection des données au Congo, encore à valider avec le centre. La suppression est définitive. Le journal
        d’audit, les coûts d’IA (sans contenu), les comptes et les résultats de tests ne sont jamais purgés.
      </div>

      <ErrorBanner message={error} />
      {notice && (
        <p role="status" className="rounded-lg bg-verde/5 px-3 py-2 text-sm text-verde-dark">
          {notice}
        </p>
      )}

      <form onSubmit={save} className="card space-y-5">
        <ul className="divide-y divide-stone-100">
          {settings.rules.map((rule) => {
            const count = preview?.[rule.key];
            const value = draft[rule.key];
            return (
              <li key={rule.key} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="font-medium" htmlFor={`retention-${rule.key}`}>
                    {rule.label}
                  </label>
                  <p className="text-sm text-stone-600">{rule.description}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {value.trim() === ''
                      ? 'Désactivé : aucune suppression automatique.'
                      : count === undefined
                        ? 'Calculez l’aperçu pour voir le volume concerné.'
                        : `Aujourd’hui : ${count} ${rule.unit} ${count > 1 ? 'seraient supprimés' : 'serait supprimé'}.`}
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <input
                    id={`retention-${rule.key}`}
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    placeholder="—"
                    className="input w-24"
                    value={value}
                    onChange={(e) => {
                      setDraft({ ...draft, [rule.key]: e.target.value });
                      setPreview(null);
                    }}
                  />
                  <span className="text-sm text-stone-600">mois</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => void computePreview()}>
            {busy === 'preview' ? 'Calcul…' : 'Calculer l’aperçu'}
          </button>
          <button type="submit" className="btn-primary" disabled={busy !== null}>
            {busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <span className="ml-auto text-xs text-stone-500">Dernière modification : {formatDateTime(settings.updatedAt)}</span>
        </div>
      </form>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Purge</h2>
          <button className="btn-danger ml-auto" disabled={busy !== null || savedEnabled.length === 0} onClick={() => void runNow()}>
            {busy === 'run' ? 'Purge…' : 'Lancer la purge maintenant'}
          </button>
        </div>
        {savedEnabled.length === 0 && <p className="text-sm text-stone-500">Aucune durée enregistrée : la purge quotidienne ne supprime rien.</p>}
        {lastRun ? (
          <div className="text-sm">
            <p className="text-stone-600">
              Dernier passage : {formatDateTime(lastRun.ranAt)} ({lastRun.trigger})
            </p>
            <ul className="mt-1 list-disc pl-5">
              {lastRun.rules.map((item) => (
                <li key={item.rule}>
                  {labelOf(item.rule)} : {item.error ? <span className="text-rosso">⚠ {item.error}</span> : `${item.deleted} ${unitOf(item.rule)} supprimé(s)`}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-stone-500">Aucune purge effectuée pour le moment.</p>
        )}
      </section>
    </div>
  );
}
