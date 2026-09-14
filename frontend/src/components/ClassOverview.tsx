import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import { MODE_LABELS, VISA_LABELS, type SimulationMode, type TeacherOverview, type VisaType } from '../lib/types';
import { Meter } from './Meter';

function StudentStatus({ student }: { student: TeacherOverview['students'][number] }) {
  if (student.inactive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
        <span aria-hidden>⏸</span> Inactif
      </span>
    );
  }
  if (student.atRisk) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rosso">
        <span aria-hidden>⚠</span> À suivre
      </span>
    );
  }
  return <span className="text-xs text-stone-500">Régulier</span>;
}

// §16.2 : étudiants à risque, présence, devoirs non terminés, compétences faibles, questions ratées, éléments à relire.
export function ClassOverview({ overview }: { overview: TeacherOverview }) {
  const students = [...overview.students].sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || a.fullName.localeCompare(b.fullName, 'fr'));

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-lg font-semibold">Étudiants</h2>
          <span className="text-sm text-stone-500">
            {overview.classes.length} classe(s) · {overview.students.filter((student) => student.atRisk).length} à suivre
          </span>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Étudiant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Dernière activité</th>
                <th className="px-4 py-3 text-right">Présence 30 j</th>
                <th className="px-4 py-3 text-right">Devoirs non rendus</th>
                <th className="px-4 py-3 text-right">Simulations 30 j</th>
                <th className="w-44 px-4 py-3">Réussite 30 j</th>
                <th className="px-4 py-3 text-right">Entretien moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {students.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-stone-500">
                    Aucun étudiant dans vos classes.
                  </td>
                </tr>
              )}
              {students.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3">
                    <Link to={`/suivi/etudiants/${student.id}`} className="font-medium text-stone-900 hover:text-verde-dark hover:underline">
                      {student.fullName}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {student.level ?? '—'} · {student.classNames}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StudentStatus student={student} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-600">{student.lastActivityAt ? formatDateTime(student.lastActivityAt) : 'Jamais'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {student.attendanceRate30 === null ? <span className="text-stone-400">—</span> : `${student.attendanceRate30} %`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {student.homeworkMissing > 0 ? (
                      <span className="font-medium text-amber-800">
                        <span aria-hidden>⚠ </span>
                        {student.homeworkMissing}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{student.simulations30}</td>
                  <td className="px-4 py-3">
                    {student.accuracy30 === null ? (
                      <span className="text-stone-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-10 text-right tabular-nums">{student.accuracy30} %</span>
                        <div className="flex-1">
                          <Meter value={student.accuracy30} label={`Réussite de ${student.fullName}`} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{student.embassyAverage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-semibold">Devoirs</h2>
          <span className="text-xs text-stone-500">Échéances des 14 derniers et 7 prochains jours</span>
          <Link to="/classes" className="ml-auto text-sm text-verde-dark hover:underline">
            Gérer les devoirs
          </Link>
        </div>
        {overview.homework.length === 0 ? (
          <p className="text-sm text-stone-500">Aucun devoir sur cette période.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {overview.homework.map((item) => {
              const missing = Math.max(0, item.students - item.submitted);
              const overdue = Date.parse(item.dueAt) < Date.now();
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="font-medium">{item.title}</span>
                  <span className="text-xs text-stone-500">
                    {item.className} · {overdue ? 'échéance passée le' : 'à rendre le'} {formatDateTime(item.dueAt)}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-stone-600">
                    {item.submitted} / {item.students} rendu(s)
                    {item.toReview > 0 && ` · ${item.toReview} à corriger`}
                    {missing > 0 && <span className={overdue ? 'text-amber-800' : ''}> · {overdue ? '⚠ ' : ''}{missing} non terminé(s)</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Compétences les plus fragiles (30 j)</h2>
          {overview.weakCategories.length === 0 && <p className="text-sm text-stone-500">Pas encore assez de réponses pour dégager une tendance.</p>}
          {overview.weakCategories.map((category) => (
            <div key={category.category}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize text-stone-700">{category.category}</span>
                <span className="tabular-nums text-stone-900">
                  {category.accuracy} % <span className="text-stone-500">· {category.answers} réponses</span>
                </span>
              </div>
              <Meter value={category.accuracy} label={`Réussite en ${category.category}`} />
            </div>
          ))}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">À relire</h2>
          {overview.toReview.length === 0 && overview.followUps.length === 0 && <p className="text-sm text-stone-500">Rien en attente.</p>}
          <ul className="divide-y divide-stone-100">
            {overview.followUps.map((followUp) => (
              <li key={followUp.id} className="py-2 text-sm">
                <Link to={`/suivi/etudiants/${followUp.studentId}`} className="font-medium hover:underline">
                  {followUp.studentName}
                </Link>{' '}
                <span className="text-stone-500">· relance prévue le {new Date(followUp.followUpAt).toLocaleDateString('fr-FR')}</span>
                <p className="line-clamp-1 text-stone-600">{followUp.comment}</p>
              </li>
            ))}
            {overview.toReview.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Link to={`/suivi/etudiants/${item.studentId}`} className="font-medium hover:underline">
                  {item.studentName}
                </Link>
                {item.type === 'embassy_session' ? (
                  <Link to={`/suivi/etudiants/${item.studentId}/entretiens/${item.id}`} className="text-verde-dark hover:underline">
                    Entretien · {VISA_LABELS[item.label as VisaType] ?? item.label}
                  </Link>
                ) : (
                  <span className="text-stone-600">Simulation · {MODE_LABELS[item.label as SimulationMode] ?? item.label}</span>
                )}
                <span className="ml-auto text-xs tabular-nums text-stone-500">
                  {item.score !== null && `score ${item.score} · `}
                  {formatDateTime(item.completedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Questions les plus ratées (30 j)</h2>
        <HardestQuestionsTable questions={overview.hardestQuestions} />
      </section>
    </div>
  );
}

export function HardestQuestionsTable({ questions }: { questions: TeacherOverview['hardestQuestions'] }) {
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
          <tr>
            <th className="px-4 py-3">Question</th>
            <th className="px-4 py-3">Catégorie</th>
            <th className="px-4 py-3 text-right">Réponses</th>
            <th className="w-44 px-4 py-3">Taux de réussite</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {questions.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-stone-500">
                Pas encore assez de réponses.
              </td>
            </tr>
          )}
          {questions.map((question) => (
            <tr key={question.id}>
              <td className="max-w-md px-4 py-3">
                <p className="line-clamp-2">{question.text}</p>
              </td>
              <td className="px-4 py-3 capitalize text-stone-600">{question.category}</td>
              <td className="px-4 py-3 text-right tabular-nums">{question.answers}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right tabular-nums">{question.successRate} %</span>
                  <div className="flex-1">
                    <Meter value={question.successRate} label="Taux de réussite" />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
