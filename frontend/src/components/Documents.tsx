import { api, ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { ChecklistItemStatus, DocumentEvent } from '../lib/types';

// Statut toujours porté par une icône et un libellé, jamais par la couleur seule.
const STATUS: Record<ChecklistItemStatus, { icon: string; label: string; className: string }> = {
  missing: { icon: '○', label: 'À déposer', className: 'text-stone-600' },
  submitted: { icon: '⏳', label: 'En vérification', className: 'text-stone-800' },
  needs_correction: { icon: '⚠', label: 'À corriger', className: 'text-rosso' },
  validated: { icon: '✓', label: 'Vérifié', className: 'text-verde-dark' },
  expired: { icon: '⚠', label: 'Expiré', className: 'text-rosso' },
};

export function DocumentStatusBadge({ status }: { status: ChecklistItemStatus }) {
  const entry = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${entry.className}`}>
      <span aria-hidden>{entry.icon}</span>
      {entry.label}
    </span>
  );
}

const ACTION_LABELS: Record<DocumentEvent['action'], string> = {
  upload: 'Dépôt',
  validate: 'Vérifié',
  request_correction: 'Correction demandée',
  set_expiry: 'Date d’expiration',
};

export function DocumentHistory({ events }: { events: DocumentEvent[] }) {
  if (events.length === 0) return <p className="text-xs text-stone-500">Aucun historique.</p>;
  return (
    <ol className="space-y-1 text-xs text-stone-600">
      {events.map((event) => (
        <li key={event.id}>
          <span className="font-medium text-stone-800">{ACTION_LABELS[event.action]}</span>
          {event.version && ` · v${event.version}`} · {formatDateTime(event.createdAt)}
          {event.actorName && ` · ${event.actorName}`}
          {event.comment && <span className="block pl-3 text-stone-500">« {event.comment} »</span>}
        </li>
      ))}
    </ol>
  );
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Lien signé valable 60 s : demandé au moment du clic, jamais conservé.
export async function downloadDocument(path: string, onError: (message: string) => void) {
  try {
    const { url } = await api<{ url: string }>(path);
    window.location.assign(url);
  } catch (err) {
    onError(err instanceof ApiError ? err.message : 'Téléchargement impossible.');
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = 'application/pdf,image/jpeg,image/png,image/webp';
