import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { formatDateTime, formatMinutes } from '../../lib/format';
import type { AdminTestTemplate } from '../../lib/types';
import { SectionTabs } from '../../components/SectionTabs';
import { TEST_TABS } from '../../components/section-tabs';

interface Draft {
  id: string | null;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  scoringRules: { correct: number; wrong: number; blank: number };
  isActive: boolean;
  sections: { name: string; category: string; questionCount: number }[];
}

const EMPTY: Draft = {
  id: null,
  code: '',
  name: '',
  description: '',
  durationMinutes: 60,
  scoringRules: { correct: 1, wrong: -0.25, blank: 0 },
  isActive: false,
  sections: [{ name: '', category: '', questionCount: 10 }],
};

// EF-42 : modèles de test configurables (sections, durée, barème) — à paramétrer depuis le règlement officiel en vigueur.
export function TestTemplatesPage() {
  const [templates, setTemplates] = useState<AdminTestTemplate[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [templatesResponse, categoriesResponse] = await Promise.all([
        api<{ templates: AdminTestTemplate[] }>('/api/admin/learning/test-templates'),
        api<{ categories: string[] }>('/api/questions/categories'),
      ]);
      setTemplates(templatesResponse.templates);
      setCategories(categoriesResponse.categories);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les modèles.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(template: AdminTestTemplate) {
    setDraft({
      id: template.id,
      code: template.code,
      name: template.name,
      description: template.description ?? '',
      durationMinutes: Math.round(template.totalDurationSeconds / 60),
      scoringRules: template.scoringRules,
      isActive: template.isActive,
      sections: template.sections.map(({ name, category, questionCount }) => ({ name, category, questionCount })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (draft.id && !window.confirm('Enregistrer crée une nouvelle version du modèle. Les simulations déjà passées ne sont pas modifiées. Continuer ?')) return;
    setSaving(true);
    setError(null);
    const body = {
      code: draft.code.trim().toUpperCase(),
      name: draft.name,
      description: draft.description || null,
      language: 'it',
      totalDurationSeconds: Math.round(draft.durationMinutes * 60),
      scoringRules: draft.scoringRules,
      isActive: draft.isActive,
      sections: draft.sections.map((section) => ({ ...section, category: section.category.trim().toLowerCase() })),
    };
    try {
      await api(draft.id ? `/api/admin/learning/test-templates/${draft.id}` : '/api/admin/learning/test-templates', { method: draft.id ? 'PUT' : 'POST', body });
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  const updateSection = (index: number, patch: Partial<Draft['sections'][number]>) =>
    draft && setDraft({ ...draft, sections: draft.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)) });
  const totalQuestions = draft?.sections.reduce((sum, section) => sum + (Number(section.questionCount) || 0), 0) ?? 0;

  return (
    <div className="space-y-5">
      <SectionTabs tabs={TEST_TABS} label="Tests et questions" />
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Modèles de test</h1>
          <p className="text-stone-600">Sections, durées et barèmes : à reprendre du règlement officiel en vigueur, qui change chaque année.</p>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setDraft(draft ? null : EMPTY)}>
          {draft ? 'Fermer' : 'Nouveau modèle'}
        </button>
      </div>

      <ErrorBanner message={error} />

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="font-semibold">{draft.id ? 'Modifier le modèle' : 'Nouveau modèle'}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="t-code">Code</label>
              <input id="t-code" className="input uppercase" required pattern="[A-Za-z0-9-]{2,40}" placeholder="TOLC-E" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="t-name">Nom affiché</label>
              <input id="t-name" className="input" required maxLength={160} placeholder="Simulation de type TOLC-E" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="label" htmlFor="t-description">Description</label>
              <input id="t-description" className="input" maxLength={1000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="t-duration">Durée totale (minutes)</label>
              <input id="t-duration" type="number" min={1} max={360} className="input" required value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="label">Barème (points)</legend>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['correct', 'Bonne', 0, 10],
                    ['wrong', 'Mauvaise', -10, 0],
                    ['blank', 'Sans réponse', -10, 10],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <label key={key} className="text-xs text-stone-600">
                    {label}
                    <input
                      type="number"
                      step="0.05"
                      min={min}
                      max={max}
                      className="input mt-1"
                      value={draft.scoringRules[key]}
                      onChange={(e) => setDraft({ ...draft, scoringRules: { ...draft.scoringRules, [key]: Number(e.target.value) } })}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset className="space-y-2">
            <legend className="label">Sections ({totalQuestions} questions au total)</legend>
            <datalist id="template-categories">
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
            {draft.sections.map((section, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                <input className="input" required maxLength={120} placeholder="Nom (ex. Matematica)" aria-label={`Nom de la section ${index + 1}`} value={section.name} onChange={(e) => updateSection(index, { name: e.target.value })} />
                <input className="input" required maxLength={60} list="template-categories" placeholder="Catégorie de questions" aria-label={`Catégorie de la section ${index + 1}`} value={section.category} onChange={(e) => updateSection(index, { category: e.target.value })} />
                <input type="number" min={1} max={200} className="input" required aria-label={`Nombre de questions de la section ${index + 1}`} value={section.questionCount} onChange={(e) => updateSection(index, { questionCount: Number(e.target.value) })} />
                {draft.sections.length > 1 && (
                  <button type="button" className="text-xs text-rosso hover:underline" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}>
                    Retirer
                  </button>
                )}
              </div>
            ))}
            {draft.sections.length < 20 && (
              <button type="button" className="btn-secondary" onClick={() => setDraft({ ...draft, sections: [...draft.sections, { name: '', category: '', questionCount: 10 }] })}>
                + Ajouter une section
              </button>
            )}
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-verde" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />
            Actif (proposé aux étudiants)
          </label>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {templates?.map((template) => (
          <article key={template.id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{template.name}</h2>
              <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">{template.code}</code>
              <span className={`rounded-full px-2 py-0.5 text-xs ${template.isActive ? 'bg-verde/10 text-verde-dark' : 'bg-stone-100 text-stone-600'}`}>
                {template.isActive ? 'Actif' : 'Inactif'}
              </span>
              <span className="text-xs text-stone-500">
                v{template.version} · {formatMinutes(template.totalDurationSeconds)} · barème +{template.scoringRules.correct} / {template.scoringRules.wrong} / {template.scoringRules.blank} ·{' '}
                {template.simulationCount} simulation(s) · modifié le {formatDateTime(template.updatedAt)}
              </span>
              <button className="btn-secondary ml-auto px-3 py-1 text-xs" onClick={() => edit(template)}>
                Modifier
              </button>
            </div>
            {template.missingQuestions.length > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                Banque insuffisante : il manque {template.missingQuestions.map((entry) => `${entry.missing} question(s) « ${entry.category} »`).join(', ')}. Le test ne peut pas être lancé.{' '}
                <Link to="/banque-questions" className="underline">
                  Banque de questions
                </Link>
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-xs uppercase text-stone-500">
                  <tr>
                    <th className="py-1 pr-4">Section</th>
                    <th className="py-1 pr-4">Catégorie</th>
                    <th className="py-1 pr-4 text-right">Questions</th>
                    <th className="py-1 text-right">Actives en banque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {template.sections.map((section) => (
                    <tr key={section.id}>
                      <td className="py-1.5 pr-4">{section.name}</td>
                      <td className="py-1.5 pr-4 text-stone-600">{section.category}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{section.questionCount}</td>
                      <td className={`py-1.5 text-right tabular-nums ${section.activeQuestions < section.questionCount ? 'font-semibold text-rosso' : ''}`}>{section.activeQuestions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
