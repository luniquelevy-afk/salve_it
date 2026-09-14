import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { api, apiDownload, ApiError } from '../../lib/api';
import { CEFR_LEVELS, ROLE_LABELS, type Account, type AppRole, type CefrLevel } from '../../lib/types';

interface Credentials {
  email: string;
  temporaryPassword: string;
}

const EMPTY_FORM = { email: '', fullName: '', phone: '', role: 'student' as AppRole, level: 'A1' as CefrLevel };

const fileSlug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'etudiant';

export function AdminUsersPage() {
  const { me } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [roleFilter, setRoleFilter] = useState<AppRole | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = roleFilter ? `?role=${roleFilter}` : '';
      const { accounts: list } = await api<{ accounts: Account[] }>(`/api/admin/users${query}`);
      setAccounts(list);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les comptes.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        email: form.email,
        fullName: form.fullName,
        role: form.role,
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.role === 'student' ? { level: form.level } : {}),
      };
      const result = await api<{ account: Account; temporaryPassword: string }>('/api/admin/users', { method: 'POST', body });
      setCredentials({ email: result.account.email, temporaryPassword: result.temporaryPassword });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(account: Account, action: 'suspend' | 'reactivate' | 'reset-password') {
    const confirmations = {
      suspend: `Suspendre le compte de ${account.fullName} ? L’accès sera bloqué immédiatement.`,
      reactivate: `Réactiver le compte de ${account.fullName} ?`,
      'reset-password': `Générer un nouveau mot de passe temporaire pour ${account.fullName} ?`,
    };
    if (!window.confirm(confirmations[action])) return;

    setBusyId(account.id);
    setError(null);
    try {
      const result = await api<{ account: Account; temporaryPassword?: string }>(`/api/admin/users/${account.id}/${action}`, { method: 'POST' });
      if (result.temporaryPassword) setCredentials({ email: result.account.email, temporaryPassword: result.temporaryPassword });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  // EF-38 : export des résultats (CSV) ou de l'ensemble des données (JSON) d'un étudiant.
  async function exportData(account: Account, format: 'csv' | 'json') {
    const content = format === 'csv' ? 'ses résultats (simulations et entretiens)' : 'toutes ses données (profil, rapports et transcripts d’entretien, documents)';
    if (
      !window.confirm(
        `Exporter ${content} de ${account.fullName} ?\n\nLe fichier contient des données personnelles sensibles : conservez-le de façon sécurisée et supprimez-le dès qu’il n’est plus utile. L’export est enregistré dans le journal d’audit.`,
      )
    )
      return;
    setBusyId(account.id);
    setError(null);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const suffix = format === 'csv' ? 'resultats.csv' : 'complet.json';
      await apiDownload(`/api/admin/users/${account.id}/export?format=${format}`, `salve-italia-${fileSlug(account.fullName)}-${date}-${suffix}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Comptes</h1>
        <select className="input w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AppRole | '')} aria-label="Filtrer par rôle">
          <option value="">Tous les rôles</option>
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
        <button className="btn-primary ml-auto" onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Fermer' : 'Nouveau compte'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-lg bg-rosso/5 px-3 py-2 text-sm text-rosso">{error}</p>}

      {credentials && (
        <div className="card border-verde/40 bg-verde/5">
          <p className="font-semibold text-verde-dark">Identifiants à transmettre à l’utilisateur</p>
          <p className="mt-1 text-sm">
            {credentials.email} — mot de passe temporaire :{' '}
            <code className="rounded bg-white px-2 py-0.5 font-mono">{credentials.temporaryPassword}</code>
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Affiché une seule fois. Il devra être changé à la première connexion.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-secondary" onClick={() => void navigator.clipboard.writeText(credentials.temporaryPassword)}>Copier</button>
            <button className="btn-secondary" onClick={() => setCredentials(null)}>J’ai transmis les identifiants</button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fullName">Nom complet</label>
            <input id="fullName" className="input" required minLength={2} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="new-email">Email</label>
            <input id="new-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone</label>
            <input id="phone" type="tel" className="input" placeholder="+242 …" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="role">Rôle</label>
              <select id="role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AppRole })}>
                {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
                  <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                ))}
              </select>
            </div>
            {form.role === 'student' && (
              <div>
                <label className="label" htmlFor="level">Niveau</label>
                <select id="level" className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as CefrLevel })}>
                  {CEFR_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Niveau</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">Chargement…</td></tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-500">Aucun compte.</td></tr>
            )}
            {!loading && accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{account.fullName}</div>
                  <div className="text-xs text-stone-500">{account.email}{account.phone ? ` · ${account.phone}` : ''}</div>
                </td>
                <td className="px-4 py-3">{ROLE_LABELS[account.role]}</td>
                <td className="px-4 py-3">{account.level ?? '—'}</td>
                <td className="px-4 py-3">
                  {account.status === 'active' ? (
                    <span className="rounded-full bg-verde/10 px-2 py-0.5 text-xs font-medium text-verde-dark">
                      {account.mustChangePassword ? 'En attente 1re connexion' : 'Actif'}
                    </span>
                  ) : (
                    <span className="rounded-full bg-rosso/10 px-2 py-0.5 text-xs font-medium text-rosso">Suspendu</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {account.role === 'student' && (
                      <>
                        <button className="btn-secondary px-3 py-1 text-xs" disabled={busyId === account.id} onClick={() => void exportData(account, 'csv')}>
                          Export CSV
                        </button>
                        <button className="btn-secondary px-3 py-1 text-xs" disabled={busyId === account.id} onClick={() => void exportData(account, 'json')}>
                          Export JSON
                        </button>
                      </>
                    )}
                    {account.id !== me?.id && (
                      <>
                        <button className="btn-secondary px-3 py-1 text-xs" disabled={busyId === account.id} onClick={() => void runAction(account, 'reset-password')}>
                          Nouveau mot de passe
                        </button>
                        {account.status === 'active' ? (
                          <button className="btn-danger px-3 py-1 text-xs" disabled={busyId === account.id} onClick={() => void runAction(account, 'suspend')}>
                            Suspendre
                          </button>
                        ) : (
                          <button className="btn-secondary px-3 py-1 text-xs" disabled={busyId === account.id} onClick={() => void runAction(account, 'reactivate')}>
                            Réactiver
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
