import { describe, expect, it } from 'vitest';
import { cutoffDate, RETENTION_RULES, supersededVersions, type VersionRow } from '../src/services/retention.js';

describe('ENF-09 — dates limites de conservation', () => {
  it('retire le nombre de mois demandé', () => {
    expect(cutoffDate(6, new Date('2026-09-14T10:00:00Z'))).toBe('2026-03-14T10:00:00.000Z');
    expect(cutoffDate(24, new Date('2026-09-14T10:00:00Z'))).toBe('2024-09-14T10:00:00.000Z');
  });

  it('ne modifie pas la date de référence', () => {
    const now = new Date('2026-09-14T10:00:00Z');
    cutoffDate(12, now);
    expect(now.toISOString()).toBe('2026-09-14T10:00:00.000Z');
  });
});

describe('ENF-09 — anciennes versions de documents', () => {
  const version = (overrides: Partial<VersionRow>): VersionRow => ({
    id: 'v',
    version: 1,
    storage_path: 'etudiant/passeport/v1.pdf',
    student_documents: { current_version: 3, storage_path: 'etudiant/passeport/v3.pdf' },
    ...overrides,
  });

  it('ne garde que les versions remplacées, jamais la version en cours', () => {
    const rows = [
      version({ id: 'ancienne', version: 1 }),
      version({ id: 'en-cours', version: 3, storage_path: 'etudiant/passeport/v3.pdf' }),
      version({ id: 'meme-fichier', version: 2, storage_path: 'etudiant/passeport/v3.pdf' }),
      version({ id: 'orpheline', student_documents: null }),
    ];
    expect(supersededVersions(rows).map((row) => row.id)).toEqual(['ancienne']);
  });
});

describe('ENF-09 — règles de conservation', () => {
  it('chaque règle a une clé, une colonne, un libellé et une unité uniques', () => {
    for (const field of ['key', 'column', 'label'] as const) {
      expect(new Set(RETENTION_RULES.map((rule) => rule[field])).size).toBe(RETENTION_RULES.length);
    }
    expect(RETENTION_RULES.every((rule) => rule.unit.length > 0 && rule.description.length > 0)).toBe(true);
  });
});
