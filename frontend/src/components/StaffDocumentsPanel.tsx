import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { DocumentsSpace, StudentDocument } from '../lib/types';
import { DocumentHistory, DocumentStatusBadge, downloadDocument, formatBytes } from './Documents';
import { ErrorBanner } from './ErrorBanner';

function ReviewControls({ document, onChange, onError }: { document: StudentDocument; onChange: (space: DocumentsSpace) => void; onError: (message: string) => void }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function review(action: 'validate' | 'request_correction') {
    if (action === 'request_correction' && !comment.trim()) return onError('Indiquez à l’étudiant ce qui doit être corrigé.');
    setBusy(true);
    try {
      onChange(await api<DocumentsSpace>(`/api/staff/documents/${document.id}/review`, { method: 'POST', body: { action, version: document.currentVersion, comment: comment.trim() || undefined } }));
      setComment('');
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <textarea
        className="input min-h-10 flex-1"
        aria-label={`Commentaire pour ${document.documentTypeLabel}`}
        placeholder="Commentaire pour l’étudiant (obligatoire pour une correction)"
        maxLength={2000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => void review('validate')}>
        Marquer vérifié
      </button>
      <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => void review('request_correction')}>
        Demander une correction
      </button>
    </div>
  );
}

// EF-45 : vérification des documents par l'enseignant de la classe ou l'admin.
export function StaffDocumentsPanel({ studentId }: { studentId: string }) {
  const [space, setSpace] = useState<DocumentsSpace | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSpace(await api<DocumentsSpace>(`/api/staff/documents/students/${studentId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les documents.');
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!space) return <ErrorBanner message={error} />;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-lg font-semibold">Documents</h2>
        <span className="text-sm text-stone-500">
          {space.checklist.progress.validated} / {space.checklist.progress.total} vérifiés · suivi interne, pas une validation officielle
        </span>
      </div>
      <ErrorBanner message={error} />
      <div className="card divide-y divide-stone-100 p-0">
        {space.checklist.items.map((item) => {
          const document = item.document ? space.documents.find((candidate) => candidate.id === item.document!.id) : null;
          return (
            <div key={item.code} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-40 flex-1 font-medium">{item.label}</span>
                <DocumentStatusBadge status={item.status} />
              </div>
              {document && (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
                    <span>
                      {document.fileName} · v{document.currentVersion} · {formatBytes(document.sizeBytes)} · {formatDateTime(document.updatedAt)}
                    </span>
                    {document.expiresAt && <span>· expire le {new Date(`${document.expiresAt}T00:00:00`).toLocaleDateString('fr-FR')}</span>}
                    <button className="text-verde-dark hover:underline" onClick={() => void downloadDocument(`/api/staff/documents/${document.id}/file`, setError)}>
                      Consulter
                    </button>
                    <button className="text-xs hover:underline" onClick={() => setOpenHistory(openHistory === document.id ? null : document.id)}>
                      {openHistory === document.id ? 'Masquer l’historique' : 'Historique'}
                    </button>
                  </div>
                  {document.reviewerComment && (
                    <p className="text-sm text-stone-600">
                      Dernier commentaire{document.reviewerName && ` (${document.reviewerName})`} : « {document.reviewerComment} »
                    </p>
                  )}
                  {openHistory === document.id && <DocumentHistory events={space.history.filter((event) => event.documentId === document.id)} />}
                  {document.status === 'submitted' && <ReviewControls document={document} onChange={setSpace} onError={setError} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
