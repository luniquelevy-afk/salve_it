import { describe, expect, it } from 'vitest';
import { formatBrazzavilleDateTime } from '../src/lib/dates.js';
import { weekStartKey } from '../src/services/notifications.js';

describe('§15 — recommandation hebdomadaire', () => {
  it('même clé pour toute la semaine (lundi → dimanche)', () => {
    expect(weekStartKey(new Date('2026-09-14T00:30:00Z'))).toBe('2026-09-14');
    expect(weekStartKey(new Date('2026-09-17T12:00:00Z'))).toBe('2026-09-14');
    expect(weekStartKey(new Date('2026-09-20T23:59:00Z'))).toBe('2026-09-14');
  });

  it('nouvelle clé la semaine suivante, pas de chevauchement avec la précédente', () => {
    expect(weekStartKey(new Date('2026-09-13T23:59:00Z'))).toBe('2026-09-07');
    expect(weekStartKey(new Date('2026-09-21T00:00:00Z'))).toBe('2026-09-21');
  });
});

describe('§15 — dates des notifications de séance', () => {
  it('affichées à l’heure de Brazzaville (UTC+1), en français', () => {
    const text = formatBrazzavilleDateTime('2026-09-16T08:00:00.000Z');
    expect(text).toContain('mercredi');
    expect(text).toContain('09:00');
  });
});
