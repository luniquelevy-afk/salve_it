import { auth } from './firebase';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function authHeader(): Promise<Record<string, string>> {
  // Jeton d'identité Firebase, renouvelé automatiquement avant expiration.
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const NETWORK_ERROR_MESSAGE = 'Connexion au serveur impossible. Vérifiez votre connexion internet.';

async function toApiError(response: Response): Promise<ApiError> {
  const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return new ApiError(response.status, payload?.error?.code ?? 'unknown', payload?.error?.message ?? 'Erreur inattendue.');
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await toApiError(response);
  return (await response.json().catch(() => null)) as T;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  return send<T>(path, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

// Envoi binaire brut : le serveur détermine lui-même le type réel du fichier.
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  return send<T>(path, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      ...(await authHeader()),
    },
    body: file,
  });
}

// Téléchargement authentifié (export) : le fichier reste dans le navigateur de l'utilisateur connecté.
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: await authHeader() });
  } catch {
    throw new ApiError(0, 'network_error', NETWORK_ERROR_MESSAGE);
  }
  if (!response.ok) throw await toApiError(response);

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
