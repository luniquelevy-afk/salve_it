// Jauge à teinte unique : piste et remplissage sur la même rampe, valeur portée par le texte voisin.
// La couleur n'encode jamais un statut (bon / mauvais) : un statut s'affiche avec une icône et un libellé.
export function Meter({ value, max = 100, label }: { value: number; max?: number; label: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 overflow-hidden rounded-full bg-verde/15">
      <div className="h-full rounded-full bg-verde" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-stone-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
