import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import type { AdminProgram, SiteSettings } from '../../lib/types';

type Tab = 'centre' | 'formations' | 'temoignages' | 'faq' | 'galerie';

const TABS: { id: Tab; label: string }[] = [
  { id: 'centre', label: 'Le centre' },
  { id: 'formations', label: 'Formations' },
  { id: 'temoignages', label: 'Témoignages' },
  { id: 'faq', label: 'FAQ' },
  { id: 'galerie', label: 'Galerie' },
];

const errorMessage = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

// ── Informations du centre ──────────────────────────────────

const SETTINGS_FIELDS: { key: keyof SiteSettings; label: string; type?: 'textarea' | 'email' | 'url'; hint?: string }[] = [
  { key: 'centreName', label: 'Nom du centre' },
  { key: 'tagline', label: 'Accroche (titre de la page d’accueil)' },
  { key: 'about', label: 'Présentation du centre', type: 'textarea' },
  { key: 'phone', label: 'Téléphone' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Au format international, ex. +242 06 000 00 00' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'address', label: 'Adresse', type: 'textarea' },
  { key: 'openingHours', label: 'Horaires', type: 'textarea' },
  { key: 'mapUrl', label: 'Lien vers la carte (https)', type: 'url' },
  { key: 'facebookUrl', label: 'Page Facebook (https)', type: 'url' },
  { key: 'instagramUrl', label: 'Compte Instagram (https)', type: 'url' },
];

function CentreTab() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ settings: SiteSettings }>('/api/admin/site-content/settings')
      .then((response) => setSettings(response.settings))
      .catch((err: unknown) => setError(errorMessage(err, 'Chargement impossible.')));
  }, []);

  if (!settings) return <ErrorBanner message={error} />;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    try {
      const { updatedAt: _updatedAt, ...input } = settings as SiteSettings & { updatedAt?: string };
      setSettings((await api<{ settings: SiteSettings }>('/api/admin/site-content/settings', { method: 'PUT', body: input })).settings);
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible.'));
    }
  }

  const setFigure = (index: number, patch: Partial<SiteSettings['keyFigures'][number]>) =>
    setSettings({ ...settings, keyFigures: settings.keyFigures.map((figure, i) => (i === index ? { ...figure, ...patch } : figure)) });

  return (
    <form onSubmit={save} className="card space-y-4">
      <ErrorBanner message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        {SETTINGS_FIELDS.map((field) => (
          <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label className="label" htmlFor={`settings-${field.key}`}>{field.label}</label>
            {field.type === 'textarea' ? (
              <textarea
                id={`settings-${field.key}`}
                className="input min-h-20"
                value={(settings[field.key] as string | null) ?? ''}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
              />
            ) : (
              <input
                id={`settings-${field.key}`}
                type={field.type ?? 'text'}
                className="input"
                required={field.key === 'centreName'}
                value={(settings[field.key] as string | null) ?? ''}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
              />
            )}
            {field.hint && <p className="mt-1 text-xs text-stone-500">{field.hint}</p>}
          </div>
        ))}
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Chiffres clés (6 maximum, affichés sur l’accueil)</legend>
        <p className="text-xs text-stone-500">Uniquement des chiffres vérifiables : ils engagent le centre.</p>
        {settings.keyFigures.map((figure, index) => (
          <div key={index} className="flex gap-2">
            <input className="input w-28" required maxLength={20} placeholder="Valeur" aria-label={`Valeur ${index + 1}`} value={figure.value} onChange={(e) => setFigure(index, { value: e.target.value })} />
            <input className="input" required maxLength={80} placeholder="Libellé" aria-label={`Libellé ${index + 1}`} value={figure.label} onChange={(e) => setFigure(index, { label: e.target.value })} />
            <button type="button" className="text-xs text-rosso hover:underline" onClick={() => setSettings({ ...settings, keyFigures: settings.keyFigures.filter((_, i) => i !== index) })}>
              Retirer
            </button>
          </div>
        ))}
        {settings.keyFigures.length < 6 && (
          <button type="button" className="btn-secondary" onClick={() => setSettings({ ...settings, keyFigures: [...settings.keyFigures, { value: '', label: '' }] })}>
            + Ajouter un chiffre
          </button>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary">
          Enregistrer
        </button>
        {saved && <span className="text-sm text-verde-dark">Enregistré.</span>}
      </div>
    </form>
  );
}

// ── Formations publiques ────────────────────────────────────

function ProgramEditor({ program, onSaved }: { program: AdminProgram; onSaved: () => void }) {
  const [draft, setDraft] = useState({ ...program, objectivesText: program.objectives.join('\n') });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/api/admin/site-content/programs/${program.id}`, {
        method: 'PUT',
        body: {
          slug: draft.slug,
          isPublic: draft.isPublic,
          summary: draft.summary,
          description: draft.description,
          durationLabel: draft.durationLabel,
          scheduleLabel: draft.scheduleLabel,
          audience: draft.audience,
          objectives: draft.objectivesText.split('\n'),
          displayOrder: Number(draft.displayOrder) || 0,
        },
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible.'));
    }
  }

  const text = (key: 'summary' | 'durationLabel' | 'scheduleLabel' | 'audience', label: string) => (
    <div>
      <label className="label" htmlFor={`${program.id}-${key}`}>{label}</label>
      <input id={`${program.id}-${key}`} className="input" value={draft[key] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{program.name}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${program.isPublic ? 'bg-verde/10 text-verde-dark' : 'bg-stone-100 text-stone-600'}`}>
          {program.isPublic ? 'Publiée' : 'Non publiée'}
        </span>
        {program.isPublic && program.slug && (
          <Link to={`/formations/${program.slug}`} target="_blank" className="text-xs text-verde-dark hover:underline">
            /formations/{program.slug} ↗
          </Link>
        )}
        <button className="btn-secondary ml-auto px-3 py-1 text-xs" onClick={() => setOpen((value) => !value)}>
          {open ? 'Fermer' : 'Modifier'}
        </button>
      </div>
      {open && (
        <form onSubmit={save} className="space-y-3">
          <ErrorBanner message={error} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor={`${program.id}-slug`}>Adresse de la page</label>
              <input id={`${program.id}-slug`} className="input" placeholder="italien-b1" value={draft.slug ?? ''} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor={`${program.id}-order`}>Ordre d’affichage</label>
              <input id={`${program.id}-order`} type="number" min={0} className="input" value={draft.displayOrder} onChange={(e) => setDraft({ ...draft, displayOrder: Number(e.target.value) })} />
            </div>
            {text('summary', 'Résumé')}
            {text('audience', 'Public visé')}
            {text('durationLabel', 'Durée (ex. 3 mois, 60 heures)')}
            {text('scheduleLabel', 'Horaires')}
          </div>
          <div>
            <label className="label" htmlFor={`${program.id}-description`}>Description</label>
            <textarea id={`${program.id}-description`} className="input min-h-24" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`${program.id}-objectives`}>Objectifs (un par ligne)</label>
            <textarea id={`${program.id}-objectives`} className="input min-h-24" value={draft.objectivesText} onChange={(e) => setDraft({ ...draft, objectivesText: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-verde" checked={draft.isPublic} onChange={(e) => setDraft({ ...draft, isPublic: e.target.checked })} />
            Afficher sur le site public
          </label>
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </form>
      )}
    </div>
  );
}

function ProgramsTab() {
  const [programs, setPrograms] = useState<AdminProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ programs: AdminProgram[] }>('/api/admin/site-content/programs')
      .then((response) => setPrograms(response.programs))
      .catch((err: unknown) => setError(errorMessage(err, 'Chargement impossible.')));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-3">
      <ErrorBanner message={error} />
      <p className="text-sm text-stone-600">
        Les programmes se créent dans <Link to="/classes" className="text-verde-dark hover:underline">Classes</Link>. Ici, vous choisissez ce qui apparaît sur le site.
      </p>
      {programs?.map((program) => <ProgramEditor key={`${program.id}-${program.slug}-${program.isPublic}`} program={program} onSaved={load} />)}
    </div>
  );
}

// ── Collections ─────────────────────────────────────────────

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'checkbox' | 'number';
  required?: boolean;
  hint?: string;
}

interface CollectionConfig {
  endpoint: string;
  itemLabel: string;
  fields: FieldConfig[];
  empty: Record<string, unknown>;
  summary: (item: Record<string, unknown>) => string;
  notice?: string;
}

const COLLECTIONS: Record<'temoignages' | 'faq' | 'galerie', CollectionConfig> = {
  temoignages: {
    endpoint: 'testimonials',
    itemLabel: 'témoignage',
    notice: 'Ne publiez un témoignage qu’avec l’accord écrit de la personne (nom, citation et photo).',
    fields: [
      { key: 'authorName', label: 'Nom affiché', type: 'text', required: true },
      { key: 'authorContext', label: 'Contexte (ex. Étudiante en ingénierie à Pise)', type: 'text' },
      { key: 'quote', label: 'Citation', type: 'textarea', required: true },
      { key: 'photoUrl', label: 'Photo (lien https, facultatif)', type: 'url' },
      { key: 'consentConfirmed', label: 'J’ai l’accord écrit de la personne', type: 'checkbox' },
      { key: 'isPublished', label: 'Publié', type: 'checkbox' },
      { key: 'displayOrder', label: 'Ordre', type: 'number' },
    ],
    empty: { authorName: '', authorContext: '', quote: '', photoUrl: '', consentConfirmed: false, isPublished: false, displayOrder: 0 },
    summary: (item) => `${String(item.authorName)} — « ${String(item.quote).slice(0, 80)}${String(item.quote).length > 80 ? '…' : ''} »`,
  },
  faq: {
    endpoint: 'faq',
    itemLabel: 'question',
    fields: [
      { key: 'question', label: 'Question', type: 'text', required: true },
      { key: 'answer', label: 'Réponse', type: 'textarea', required: true },
      { key: 'isPublished', label: 'Publiée', type: 'checkbox' },
      { key: 'displayOrder', label: 'Ordre', type: 'number' },
    ],
    empty: { question: '', answer: '', isPublished: true, displayOrder: 0 },
    summary: (item) => String(item.question),
  },
  galerie: {
    endpoint: 'gallery',
    itemLabel: 'photo',
    notice: 'Utilisez des images légères (moins de 300 Ko) : beaucoup de visiteurs ont une connexion limitée. Vérifiez l’accord des personnes photographiées.',
    fields: [
      { key: 'imageUrl', label: 'Lien de l’image (https)', type: 'url', required: true },
      { key: 'altText', label: 'Description de l’image (accessibilité)', type: 'text', required: true },
      { key: 'caption', label: 'Légende', type: 'text' },
      { key: 'isPublished', label: 'Publiée', type: 'checkbox' },
      { key: 'displayOrder', label: 'Ordre', type: 'number' },
    ],
    empty: { imageUrl: '', altText: '', caption: '', isPublished: false, displayOrder: 0 },
    summary: (item) => String(item.altText),
  },
};

function CollectionTab({ config }: { config: CollectionConfig }) {
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/admin/site-content/${config.endpoint}`;

  const load = useCallback(() => {
    api<{ items: Record<string, unknown>[] }>(base)
      .then((response) => setItems(response.items))
      .catch((err: unknown) => setError(errorMessage(err, 'Chargement impossible.')));
  }, [base]);
  useEffect(load, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setError(null);
    const { id, ...fields } = draft;
    try {
      await api(id ? `${base}/${String(id)}` : base, { method: id ? 'PUT' : 'POST', body: { ...fields, displayOrder: Number(fields.displayOrder) || 0 } });
      setDraft(null);
      load();
    } catch (err) {
      setError(errorMessage(err, 'Enregistrement impossible.'));
    }
  }

  async function remove(item: Record<string, unknown>) {
    if (!window.confirm(`Supprimer ce ${config.itemLabel} ?`)) return;
    try {
      await api(`${base}/${String(item.id)}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(errorMessage(err, 'Suppression impossible.'));
    }
  }

  return (
    <div className="space-y-4">
      {config.notice && <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">{config.notice}</p>}
      <ErrorBanner message={error} />
      <button className="btn-primary" onClick={() => setDraft(draft ? null : { ...config.empty })}>
        {draft ? 'Fermer' : `Ajouter un(e) ${config.itemLabel}`}
      </button>

      {draft && (
        <form onSubmit={save} className="card space-y-3">
          {config.fields.map((field) =>
            field.type === 'checkbox' ? (
              <label key={field.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-verde" checked={Boolean(draft[field.key])} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.checked })} />
                {field.label}
              </label>
            ) : (
              <div key={field.key}>
                <label className="label" htmlFor={`${config.endpoint}-${field.key}`}>{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea id={`${config.endpoint}-${field.key}`} className="input min-h-24" required={field.required} value={String(draft[field.key] ?? '')} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
                ) : (
                  <input
                    id={`${config.endpoint}-${field.key}`}
                    type={field.type}
                    className="input"
                    required={field.required}
                    min={field.type === 'number' ? 0 : undefined}
                    pattern={field.type === 'url' ? 'https://.*' : undefined}
                    value={String(draft[field.key] ?? '')}
                    onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                  />
                )}
              </div>
            ),
          )}
          {config.endpoint === 'gallery' && typeof draft.imageUrl === 'string' && draft.imageUrl.startsWith('https://') && (
            <img src={draft.imageUrl} alt="Aperçu" className="h-32 rounded-lg object-cover" />
          )}
          <button type="submit" className="btn-primary">
            Enregistrer
          </button>
        </form>
      )}

      <div className="card divide-y divide-stone-100 p-0">
        {items?.length === 0 && <p className="px-4 py-6 text-center text-stone-500">Rien pour le moment.</p>}
        {items?.map((item) => (
          <div key={String(item.id)} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className={`rounded-full px-2 py-0.5 text-xs ${item.isPublished ? 'bg-verde/10 text-verde-dark' : 'bg-stone-100 text-stone-600'}`}>
              {item.isPublished ? 'Publié' : 'Masqué'}
            </span>
            <span className="min-w-0 flex-1 truncate">{config.summary(item)}</span>
            <button className="btn-secondary px-3 py-1 text-xs" onClick={() => setDraft({ ...config.empty, ...item })}>
              Modifier
            </button>
            <button className="btn-danger px-3 py-1 text-xs" onClick={() => void remove(item)}>
              Supprimer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SiteContentPage() {
  const [tab, setTab] = useState<Tab>('centre');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Site public</h1>
          <p className="text-stone-600">Contenu affiché sur le site vitrine.</p>
        </div>
        <Link to="/" target="_blank" className="btn-secondary ml-auto">
          Voir le site ↗
        </Link>
      </div>

      <div role="tablist" className="flex flex-wrap gap-1 border-b border-stone-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === item.id ? 'border-verde text-verde-dark' : 'border-transparent text-stone-600 hover:text-stone-900'}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'centre' && <CentreTab />}
      {tab === 'formations' && <ProgramsTab />}
      {(tab === 'temoignages' || tab === 'faq' || tab === 'galerie') && <CollectionTab key={tab} config={COLLECTIONS[tab]} />}
    </div>
  );
}
