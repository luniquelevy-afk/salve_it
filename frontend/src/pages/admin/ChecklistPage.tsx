import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { VISA_LABELS, type ChecklistRequirement, type VisaType } from '../../lib/types';

const VISA_TYPES = Object.keys(VISA_LABELS) as VisaType[];
const today = () => new Date().toISOString().slice(0, 10);

type Draft = Omit<ChecklistRequirement, 'id' | 'lastVerifiedAt'> & { id: string | null };

const EMPTY: Draft = {
  id: null,
  code: '',
  label: '',
  description: '',
  documentType: null,
  visaTypes: ['etudes'],
  financingSources: null,
  requiresGuarantor: null,
  sourceLabel: '',
  sourceUrl: '',
  requiresHumanVerification: true,
  displayOrder: 0,
  isActive: true,
};

// EF-48 / ENF-12 : chaque exigence renvoie à sa source et porte la date de sa dernière vérification.
export function ChecklistPage() {
  const [requirements, setRequirements] = useState<ChecklistRequirement[] | null>(null);
  const [documentTypes, setDocumentTypes] = useState<{ code: string; label: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await api<{ requirements: ChecklistRequirement[]; documentTypes: { code: string; label: string }[] }>('/api/admin/checklist');
      setRequirements(response.requirements);
      setDocumentTypes(response.documentTypes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la checklist.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify(requirement: ChecklistRequirement) {
    if (!window.confirm(`Confirmez-vous avoir vérifié aujourd’hui « ${requirement.label} » sur la source officielle (${requirement.sourceLabel ?? requirement.sourceUrl}) ?`)) return;
    try {
      await api(`/api/admin/checklist/${requirement.id}/verify`, { method: 'POST', body: { verifiedOn: today() } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setError(null);
    const { id, ...body } = draft;
    if (id && !window.confirm('Modifier une exigence efface sa date de vérification : il faudra la revérifier. Continuer ?')) return;
    try {
      await api(id ? `/api/admin/checklist/${id}` : '/api/admin/checklist', {
        method: id ? 'PUT' : 'POST',
        body: { ...body, description: body.description || null, sourceLabel: body.sourceLabel || null, sourceUrl: body.sourceUrl || null, documentType: body.documentType || null },
      });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    }
  }

  const unverified = requirements?.filter((requirement) => requirement.isActive && !requirement.lastVerifiedAt).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Checklist visa</h1>
          <p className="text-stone-600">Exigences affichées aux étudiants, selon leur type de visa et leur financement.</p>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setDraft(draft ? null : EMPTY)}>
          {draft ? 'Fermer' : 'Nouvelle exigence'}
        </button>
      </div>

      {unverified > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <span aria-hidden>⚠</span> {unverified} exigence(s) active(s) n’ont jamais été vérifiées sur leur source officielle. Les étudiants les voient avec la mention « Pas encore vérifié
          par le centre ».
        </p>
      )}

      <ErrorBanner message={error} />

      {draft && (
        <form onSubmit={save} className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="r-code">Code</label>
              <input id="r-code" className="input" required pattern="[a-z0-9_]{2,60}" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="r-label">Libellé</label>
              <input id="r-label" className="input" required maxLength={200} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="r-description">Description</label>
              <input id="r-description" className="input" maxLength={1000} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="r-type">Document à déposer</label>
              <select id="r-type" className="input" value={draft.documentType ?? ''} onChange={(e) => setDraft({ ...draft, documentType: e.target.value || null })}>
                <option value="">Aucun (information seule)</option>
                {documentTypes.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="label">Visas concernés</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {VISA_TYPES.map((visa) => (
                  <label key={visa} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      className="accent-verde"
                      checked={draft.visaTypes.includes(visa)}
                      onChange={(e) => setDraft({ ...draft, visaTypes: e.target.checked ? [...draft.visaTypes, visa] : draft.visaTypes.filter((value) => value !== visa) })}
                    />
                    {VISA_LABELS[visa]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className="label" htmlFor="r-source-label">Source officielle (nom)</label>
              <input id="r-source-label" className="input" maxLength={200} value={draft.sourceLabel ?? ''} onChange={(e) => setDraft({ ...draft, sourceLabel: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="r-source-url">Source officielle (lien https)</label>
              <input id="r-source-url" type="url" pattern="https://.*" className="input" value={draft.sourceUrl ?? ''} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-verde" checked={draft.requiresGuarantor === true} onChange={(e) => setDraft({ ...draft, requiresGuarantor: e.target.checked ? true : null })} />
              Seulement si l’étudiant a un garant
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-verde" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2">
              Ordre
              <input type="number" min={0} className="input w-20" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) })} />
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={draft.visaTypes.length === 0}>
            Enregistrer
          </button>
        </form>
      )}

      <div className="card divide-y divide-stone-100 p-0">
        {requirements?.map((requirement) => (
          <div key={requirement.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {requirement.label} {!requirement.isActive && <span className="text-xs text-stone-400">(inactive)</span>}
              </p>
              <p className="text-xs text-stone-500">
                {requirement.visaTypes.map((visa) => VISA_LABELS[visa]).join(', ')}
                {requirement.requiresGuarantor && ' · avec garant'}
                {requirement.documentType && ` · document : ${documentTypes.find((type) => type.code === requirement.documentType)?.label ?? requirement.documentType}`}
              </p>
              {requirement.sourceUrl && (
                <a href={requirement.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-verde-dark hover:underline">
                  {requirement.sourceLabel ?? requirement.sourceUrl} ↗
                </a>
              )}
            </div>
            <span className={`text-xs font-medium ${requirement.lastVerifiedAt ? 'text-verde-dark' : 'text-amber-800'}`}>
              {requirement.lastVerifiedAt ? (
                <>
                  <span aria-hidden>✓</span> Vérifiée le {new Date(`${requirement.lastVerifiedAt}T00:00:00`).toLocaleDateString('fr-FR')}
                </>
              ) : (
                <>
                  <span aria-hidden>⚠</span> Jamais vérifiée
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary px-3 py-1 text-xs" disabled={!requirement.sourceUrl} onClick={() => void verify(requirement)}>
                Vérifiée aujourd’hui
              </button>
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => {
                  // La date de vérification n'est jamais éditable : elle est effacée par toute modification.
                  const { lastVerifiedAt: _lastVerifiedAt, ...editable } = requirement;
                  setDraft(editable);
                }}
              >
                Modifier
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
