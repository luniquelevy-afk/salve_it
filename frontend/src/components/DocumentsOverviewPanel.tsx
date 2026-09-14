import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { DocumentsOverview } from '../lib/types';

export function DocumentsOverviewPanel() {
  const [overview, setOverview] = useState<DocumentsOverview | null>(null);

  useEffect(() => {
    api<DocumentsOverview>('/api/staff/documents/overview')
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  if (!overview) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-2">
        <h2 className="font-semibold">
          Documents à vérifier <span className="tabular-nums text-stone-500">({overview.toReviewCount})</span>
        </h2>
        {overview.toReview.length === 0 && <p className="text-sm text-stone-500">Aucun document en attente.</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {overview.toReview.map((document) => (
            <li key={document.id} className="flex flex-wrap items-center gap-2 py-2">
              <Link to={`/suivi/etudiants/${document.studentId}`} className="font-medium hover:underline">
                {document.studentName}
              </Link>
              <span className="text-stone-600">
                {document.documentType} · v{document.version}
              </span>
              <span className="ml-auto text-xs text-stone-500">{formatDateTime(document.updatedAt)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="card space-y-2">
        <h2 className="font-semibold">
          Échéances sous 30 jours <span className="tabular-nums text-stone-500">({overview.expiringCount})</span>
        </h2>
        {overview.expiring.length === 0 && <p className="text-sm text-stone-500">Aucun document n’arrive à expiration.</p>}
        <ul className="divide-y divide-stone-100 text-sm">
          {overview.expiring.map((document) => {
            const expired = document.expiresAt < new Date().toISOString().slice(0, 10);
            return (
              <li key={document.id} className="flex flex-wrap items-center gap-2 py-2">
                <Link to={`/suivi/etudiants/${document.studentId}`} className="font-medium hover:underline">
                  {document.studentName}
                </Link>
                <span className="text-stone-600">{document.documentType}</span>
                <span className={`ml-auto text-xs font-medium ${expired ? 'text-rosso' : 'text-amber-800'}`}>
                  <span aria-hidden>{expired ? '⚠' : '⏰'}</span> {expired ? 'Expiré le' : 'Expire le'} {new Date(`${document.expiresAt}T00:00:00`).toLocaleDateString('fr-FR')}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
