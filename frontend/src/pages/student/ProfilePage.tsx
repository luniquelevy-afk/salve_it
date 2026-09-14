import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import type { StudentProfile, TestTemplate } from '../../lib/types';

type Options = [string, string][];

const EDUCATION: Options = [
  ['lycee', 'Lycée'],
  ['baccalaureat', 'Baccalauréat obtenu'],
  ['licence_en_cours', 'Licence en cours'],
  ['licence', 'Licence obtenue'],
  ['master', 'Master'],
  ['autre', 'Autre'],
];
const ENGLISH: Options = [['aucun', 'Aucune notion'], ...(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => [level, level]) as Options)];
const INSTITUTION: Options = [
  ['public', 'Université publique'],
  ['prive', 'Établissement privé'],
  ['indifferent', 'Indifférent'],
];
const OBJECTIVE: Options = [
  ['licence', 'Licence'],
  ['master', 'Master'],
  ['formation_pro', 'Formation professionnelle'],
  ['mobilite', 'Mobilité / échange'],
];
const BUDGET: Options = [
  ['moins_500', 'Moins de 500 € par mois'],
  ['500_800', '500 à 800 € par mois'],
  ['800_1200', '800 à 1 200 € par mois'],
  ['plus_1200', 'Plus de 1 200 € par mois'],
  ['non_defini', 'Pas encore défini'],
];
const FINANCING: Options = [
  ['famille', 'Ma famille'],
  ['garant', 'Un garant'],
  ['bourse', 'Une bourse'],
  ['personnel', 'Moi-même'],
  ['non_defini', 'Pas encore défini'],
];
const VISA: Options = [
  ['etudes', 'Visa pour études'],
  ['tourisme', 'Visa touristique'],
  ['travail', 'Visa pour travail'],
];
const STAGE: Options = [
  ['exploration', 'Je me renseigne'],
  ['choix_formation', 'Je choisis ma formation'],
  ['preparation_tests', 'Je prépare les tests d’admission'],
  ['preinscription', 'Préinscription en cours (Universitaly)'],
  ['visa', 'Je prépare ma demande de visa'],
  ['depart', 'Départ imminent'],
];

function SelectField({ id, label, value, options, onChange, hint }: { id: string; label: string; value: string | null; options: Options; onChange: (value: string | null) => void; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— Non renseigné —</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

export const PROFILE_LABELS: Record<'education' | 'english' | 'institution' | 'objective' | 'budget' | 'financing' | 'stage', Record<string, string>> = {
  education: Object.fromEntries(EDUCATION),
  english: Object.fromEntries(ENGLISH),
  institution: Object.fromEntries(INSTITUTION),
  objective: Object.fromEntries(OBJECTIVE),
  budget: Object.fromEntries(BUDGET),
  financing: Object.fromEntries(FINANCING),
  stage: Object.fromEntries(STAGE),
};

const toLines = (values: string[]) => values.join('\n');
const fromLines = (value: string) => value.split(/\n|,/).map((line) => line.trim()).filter(Boolean);

// EF-39 : profil académique et projet ; alimente le parcours et l'indicateur de préparation.
export function ProfilePage() {
  const { me } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [diplomas, setDiplomas] = useState('');
  const [cities, setCities] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<{ profile: StudentProfile }>('/api/student/profile'), api<{ templates: TestTemplate[] }>('/api/test-templates')])
      .then(([profileResponse, templatesResponse]) => {
        setProfile(profileResponse.profile);
        setDiplomas(toLines(profileResponse.profile.diplomas));
        setCities(toLines(profileResponse.profile.preferredCities));
        setTemplates(templatesResponse.templates);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le profil.'));
  }, []);

  if (!profile) return <ErrorBanner message={error} />;

  const set = (patch: Partial<StudentProfile>) => {
    setProfile({ ...profile, ...patch });
    setSaved(false);
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const response = await api<{ profile: StudentProfile }>('/api/student/profile', {
        method: 'PUT',
        body: {
          currentEducationLevel: profile.currentEducationLevel,
          diplomas: fromLines(diplomas),
          englishLevel: profile.englishLevel,
          desiredField: profile.desiredField,
          preferredCities: fromLines(cities),
          institutionTypePreference: profile.institutionTypePreference,
          studyObjective: profile.studyObjective,
          budgetRange: profile.budgetRange,
          financingSource: profile.financingSource,
          projectStage: profile.projectStage,
          targetIntake: profile.targetIntake,
          targetTemplateId: profile.targetTemplate?.id ?? null,
          visaType: profile.visaType,
          hasGuarantor: profile.hasGuarantor,
        },
      });
      setProfile(response.profile);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mon profil et mon projet</h1>
        <p className="text-stone-600">Ces informations servent à personnaliser votre parcours. Votre niveau d’italien ({me?.level ?? 'non renseigné'}) est défini par le centre.</p>
      </div>

      <ErrorBanner message={error} />

      <section className="card space-y-4">
        <h2 className="font-semibold">Parcours scolaire</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="education" label="Niveau d’études actuel" value={profile.currentEducationLevel} options={EDUCATION} onChange={(value) => set({ currentEducationLevel: value })} />
          <SelectField id="english" label="Niveau d’anglais" value={profile.englishLevel} options={ENGLISH} onChange={(value) => set({ englishLevel: value })} />
        </div>
        <div>
          <label className="label" htmlFor="diplomas">Diplômes obtenus (un par ligne)</label>
          <textarea id="diplomas" className="input min-h-20" value={diplomas} onChange={(e) => setDiplomas(e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Projet d’études en Italie</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="objective" label="Objectif" value={profile.studyObjective} options={OBJECTIVE} onChange={(value) => set({ studyObjective: value })} />
          <div>
            <label className="label" htmlFor="field">Domaine d’études souhaité</label>
            <input id="field" className="input" maxLength={120} placeholder="ex. informatique, économie" value={profile.desiredField ?? ''} onChange={(e) => set({ desiredField: e.target.value || null })} />
          </div>
          <SelectField id="institution" label="Type d’établissement" value={profile.institutionTypePreference} options={INSTITUTION} onChange={(value) => set({ institutionTypePreference: value })} />
          <div>
            <label className="label" htmlFor="intake">Rentrée visée</label>
            <input id="intake" className="input" maxLength={60} placeholder="ex. septembre 2027" value={profile.targetIntake ?? ''} onChange={(e) => set({ targetIntake: e.target.value || null })} />
          </div>
          <div>
            <label className="label" htmlFor="cities">Villes préférées (une par ligne)</label>
            <textarea id="cities" className="input min-h-20" value={cities} onChange={(e) => setCities(e.target.value)} />
          </div>
          <div className="space-y-4">
            <SelectField id="stage" label="Où en êtes-vous ?" value={profile.projectStage} options={STAGE} onChange={(value) => set({ projectStage: value })} />
            <div>
              <label className="label" htmlFor="template">Test d’admission visé</label>
              <select
                id="template"
                className="input"
                value={profile.targetTemplate?.id ?? ''}
                onChange={(e) => {
                  const template = templates.find((candidate) => candidate.id === e.target.value);
                  set({ targetTemplate: template ? { id: template.id, name: template.name } : null });
                }}
              >
                <option value="">— Pas encore choisi —</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Financement</h2>
        <p className="text-sm text-stone-600">Indiquez seulement une fourchette : aucun montant précis ni justificatif n’est demandé ici.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="financing" label="Qui finance vos études ?" value={profile.financingSource} options={FINANCING} onChange={(value) => set({ financingSource: value })} />
          <SelectField id="budget" label="Budget mensuel prévu" value={profile.budgetRange} options={BUDGET} onChange={(value) => set({ budgetRange: value })} />
          <SelectField
            id="visa"
            label="Type de visa demandé"
            value={profile.visaType}
            options={VISA}
            onChange={(value) => set({ visaType: value as StudentProfile['visaType'] })}
            hint="Détermine les documents de votre checklist."
          />
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="accent-verde" checked={profile.hasGuarantor === true} onChange={(e) => set({ hasGuarantor: e.target.checked })} />
            Un garant se porte caution pour mon séjour
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {saved && (
          <span className="text-sm text-verde-dark">
            Profil enregistré. <Link to="/etudiant" className="underline">Voir mon parcours</Link>
          </span>
        )}
      </div>
    </form>
  );
}
