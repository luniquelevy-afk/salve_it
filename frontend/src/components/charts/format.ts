// Libellé d'abscisse des séries temporelles (dates UTC « AAAA-MM-JJ »).
export function formatDateLabel(date: string, granularity: 'day' | 'week' = 'day'): string {
  const value = new Date(`${date}T00:00:00Z`);
  const label = value.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return granularity === 'week' ? `sem. du ${label}` : label;
}
