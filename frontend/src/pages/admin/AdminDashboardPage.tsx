import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClassOverview, HardestQuestionsTable } from '../../components/ClassOverview';
import { DocumentsOverviewPanel } from '../../components/DocumentsOverviewPanel';
import { ErrorBanner } from '../../components/ErrorBanner';
import { StatTile } from '../../components/Meter';
import { api, ApiError } from '../../lib/api';
import type { AdminOverview, TeacherOverview } from '../../lib/types';

const OPERATION_LABELS: Record<string, string> = {
  embassy_turn: 'Tours d’entretien',
  embassy_report: 'Rapports d’entretien',
  question_generation: 'Génération de questions',
};

const SOURCE_LABELS: Record<string, string> = { contact_form: 'Formulaire de contact', level_test: 'Test de niveau' };

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const orDash = (value: number | null, suffix = '') => (value === null ? '—' : `${value}${suffix}`);

// §16.3 : activité, entretiens, coûts IA, prospects, qualité de la banque.
export function AdminDashboardPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [classes, setClasses] = useState<TeacherOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<AdminOverview>('/api/admin/learning/dashboard'), api<TeacherOverview>('/api/teacher/overview')])
      .then(([adminResponse, classResponse]) => {
        setOverview(adminResponse);
        setClasses(classResponse);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger le tableau de bord.'));
  }, []);

  if (!overview) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const { students, simulations, exercises, embassy, ai, leads } = overview;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      <section className="space-y-3" aria-labelledby="kpi-students">
        <h2 id="kpi-students" className="text-lg font-semibold">
          Activité des étudiants
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Étudiants actifs (comptes)" value={students.total} />
          <StatTile label="Actifs sur 7 jours" value={students.active7} hint={`${students.active30} sur 30 j · ${students.active90} sur 90 j`} />
          <StatTile label="Simulations terminées (30 j)" value={simulations.completed30} hint={`Réussite moyenne : ${orDash(simulations.accuracy30, ' %')}`} />
          <StatTile label="Exercices réalisés (30 j)" value={exercises.attempts30} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="kpi-embassy">
        <h2 id="kpi-embassy" className="text-lg font-semibold">
          Entretiens consulaires et IA
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Entretiens (30 j)" value={embassy.sessions30} hint={`${embassy.completed30} terminés · durée moyenne ${orDash(embassy.averageDurationMinutes, ' min')}`} />
          <StatTile label="Incidents techniques (30 j)" value={orDash(embassy.failureRate30, ' %')} hint={`Mode écrit : ${orDash(embassy.textModeShare30, ' %')} des entretiens`} />
          <StatTile label="Coût IA du mois" value={money.format(ai.monthCost)} hint={`${ai.monthCalls} appels · ${ai.costPerStudent === null ? '—' : money.format(ai.costPerStudent)} par étudiant`} />
          <StatTile label="Score moyen d’entretien" value={orDash(embassy.averageScore)} hint="Sur 100, tous entretiens terminés" />
        </div>
        {ai.byOperation.length > 0 && (
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">Opération IA (mois en cours)</th>
                  <th className="px-4 py-2 text-right">Appels</th>
                  <th className="px-4 py-2 text-right">Coût estimé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ai.byOperation.map((operation) => (
                  <tr key={operation.operation}>
                    <td className="px-4 py-2">{OPERATION_LABELS[operation.operation] ?? operation.operation}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{operation.calls}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money.format(operation.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="kpi-leads">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 id="kpi-leads" className="text-lg font-semibold">
            Prospects
          </h2>
          <Link to="/admin/prospects" className="text-sm text-verde-dark hover:underline">
            Gérer les prospects →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Prospects au total" value={leads.total} hint={leads.bySource.map((source) => `${SOURCE_LABELS[source.source] ?? source.source} : ${source.total}`).join(' · ') || undefined} />
          <StatTile label="Nouveaux (30 j)" value={leads.new30} />
          <StatTile label="Inscrits" value={leads.converted} hint={leads.total > 0 ? `Conversion : ${Math.round((100 * leads.converted) / leads.total)} %` : undefined} />
          <StatTile label="Relances en retard" value={leads.toFollowUp} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Questions les plus ratées (toutes simulations)</h2>
          <Link to="/banque-questions" className="text-sm text-verde-dark hover:underline">
            Banque de questions →
          </Link>
        </div>
        <HardestQuestionsTable questions={overview.hardestQuestions} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Documents des étudiants</h2>
          <Link to="/admin/checklist" className="text-sm text-verde-dark hover:underline">
            Checklist visa →
          </Link>
        </div>
        <DocumentsOverviewPanel />
      </section>

      {classes && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Suivi des classes</h2>
          <ClassOverview overview={classes} />
        </section>
      )}
    </div>
  );
}
