import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import { env } from '../config/env.js';

// Logs structurés sans données personnelles : uniquement des IDs internes (checklist sécurité).
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.email'],
});

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
