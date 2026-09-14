// Dates affichées aux utilisateurs (notifications, emails) : heure de Brazzaville, format français.
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Brazzaville' });

export function formatBrazzavilleDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}
