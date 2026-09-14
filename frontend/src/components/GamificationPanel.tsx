import type { Gamification } from '../lib/types';

// §14 : gamification légère — série de jours actifs, objectif hebdomadaire, badges.
// Pas de classement global (§14) : uniquement la progression personnelle de l'étudiant.
export function GamificationPanel({ data }: { data: Gamification }) {
  const { streakDays, weeklyGoal, badges, earnedCount } = data;
  const goalPercent = weeklyGoal.target > 0 ? Math.min(100, Math.round((weeklyGoal.done / weeklyGoal.target) * 100)) : 0;

  return (
    <section className="card space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-semibold">Ma progression</h2>
        <span className="text-sm text-stone-500">
          {earnedCount} / {badges.length} badge{badges.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Série active</p>
          <p className="mt-1">
            <span className="text-3xl font-bold tabular-nums text-stone-900">{streakDays}</span>
            <span className="text-sm text-stone-500"> jour{streakDays > 1 ? 's' : ''} 🔥</span>
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {streakDays === 0 ? 'Faites une activité aujourd’hui pour lancer votre série.' : 'Revenez chaque jour pour la prolonger.'}
          </p>
        </div>

        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-xs uppercase tracking-wide text-stone-500">Objectif de la semaine</p>
          <p className="mt-1 text-sm text-stone-700">
            <span className="font-semibold tabular-nums text-stone-900">{weeklyGoal.done}</span> / {weeklyGoal.target} activité
            {weeklyGoal.target > 1 ? 's' : ''} {weeklyGoal.reached ? '✅' : ''}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${goalPercent}%` }} />
          </div>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <li
            key={badge.code}
            className={`flex items-start gap-2 rounded-lg border p-2 ${
              badge.earned ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white opacity-60'
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {badge.earned ? '🏅' : '🔒'}
            </span>
            <div>
              <p className={`text-sm font-medium ${badge.earned ? 'text-stone-900' : 'text-stone-500'}`}>{badge.label}</p>
              <p className="text-xs text-stone-500">{badge.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
