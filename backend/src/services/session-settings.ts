// Réglage de session administrable (EF-05, §22 #5) : durée d'inactivité avant
// déconnexion automatique. Source unique en base, lisible par le frontend, modifiable
// par l'admin sans redéploiement (ENF-10).
import { db } from '../lib/db/index.js';
import { recordAudit } from './audit.js';

// Valeur par défaut si le réglage n'a pas encore été fixé par le centre.
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

interface SessionSettingsRow {
  idle_timeout_minutes: number | null;
  updated_at: string;
}

export interface SessionSettings {
  idleTimeoutMinutes: number;
  configured: boolean;
  defaultMinutes: number;
  updatedAt: string;
}

async function loadRow(): Promise<SessionSettingsRow> {
  const { data, error } = await db
    .from('session_settings')
    .select('idle_timeout_minutes, updated_at')
    .eq('id', true)
    .single();
  if (error) throw error;
  return data as SessionSettingsRow;
}

export async function getSessionSettings(): Promise<SessionSettings> {
  const row = await loadRow();
  return {
    idleTimeoutMinutes: row.idle_timeout_minutes ?? DEFAULT_IDLE_TIMEOUT_MINUTES,
    configured: row.idle_timeout_minutes !== null,
    defaultMinutes: DEFAULT_IDLE_TIMEOUT_MINUTES,
    updatedAt: row.updated_at,
  };
}

export async function updateSessionSettings(actorId: string, input: { idleTimeoutMinutes: number | null }): Promise<SessionSettings> {
  const { error } = await db
    .from('session_settings')
    .update({ idle_timeout_minutes: input.idleTimeoutMinutes ?? null, updated_by: actorId })
    .eq('id', true);
  if (error) throw error;
  await recordAudit({ actorId, action: 'session_settings.update', entityType: 'session_settings', metadata: { ...input } });
  return getSessionSettings();
}
