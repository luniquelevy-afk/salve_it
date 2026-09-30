import { logger } from '../lib/logger.js';
import { db } from '../lib/db/index.js';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// ENF-08 : toute action admin sensible est horodatée et attribuée.
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const { error } = await db.from('audit_logs').insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) logger.error({ err: error, action: entry.action }, 'audit_log_failed');
}
