import { Link } from 'react-router-dom';
import { formatDateTime } from '../lib/format';
import type { CategoryMastery, PathAction, WeeklyGoal } from '../lib/types';
import { Meter } from './Meter';

interface LearningPathPanelProps {
  objective: string | null;
  actions: PathAction[];
  weeklyGoals: WeeklyGoal[];
  progressPercent: number;
  categories?: CategoryMastery[];
  nextReviewAt?: string | null;
  // Vue enseignant : pas de liens d'action, l'étudiant seul les suit.
  readOnly?: boolean;
}

// §9.2 / EF-41 : prochaines étapes et objectifs de la semaine.
export function LearningPathPanel({ objective, actions, weeklyGoals, progressPercent, categories = [], nextReviewAt, readOnly = false }: LearningPathPanelProps) {
  return (
    <section className="card space-y-5">
      <div>
        <h2 className="font-semibold">{readOnly ? 'Parcours recommandé' : 'Mon parcours'}</h2>
        <p className="text-sm text-stone-600">
          {objective ?? (readOnly ? 'Objectif non renseigné.' : 'Précisez votre objectif dans votre profil pour personnaliser vos recommandations.')}
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-stone-700">Prochaines étapes</h3>
        {actions.length === 0 && <p className="text-sm text-stone-500">Rien d’urgent : continuez à ce rythme.</p>}
        <ol className="space-y-2">
          {actions.map((action, index) => {
            const content = (
              <>
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-verde/10 text-xs font-bold text-verde-dark">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium text-stone-900">{action.title}</span>
                  <span className="block text-sm text-stone-600">{action.description}</span>
                </span>
              </>
            );
            return (
              <li key={action.id}>
                {readOnly ? (
                  <div className="flex gap-3 rounded-lg border border-stone-200 px-3 py-2">{content}</div>
                ) : (
                  <Link to={action.link} className="flex gap-3 rounded-lg border border-stone-200 px-3 py-2 transition hover:border-verde/40 hover:bg-stone-50">
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-stone-700">Objectifs de la semaine</h3>
          <span className="text-sm tabular-nums text-stone-600">{progressPercent} % atteints</span>
        </div>
        {weeklyGoals.map((goal) => (
          <div key={goal.id}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="text-stone-700">{goal.label}</span>
              <span className="tabular-nums text-stone-900">
                {goal.done} / {goal.target}
              </span>
            </div>
            <Meter value={Math.min(goal.done, goal.target)} max={goal.target} label={goal.label} />
          </div>
        ))}
      </div>

      {categories.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-700">Réussite par compétence</h3>
          {categories.map((category) => (
            <div key={category.category}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="capitalize text-stone-700">{category.category}</span>
                <span className="tabular-nums text-stone-900">
                  {category.accuracy} % <span className="text-stone-500">· {category.attempts} réponses</span>
                </span>
              </div>
              <Meter value={category.accuracy} label={`Réussite en ${category.category}`} />
            </div>
          ))}
          {nextReviewAt && <p className="text-xs text-stone-500">Prochaine révision planifiée : {formatDateTime(nextReviewAt)}</p>}
        </div>
      )}
    </section>
  );
}
