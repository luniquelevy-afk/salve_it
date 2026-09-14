import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ACCEPTED_FILES, DocumentHistory, DocumentStatusBadge, downloadDocument, formatBytes, MAX_UPLOAD_BYTES } from '../../components/Documents';
import { ErrorBanner } from '../../components/ErrorBanner';
import { RetentionNotice } from '../../components/RetentionNotice';
import { Meter } from '../../components/Meter';
import { api, ApiError, apiUpload } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { VISA_LABELS, type ChecklistItem, type DocumentsSpace } from '../../lib/types';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// §11 / EF-44 à EF-48 : suivi interne de préparation, jamais une validation officielle du dossier.
export function DocumentsPage() {
  const [space, setSpace] = useState<DocumentsSpace | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSpace(await api<DocumentsSpace>('/api/student/documents'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger vos documents.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, action: () => Promise<DocumentsSpace | void>) {
    setBusy(key);
    setError(null);
    try {
      const result = await action();
      if (result) setSpace(result);
      else await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  }

  function upload(item: ChecklistItem, file: File | undefined) {
    if (!file || !item.documentType) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError('Fichier trop volumineux : 10 Mo maximum. Réduisez la qualité du scan ou exportez en PDF.');
    void run(`upload-${item.code}`, () => apiUpload<DocumentsSpace>(`/api/student/documents/${item.documentType}/file`, file));
  }

  if (!space) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Mes documents</h1>
        <ErrorBanner message={error} />
        {!error && <p className="text-stone-500">Chargement…</p>}
      </div>
    );
  }

  const { checklist } = space;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes documents</h1>
        <p className="text-stone-600">
          {checklist.visaType ? `Checklist pour un ${VISA_LABELS[checklist.visaType].toLowerCase()}.` : 'Checklist générale.'}{' '}
          <Link to="/etudiant/profil" className="text-verde-dark hover:underline">
            {checklist.visaType ? 'Modifier mon projet' : 'Précisez votre type de visa dans votre profil'}
          </Link>{' '}
          pour l’adapter.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
        <p className="font-semibold">{checklist.notice}</p>
        <p className="mt-1">
          Ce suivi est un outil de préparation du centre : un document « vérifié » ici n’est pas une validation officielle de votre dossier.
          {checklist.unverifiedCount > 0 && ` ${checklist.unverifiedCount} exigence(s) n’ont pas encore été vérifiées par le centre sur la source officielle.`}
        </p>
      </div>

      <ErrorBanner message={error} />

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Avancement</span>
          <span className="tabular-nums">
            {checklist.progress.validated} / {checklist.progress.total} vérifiés
          </span>
        </div>
        <Meter value={checklist.progress.validated} max={Math.max(1, checklist.progress.total)} label="Documents vérifiés" />
      </section>

      <ul className="space-y-3">
        {checklist.items.map((item) => {
          const document = item.document ? space.documents.find((candidate) => candidate.id === item.document!.id) : null;
          const events = document ? space.history.filter((event) => event.documentId === document.id) : [];
          return (
            <li key={item.code} className="card space-y-3">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{item.label}</h2>
                  {item.description && <p className="text-sm text-stone-600">{item.description}</p>}
                  <p className="mt-1 text-xs text-stone-500">
                    {item.sourceUrl && (
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-verde-dark hover:underline">
                        {item.sourceLabel ?? 'Source officielle'} ↗
                      </a>
                    )}{' '}
                    ·{' '}
                    {item.lastVerifiedAt ? (
                      `Vérifié par le centre le ${formatDate(item.lastVerifiedAt)}`
                    ) : (
                      <span className="font-medium text-amber-800">
                        <span aria-hidden>⚠</span> Pas encore vérifié par le centre
                      </span>
                    )}
                  </p>
                </div>
                <DocumentStatusBadge status={item.status} />
              </div>

              {item.status === 'needs_correction' && item.document?.reviewerComment && (
                <p className="rounded-md bg-rosso/5 px-3 py-2 text-sm text-rosso">
                  <span className="font-semibold">Correction demandée :</span> {item.document.reviewerComment}
                </p>
              )}
              {item.expiringSoon && item.document?.expiresAt && (
                <p className="text-sm font-medium text-amber-800">
                  <span aria-hidden>⏰</span> Expire le {formatDate(item.document.expiresAt)} : pensez à le renouveler.
                </p>
              )}

              {document && (
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-stone-50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {document.fileName} · v{document.currentVersion} · {formatBytes(document.sizeBytes)} · déposé le {formatDateTime(document.updatedAt)}
                  </span>
                  <button className="text-verde-dark hover:underline" onClick={() => void downloadDocument(`/api/student/documents/${document.id}/file`, setError)}>
                    Télécharger
                  </button>
                  <label className="flex items-center gap-1 text-xs text-stone-600">
                    Expire le
                    <input
                      type="date"
                      className="input w-auto py-1 text-xs"
                      value={document.expiresAt ?? ''}
                      disabled={busy !== null}
                      onChange={(e) =>
                        void run(`expiry-${document.id}`, () => api<DocumentsSpace>(`/api/student/documents/${document.id}/expiry`, { method: 'PUT', body: { expiresAt: e.target.value || null } }))
                      }
                    />
                  </label>
                  <button className="text-xs text-stone-600 hover:underline" onClick={() => setOpenHistory(openHistory === document.id ? null : document.id)}>
                    {openHistory === document.id ? 'Masquer l’historique' : 'Historique'}
                  </button>
                  {document.status !== 'validated' && (
                    <button
                      className="ml-auto text-xs text-rosso hover:underline"
                      disabled={busy !== null}
                      onClick={() => window.confirm('Supprimer ce document et toutes ses versions ?') && void run(`delete-${document.id}`, () => api(`/api/student/documents/${document.id}`, { method: 'DELETE' }))}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              )}
              {document && openHistory === document.id && <DocumentHistory events={events} />}

              {item.documentType && (
                <label className={`btn-secondary w-fit cursor-pointer ${busy !== null ? 'pointer-events-none opacity-50' : ''}`}>
                  {busy === `upload-${item.code}` ? 'Envoi…' : document ? 'Déposer une nouvelle version' : 'Déposer le document'}
                  <input type="file" accept={ACCEPTED_FILES} className="sr-only" onChange={(e) => upload(item, e.target.files?.[0])} />
                </label>
              )}
            </li>
          );
        })}
      </ul>

      <div className="space-y-1">
        <p className="text-xs text-stone-500">PDF, JPEG, PNG ou WebP, 10 Mo maximum. Vos documents sont stockés de façon privée et accessibles uniquement à vous, à vos enseignants et à l’administration du centre.</p>
        <RetentionNotice context="documents" />
      </div>
    </div>
  );
}
