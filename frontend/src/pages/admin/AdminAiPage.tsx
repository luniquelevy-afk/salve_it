import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Meter } from '../../components/Meter';
import { api, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { VISA_LABELS, type AdminEmbassyScenario, type AiLimitKey, type AiLimitSource, type AiSettings, type StudentAiUsage, type VisaType } from '../../lib/types';

const usd = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });

const LIMIT_FIELDS: { key: AiLimitKey; label: string; hint: string; step: string; min: number; max: number }[] = [
  { key: 'maxTurns', label: 'Questions par entretien', hint: 'Entre 2 et 30.', step: '1', min: 2, max: 30 },
  { key: 'weeklySessionLimit', label: 'Entretiens par étudiant sur 7 jours', hint: 'Entre 0 et 100.', step: '1', min: 0, max: 100 },
  { key: 'monthlyCostLimitUsd', label: 'Coût mensuel maximum par étudiant (USD)', hint: 'Une fois atteint, aucun nouvel entretien.', step: '0.01', min: 0, max: 1000 },
  { key: 'sessionCostLimitUsd', label: 'Coût maximum par entretien (USD)', hint: 'Une fois atteint, l’entretien est clôturé proprement.', step: '0.0001', min: 0, max: 100 },
];

const SOURCE_LABELS: Record<AiLimitSource, string> = { serveur: 'configuration serveur', centre: 'réglage du centre', etudiant: 'exception étudiant' };

const isCost = (key: AiLimitKey) => key === 'monthlyCostLimitUsd' || key === 'sessionCostLimitUsd';
const formatLimit = (key: AiLimitKey, value: number) => (isCost(key) ? usd.format(value) : String(value));
const toText = (value: number | null) => (value === null ? '' : String(value));
const toNullable = (value: string) => (value.trim() === '' ? null : Number(value));
const fromSettings = (settings: AiSettings) => Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, toText(settings.settings[key])])) as Record<AiLimitKey, string>;

// ── Limites du centre (EF-59) ───────────────────────────────

function LimitsSection({ settings, onSaved }: { settings: AiSettings; onSaved: () => void }) {
  const [values, setValues] = useState(() => fromSettings(settings));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const next = await api<AiSettings>('/api/admin/learning/ai-settings', {
        method: 'PUT',
        body: Object.fromEntries(LIMIT_FIELDS.map(({ key }) => [key, toNullable(values[key])])),
      });
      setValues(fromSettings(next));
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Limites d’utilisation</h2>
        <p className="text-sm text-stone-600">Laissez un champ vide pour appliquer la valeur par défaut du serveur. Les exceptions par étudiant se règlent plus bas.</p>
      </div>
      {!settings.costTracked && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Avec le fournisseur actuel ({settings.provider}), les coûts estimés sont nuls : les plafonds de coût n’ont pas d’effet.
        </p>
      )}
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {LIMIT_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="label" htmlFor={`limit-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`limit-${field.key}`}
              type="number"
              className="input"
              min={field.min}
              max={field.max}
              step={field.step}
              placeholder={`Défaut : ${formatLimit(field.key, settings.defaults[field.key])}`}
              value={values[field.key]}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            />
            <p className="mt-1 text-xs text-stone-500">
              {field.hint} Appliqué : {formatLimit(field.key, settings.effective[field.key])} ({SOURCE_LABELS[settings.effective.sources[field.key]]}).
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="text-sm text-verde-dark" role="status">
            ✓ Limites enregistrées
          </span>
        )}
        <span className="ml-auto text-xs text-stone-500">Dernière modification : {formatDateTime(settings.updatedAt)}</span>
      </div>
    </form>
  );
}

// ── Consommation et exceptions par étudiant (ENF-07) ────────

interface OverrideDraft {
  studentId: string;
  weekly: string;
  monthly: string;
  note: string;
}

function UsageSection({ students, onChanged }: { students: StudentAiUsage[]; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<OverrideDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveOverride(studentId: string, body: { weeklySessionLimit: number | null; monthlyCostLimitUsd: number | null; note: string | null }) {
    setError(null);
    try {
      await api(`/api/admin/learning/ai-usage/${studentId}`, { method: 'PUT', body });
      setDraft(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    }
  }

  function edit(student: StudentAiUsage) {
    setDraft({
      studentId: student.studentId,
      weekly: toText(student.override?.weeklySessionLimit ?? null),
      monthly: toText(student.override?.monthlyCostLimitUsd ?? null),
      note: student.override?.note ?? '',
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Consommation par étudiant</h2>
        <p className="text-sm text-stone-600">Mois en cours. Une exception remplace les limites du centre pour un étudiant (ex. entretien réel imminent, ou abus).</p>
      </div>
      <ErrorBanner message={error} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Étudiant</th>
              <th className="px-4 py-3 text-right">7 jours</th>
              <th className="px-4 py-3 text-right">Ce mois</th>
              <th className="px-4 py-3 text-right">Coût du mois</th>
              <th className="px-4 py-3">Budget utilisé</th>
              <th className="px-4 py-3 text-right">Clôtures coût</th>
              <th className="px-4 py-3">Exception</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {students.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-stone-500">
                  Aucun étudiant actif.
                </td>
              </tr>
            )}
            {students.map((student) => (
              <Fragment key={student.studentId}>
                <tr>
                  <td className="px-4 py-3">
                    <span className="font-medium">{student.fullName}</span>
                    {student.level && <span className="ml-2 text-xs text-stone-500">{student.level}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {student.weekSessions} / {student.effective.weeklySessionLimit}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{student.monthSessions}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {usd.format(student.monthCostUsd)}
                    <span className="block text-xs text-stone-500">sur {usd.format(student.effective.monthlyCostLimitUsd)}</span>
                  </td>
                  <td className="px-4 py-3">
                    {student.budgetUsedPercent === null ? (
                      '—'
                    ) : (
                      <div className="w-28 space-y-1">
                        <span className="text-xs tabular-nums">
                          {student.budgetUsedPercent} %{student.budgetUsedPercent >= 100 && ' · atteint'}
                        </span>
                        <Meter value={student.budgetUsedPercent} label={`Budget utilisé par ${student.fullName}`} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{student.costLimitHits}</td>
                  <td className="px-4 py-3 text-xs">
                    {student.override ? (
                      <>
                        <span className="block">
                          {student.override.weeklySessionLimit ?? '—'} / sem. · {student.override.monthlyCostLimitUsd === null ? '—' : usd.format(student.override.monthlyCostLimitUsd)} / mois
                        </span>
                        {student.override.note && <span className="block text-stone-500">{student.override.note}</span>}
                      </>
                    ) : (
                      <span className="text-stone-400">Aucune</span>
                    )}
                  </td>
                  <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                    <button className="text-verde-dark hover:underline" onClick={() => (draft?.studentId === student.studentId ? setDraft(null) : edit(student))}>
                      {draft?.studentId === student.studentId ? 'Fermer' : student.override ? 'Modifier' : 'Ajouter'}
                    </button>
                    {student.override && (
                      <button
                        className="text-rosso hover:underline"
                        onClick={() => void saveOverride(student.studentId, { weeklySessionLimit: null, monthlyCostLimitUsd: null, note: null })}
                      >
                        Retirer
                      </button>
                    )}
                  </td>
                </tr>
                {draft?.studentId === student.studentId && (
                  <tr className="bg-stone-50">
                    <td colSpan={8} className="px-4 py-3">
                      <form
                        className="flex flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveOverride(student.studentId, {
                            weeklySessionLimit: toNullable(draft.weekly),
                            monthlyCostLimitUsd: toNullable(draft.monthly),
                            note: draft.note.trim() || null,
                          });
                        }}
                      >
                        <div>
                          <label className="label" htmlFor="override-weekly">
                            Entretiens / 7 jours
                          </label>
                          <input
                            id="override-weekly"
                            type="number"
                            className="input w-36"
                            min={0}
                            max={100}
                            step={1}
                            placeholder="Limite du centre"
                            value={draft.weekly}
                            onChange={(e) => setDraft({ ...draft, weekly: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor="override-monthly">
                            Coût / mois (USD)
                          </label>
                          <input
                            id="override-monthly"
                            type="number"
                            className="input w-36"
                            min={0}
                            max={1000}
                            step={0.01}
                            placeholder="Limite du centre"
                            value={draft.monthly}
                            onChange={(e) => setDraft({ ...draft, monthly: e.target.value })}
                          />
                        </div>
                        <div className="min-w-56 flex-1">
                          <label className="label" htmlFor="override-note">
                            Motif (facultatif)
                          </label>
                          <input id="override-note" className="input" maxLength={300} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
                        </div>
                        <button type="submit" className="btn-primary">
                          Enregistrer
                        </button>
                        <p className="w-full text-xs text-stone-500">Deux champs vides suppriment l’exception.</p>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Scénarios d'entretien (EF-54) ───────────────────────────

interface ScenarioDraft {
  isNew: boolean;
  code: string;
  label: string;
  description: string;
  visaTypes: VisaType[];
  agentInstructions: string;
  focusThemes: string;
  isActive: boolean;
  displayOrder: number;
}

const EMPTY_SCENARIO: ScenarioDraft = {
  isNew: true,
  code: '',
  label: '',
  description: '',
  visaTypes: ['etudes'],
  agentInstructions: '',
  focusThemes: '',
  isActive: true,
  displayOrder: 100,
};

function ScenariosSection({ scenarios, onChanged }: { scenarios: AdminEmbassyScenario[]; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<ScenarioDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function edit(scenario: AdminEmbassyScenario) {
    setDraft({ ...scenario, isNew: false, focusThemes: scenario.focusThemes.join('\n') });
    setError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (draft.visaTypes.length === 0) {
      setError('Choisissez au moins un type de visa.');
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      code: draft.code.trim(),
      label: draft.label,
      description: draft.description,
      visaTypes: draft.visaTypes,
      agentInstructions: draft.agentInstructions,
      focusThemes: draft.focusThemes
        .split('\n')
        .map((theme) => theme.trim())
        .filter(Boolean),
      isActive: draft.isActive,
      displayOrder: Number(draft.displayOrder) || 0,
    };
    try {
      await api(draft.isNew ? '/api/admin/learning/embassy-scenarios' : `/api/admin/learning/embassy-scenarios/${draft.code}`, {
        method: draft.isNew ? 'POST' : 'PUT',
        body,
      });
      setDraft(null);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  const toggleVisa = (type: VisaType) =>
    draft && setDraft({ ...draft, visaTypes: draft.visaTypes.includes(type) ? draft.visaTypes.filter((value) => value !== type) : [...draft.visaTypes, type] });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold">Scénarios d’entretien</h2>
          <p className="text-sm text-stone-600">Les consignes s’ajoutent au contexte de l’agent ; son prompt système et ses garde-fous restent inchangés.</p>
        </div>
        <button
          className="btn-primary ml-auto"
          onClick={() => {
            setDraft(draft ? null : EMPTY_SCENARIO);
            setError(null);
          }}
        >
          {draft ? 'Fermer' : 'Nouveau scénario'}
        </button>
      </div>

      <ErrorBanner message={error} />

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h3 className="font-semibold">{draft.isNew ? 'Nouveau scénario' : `Modifier « ${draft.label} »`}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="s-code">
                Code
              </label>
              <input
                id="s-code"
                className="input"
                required
                disabled={!draft.isNew}
                pattern="[a-z0-9_]{2,60}"
                title="Minuscules, chiffres et tirets bas."
                placeholder="bourse_etat"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="s-label">
                Libellé affiché
              </label>
              <input id="s-label" className="input" required minLength={2} maxLength={120} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="s-description">
              Description pour l’étudiant
            </label>
            <textarea
              id="s-description"
              className="input min-h-16"
              required
              maxLength={500}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className="label">Types de visa</legend>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(VISA_LABELS) as VisaType[]).map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-verde" checked={draft.visaTypes.includes(type)} onChange={() => toggleVisa(type)} />
                  {VISA_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor="s-instructions">
              Consignes pour l’agent
            </label>
            <textarea
              id="s-instructions"
              className="input min-h-28"
              required
              minLength={10}
              maxLength={2000}
              value={draft.agentInstructions}
              onChange={(e) => setDraft({ ...draft, agentInstructions: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="label" htmlFor="s-themes">
                Points à approfondir (un par ligne, 8 au plus)
              </label>
              <textarea id="s-themes" className="input min-h-20" value={draft.focusThemes} onChange={(e) => setDraft({ ...draft, focusThemes: e.target.value })} />
            </div>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="s-order">
                  Ordre d’affichage
                </label>
                <input
                  id="s-order"
                  type="number"
                  className="input"
                  min={0}
                  max={10000}
                  value={draft.displayOrder}
                  onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-verde"
                  disabled={!draft.isNew && draft.code === 'standard'}
                  checked={draft.isActive}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                Proposé aux étudiants
              </label>
              {!draft.isNew && draft.code === 'standard' && <p className="text-xs text-stone-500">Le scénario classique reste toujours actif.</p>}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Ordre</th>
              <th className="px-4 py-3">Scénario</th>
              <th className="px-4 py-3">Visas</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {scenarios.map((scenario) => (
              <tr key={scenario.code}>
                <td className="px-4 py-3 tabular-nums">{scenario.displayOrder}</td>
                <td className="px-4 py-3">
                  <span className="font-medium">{scenario.label}</span>
                  <span className="block text-xs text-stone-500">{scenario.code}</span>
                </td>
                <td className="px-4 py-3 text-xs">{scenario.visaTypes.map((type) => VISA_LABELS[type]).join(', ')}</td>
                <td className="px-4 py-3">{scenario.isActive ? '✓ Actif' : '○ Désactivé'}</td>
                <td className="px-4 py-3 text-right">
                  <button className="text-verde-dark hover:underline" onClick={() => edit(scenario)}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// V1.3 — administration de l'agent IA : limites (EF-59), consommation (ENF-07), scénarios (EF-54).
export function AdminAiPage() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [students, setStudents] = useState<StudentAiUsage[]>([]);
  const [scenarios, setScenarios] = useState<AdminEmbassyScenario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [settingsResponse, usageResponse, scenariosResponse] = await Promise.all([
        api<AiSettings>('/api/admin/learning/ai-settings'),
        api<{ students: StudentAiUsage[] }>('/api/admin/learning/ai-usage'),
        api<{ scenarios: AdminEmbassyScenario[] }>('/api/admin/learning/embassy-scenarios'),
      ]);
      setSettings(settingsResponse);
      setStudents(usageResponse.students);
      setScenarios(scenariosResponse.scenarios);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les réglages de l’agent.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Agent IA</h1>
        <p className="text-stone-600">Limites de coût et d’usage de l’agent ambassade, consommation par étudiant et scénarios d’entretien.</p>
        {settings && (
          <p className="text-sm text-stone-500">
            Fournisseur : {settings.provider} · modèle {settings.model}
          </p>
        )}
      </div>

      <ErrorBanner message={error} />

      {settings ? <LimitsSection settings={settings} onSaved={() => void load()} /> : !error && <p className="text-stone-500">Chargement…</p>}
      {settings && <UsageSection students={students} onChanged={load} />}
      {settings && <ScenariosSection scenarios={scenarios} onChanged={load} />}
    </div>
  );
}
