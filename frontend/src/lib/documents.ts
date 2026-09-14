import { api, ApiError } from './api';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILES = 'application/pdf,image/jpeg,image/png,image/webp';

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
