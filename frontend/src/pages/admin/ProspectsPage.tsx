import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { INTERACTION_LABELS, LEAD_STATUS_LABELS, type Lead, type LeadInteraction, type LeadStatus, type LevelTestAttempt } from '../../lib/types';

const SOURCE_LABELS: Record<Lead['source'], string> = { contact_form: 'Formulaire', level_test: 'Test de niveau' };
const MANUAL_KINDS = ['appel', 'whatsapp', 'email', 'rendez_vous', 'note'] as const;

type Assignee = { id: string; fullName: string; role: string };

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function LeadRow({ lead, assignees, onChange }: { lead: Lead; assignees: Assignee[]; onChange: (lead: Lead) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [followUp, setFollowUp] = useState(toLocalInput(lead.nextFollowUpAt));
  const [interactions, setInteractions] = useState<LeadInteraction[] | null>(null);
  const [interaction, setInteraction] = useState<{ kind: (typeof MANUAL_KINDS)[number]; summary: string }>({ kind: 'appel', summary: '' });
  const [error, setError] = useState<string | null>(null);
  const overdue = lead.nextFollowUpAt !== null && Date.parse(lead.nextFollowUpAt) < Date.now() && !['inscrit', 'non_interesse'].includes(lead.status);

  const loadInteractions = useCallback(() => {
    api<{ interactions: LeadInteraction[] }>(`/api/admin/leads/${lead.id}/interactions`)
      .then((response) => setInteractions(response.interactions))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Historique indisponible.'));
  }, [lead.id]);

  useEffect(() => {
    if (open) loadInteractions();
  }, [open, loadInteractions]);

  async function mutate(path: string, method: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const response = await api<{ lead: Lead }>(path, { method, body });
      onChange(response.lead);
      if (open) loadInteractions();
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mise à jour impossible.');
      return false;
    }
  }

  async function addInteraction(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const response = await api<{ interactions: LeadInteraction[] }>(`/api/admin/leads/${lead.id}/interactions`, { method: 'POST', body: interaction });
      setInteractions(response.interactions);
      setInteraction({ ...interaction, summary: '' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <p className="font-medium">{lead.fullName}</p>
          <p className="text-xs text-stone-500">
            {[lead.phone, lead.email].filter(Boolean).join(' · ')} · {SOURCE_LABELS[lead.source]} · {formatDateTime(lead.createdAt)}
          </p>
          {(lead.desiredProgram || lead.levelEstimate) && (
            <p className="text-sm text-stone-600">
              {lead.desiredProgram}
              {lead.levelEstimate && ` · niveau estimé ${lead.levelEstimate}`}
            </p>
          )}
        </div>
        {lead.nextFollowUpAt && (
          <span className={`text-xs ${overdue ? 'font-semibold text-rosso' : 'text-stone-500'}`}>
            {overdue && <span aria-hidden>⚠ </span>}Relance : {formatDateTime(lead.nextFollowUpAt)}
          </span>
        )}
        <select
          className="input w-auto"
          aria-label={`Responsable de ${lead.fullName}`}
          value={lead.assignedTo?.id ?? ''}
          onChange={(e) => void mutate(`/api/admin/leads/${lead.id}/assignee`, 'PUT', { assigneeId: e.target.value || null })}
        >
          <option value="">Non affecté</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.fullName}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label={`Statut de ${lead.fullName}`} value={lead.status} onChange={(e) => void mutate(`/api/admin/leads/${lead.id}`, 'PATCH', { status: e.target.value })}>
          {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((status) => (
            <option key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? 'Fermer' : 'Suivi'}
        </button>
      </div>
      {lead.message && <p className="rounded-md bg-stone-50 px-3 py-2 text-sm whitespace-pre-line text-stone-700">{lead.message}</p>}
      <ErrorBanner message={error} />
      {open && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <div>
              <label className="label" htmlFor={`notes-${lead.id}`}>Notes internes</label>
              <textarea id={`notes-${lead.id}`} className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label" htmlFor={`follow-${lead.id}`}>Prochaine relance</label>
                <input id={`follow-${lead.id}`} type="datetime-local" className="input" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              </div>
              <button className="btn-primary" onClick={() => void mutate(`/api/admin/leads/${lead.id}`, 'PATCH', { notes, nextFollowUpAt: followUp ? new Date(followUp).toISOString() : null })}>
                Enregistrer
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <form onSubmit={addInteraction} className="flex flex-wrap gap-2">
              <select className="input w-auto" aria-label="Type d’interaction" value={interaction.kind} onChange={(e) => setInteraction({ ...interaction, kind: e.target.value as (typeof MANUAL_KINDS)[number] })}>
                {MANUAL_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {INTERACTION_LABELS[kind]}
                  </option>
                ))}
              </select>
              <input className="input min-w-40 flex-1" required maxLength={2000} placeholder="Résumé de l’échange" aria-label="Résumé de l’échange" value={interaction.summary} onChange={(e) => setInteraction({ ...interaction, summary: e.target.value })} />
              <button type="submit" className="btn-secondary">
                Ajouter
              </button>
            </form>
            <ol className="max-h-56 space-y-1 overflow-y-auto text-sm">
              {interactions?.length === 0 && <li className="text-stone-500">Aucune interaction.</li>}
              {interactions?.map((item) => (
                <li key={item.id} className="border-l-2 border-stone-200 pl-2">
                  <span className="font-medium">{INTERACTION_LABELS[item.kind]}</span> · {item.summary}
                  <span className="block text-xs text-stone-500">
                    {formatDateTime(item.createdAt)}
                    {item.actorName && ` · ${item.actorName}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProspectsPage() {
  const [tab, setTab] = useState<'leads' | 'tests'>('leads');
  const [status, setStatus] = useState<LeadStatus | ''>('');
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [attempts, setAttempts] = useState<LevelTestAttempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(() => {
    api<{ leads: Lead[] }>(`/api/admin/leads${status ? `?status=${status}` : ''}`)
      .then((response) => setLeads(response.leads))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les prospects.'));
  }, [status]);

  useEffect(loadLeads, [loadLeads]);

  useEffect(() => {
    api<{ assignees: Assignee[] }>('/api/admin/leads/assignees')
      .then((response) => setAssignees(response.assignees))
      .catch(() => setAssignees([]));
  }, []);

  useEffect(() => {
    if (tab !== 'tests' || attempts) return;
    api<{ attempts: LevelTestAttempt[] }>('/api/admin/level-test-attempts')
      .then((response) => setAttempts(response.attempts))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les résultats.'));
  }, [tab, attempts]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Prospects</h1>
        <p className="text-stone-600">Demandes du formulaire de contact et du test de niveau (avec consentement).</p>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-stone-200">
        {(
          [
            ['leads', 'À recontacter'],
            ['tests', 'Résultats du test de niveau'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-verde text-verde-dark' : 'border-transparent text-stone-600'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {tab === 'leads' ? (
        <>
          <select className="input w-auto" aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | '')}>
            <option value="">Tous les statuts</option>
            {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <div className="card divide-y divide-stone-100 p-0">
            {leads?.length === 0 && <p className="px-4 py-6 text-center text-stone-500">Aucun prospect.</p>}
            {leads?.map((lead) => (
              <LeadRow key={lead.id} lead={lead} assignees={assignees} onChange={(next) => setLeads((current) => current?.map((item) => (item.id === next.id ? next : item)) ?? null)} />
            ))}
          </div>
        </>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Personne</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3">Niveau estimé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {attempts?.map((attempt) => (
                <tr key={attempt.id}>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTime(attempt.createdAt)}</td>
                  <td className="px-4 py-3">{attempt.contactConsent ? attempt.fullName : <span className="text-stone-400">Anonyme</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {attempt.score} / {attempt.total}
                  </td>
                  <td className="px-4 py-3 font-semibold">{attempt.estimatedLevel ?? 'Débutant'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
