import { randomUUID } from 'node:crypto';
import { storageBucket } from './firebase.js';
import { logger } from './logger.js';

// Fichiers des documents étudiants, sous un préfixe dédié du bucket Firebase Storage.
// Aucun accès client direct (storage.rules refuse tout) : dépôt et suppression par le backend,
// lecture via URL signée de courte durée.
const PREFIX = 'student-documents';
const emulated = () => Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const objectPath = (path: string) => `${PREFIX}/${path}`;

export async function ensureDocumentStorage(): Promise<void> {
  try {
    const [exists] = await storageBucket().exists();
    if (!exists) logger.error({ bucket: storageBucket().name }, 'document_bucket_missing');
  } catch (err) {
    logger.error({ err }, 'document_bucket_check_failed');
  }
}

export async function uploadDocumentFile(path: string, content: Buffer, contentType: string): Promise<void> {
  await storageBucket().file(objectPath(path)).save(content, { contentType, resumable: false });
}

export async function removeDocumentFiles(paths: string[]): Promise<void> {
  await Promise.all([...new Set(paths)].map((path) => storageBucket().file(objectPath(path)).delete({ ignoreNotFound: true })));
}

export async function signedDocumentUrl(path: string, seconds: number, downloadName: string): Promise<string> {
  const file = storageBucket().file(objectPath(path));
  if (emulated()) {
    // L'émulateur ne signe pas d'URL : jeton de téléchargement local (développement uniquement).
    const token = randomUUID();
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    return `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${storageBucket().name}/o/${encodeURIComponent(objectPath(path))}?alt=media&token=${token}`;
  }
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + seconds * 1000,
    responseDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
  });
  return url;
}
