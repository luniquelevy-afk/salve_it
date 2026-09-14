import {
  REPORT_DIMENSION_LABELS,
  type EmbassyInconsistency,
  type EmbassyReport,
  type InconsistencySource,
  type KeyFactKey,
  type ReportDimension,
  type ReportLevel,
} from '../lib/types';
import { Meter } from './Meter';

const LEVEL_LABELS: Record<ReportLevel, { label: string; className: string }> = {
  faible: { label: 'Préparation insuffisante', className: 'bg-rosso/10 text-rosso' },
  intermediaire: { label: 'Préparation intermédiaire', className: 'bg-amber-100 text-amber-800' },
  satisfaisante: { label: 'Préparation satisfaisante', className: 'bg-verde/10 text-verde-dark' },
};

const SOURCE_LABELS: Record<InconsistencySource, string> = {
  profil: 'Par rapport au profil déclaré',
  entretien_precedent: 'Par rapport à l’entretien précédent',
  meme_entretien: 'Au cours de cet entretien',
};

const KEY_FACT_LABELS: Record<KeyFactKey, string> = {
  field_of_study: 'Domaine',
  institution: 'Établissement',
  city: 'Ville',
  financing: 'Financement',
  monthly_budget: 'Budget mensuel',
  accommodation: 'Logement',
  intake: 'Rentrée',
  after_studies: 'Après les études',
};

const BUDGET_LABELS: Record<string, string> = {
  moins_500: 'Moins de 500 € par mois',
  '500_800': '500 à 800 € par mois',
  '800_1200': '800 à 1 200 € par mois',
  plus_1200: 'Plus de 1 200 € par mois',
  non_precise: 'Non précisé',
};

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h3 className={`mb-2 font-semibold ${tone}`}>{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// §10.6 : points de cohérence, présentés comme une aide à la clarification, jamais comme une preuve.
function Inconsistencies({ items, notice }: { items: EmbassyInconsistency[]; notice: string | undefined }) {
  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Cohérence du discours</h3>
      {items.length === 0 ? (
        <p className="text-sm text-stone-600">Aucune contradiction nette relevée dans cet entretien.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={`${item.topic}-${index}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-semibold text-amber-900">⚠ {item.topic}</p>
              <p className="text-xs text-amber-800">{SOURCE_LABELS[item.source]}</p>
              <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="text-stone-500">Dit ou déclaré auparavant</dt>
                <dd className="text-stone-800">{item.declared}</dd>
                <dt className="text-stone-500">Dit dans cet entretien</dt>
                <dd className="text-stone-800">{item.stated}</dd>
                <dt className="text-stone-500">Pour clarifier</dt>
                <dd className="text-stone-800">{item.advice}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
      {notice && <p className="text-xs text-stone-500">{notice}</p>}
    </div>
  );
}

export function EmbassyReportView({ report, audience = 'student' }: { report: EmbassyReport; audience?: 'student' | 'staff' }) {
  const level = LEVEL_LABELS[report.level];

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-5">
        <div>
          <p className="text-sm text-stone-500">Appréciation globale</p>
          <p className="text-4xl font-bold">
            {report.overall_score}
            <span className="text-lg font-medium text-stone-400"> / 100</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${level.className}`}>{level.label}</span>
        <p className="w-full text-stone-700">{report.summary}</p>
      </div>

      {audience === 'staff' && report.teacher_view && (
        <div className="card space-y-3 border-verde/40">
          <div>
            <h3 className="font-semibold">Vue enseignant</h3>
            <p className="text-xs text-stone-500">Jamais montrée à l’étudiant.</p>
          </div>
          <p className="text-stone-700">{report.teacher_view.summary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold">Questions à retravailler en classe</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                {report.teacher_view.follow_up_questions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">Activités proposées</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
                {report.teacher_view.class_activities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="font-semibold">Détail par dimension</h3>
        {(Object.keys(REPORT_DIMENSION_LABELS) as ReportDimension[]).map((key) => {
          const score = report.dimensions[key];
          return (
            <div key={key}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{REPORT_DIMENSION_LABELS[key]}</span>
                <span className="font-semibold tabular-nums">{score}</span>
              </div>
              <Meter value={score} label={REPORT_DIMENSION_LABELS[key]} />
            </div>
          );
        })}
      </div>

      {report.inconsistencies && <Inconsistencies items={report.inconsistencies} notice={report.notices.inconsistencies} />}

      <div className="grid gap-4 md:grid-cols-3">
        <ReportList title="Points forts" items={report.strengths} tone="text-verde-dark" />
        <ReportList title="Points à clarifier" items={report.critical_risks} tone="text-rosso" />
        <ReportList title="Actions recommandées" items={report.recommended_actions} tone="text-stone-900" />
      </div>

      {audience === 'staff' && report.key_facts && (
        <div className="card space-y-2">
          <h3 className="font-semibold">Faits clés annoncés</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {(Object.keys(KEY_FACT_LABELS) as KeyFactKey[]).map((key) => (
              <div key={key} className="contents">
                <dt className="text-stone-500">{KEY_FACT_LABELS[key]}</dt>
                <dd>{key === 'monthly_budget' ? (BUDGET_LABELS[report.key_facts![key]] ?? report.key_facts![key]) : report.key_facts![key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="space-y-1 rounded-lg bg-stone-100 px-4 py-3 text-xs text-stone-600">
        <p>{report.notices.administrative}</p>
        <p>{report.notices.evaluationLimits}</p>
        {audience === 'staff' && (
          <p>
            Rapport produit par {report.model} · prompt {report.prompt_version}
          </p>
        )}
      </div>
    </div>
  );
}
