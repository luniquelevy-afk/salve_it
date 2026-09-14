import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'not_found', 'Ressource introuvable.'));
};

// Messages génériques côté client, détail uniquement dans les logs serveur (checklist sécurité).
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'invalid_input',
        message: 'Données invalides.',
        issues: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'file_too_large', message: 'Fichier ou requête trop volumineux.' } });
    return;
  }
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'invalid_json', message: 'Corps de requête invalide.' } });
    return;
  }
  logger.error({ err }, 'unhandled_error');
  res.status(500).json({ error: { code: 'internal_error', message: 'Une erreur interne est survenue.' } });
};
