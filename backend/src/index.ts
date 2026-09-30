import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { activeModel, activeProviderName, isAiConfigured } from './services/ai.js';
import { ensureDocumentStorage } from './lib/document-storage.js';
import { startReportWorker } from './services/embassy.js';
import { startHomeworkWorker } from './services/homework.js';
import { startNotificationWorker } from './services/notifications.js';
import { startRetentionWorker } from './services/retention.js';

createApp().listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, aiProvider: activeProviderName(), aiModel: activeModel(), aiConfigured: isAiConfigured() },
    'api_started',
  );
  if (env.AI_PROVIDER === 'gemini' && !env.GEMINI_PAID_TIER) {
    logger.warn('gemini_free_tier: réservé au développement avec des données fictives (conditions Google du palier gratuit)');
  }
});

startReportWorker();
startNotificationWorker();
startHomeworkWorker();
startRetentionWorker();
void ensureDocumentStorage();
