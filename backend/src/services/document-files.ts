// Contrôles des fichiers déposés (checklist sécurité : documents étudiants).
export const DOCUMENT_BUCKET = 'student-documents';
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
// Durée de validité des liens de téléchargement signés.
export const SIGNED_URL_SECONDS = 60;

export const DOCUMENT_MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type DocumentMimeType = keyof typeof DOCUMENT_MIME_EXTENSIONS;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Type réel déterminé par la signature binaire, jamais par l'extension ou l'en-tête déclaré.
export function detectDocumentMimeType(buffer: Buffer): DocumentMimeType | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

// Nom affiché uniquement (jamais utilisé dans le chemin de stockage) : sans chemin, caractères sûrs, extension réelle.
export function sanitizeDocumentFileName(rawName: string | undefined, mimeType: DocumentMimeType): string {
  const extension = DOCUMENT_MIME_EXTENSIONS[mimeType];
  let decoded = rawName ?? '';
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Nom mal encodé : on garde la valeur brute, nettoyée ci-dessous.
  }
  const base = decoded
    .split(/[\\/]/)
    .pop()!
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '')
    .slice(0, 80);
  return `${base || 'document'}.${extension}`;
}
