import { describe, expect, it } from 'vitest';
import { formatClock, formatMinutes, formatPercent, formatRelative, localDayKey } from '../src/lib/format';

describe('formatClock', () => {
  it('formate en mm:ss avec zéros', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(3_600_000)).toBe('60:00');
  });

  it('ne descend jamais sous 00:00', () => {
    expect(formatClock(-5000)).toBe('00:00');
  });

  it('arrondit à la seconde supérieure', () => {
    expect(formatClock(1500)).toBe('00:02');
  });
});

describe('formatMinutes', () => {
  it('convertit des secondes en minutes arrondies', () => {
    expect(formatMinutes(120)).toBe('2 min');
    expect(formatMinutes(90)).toBe('2 min');
  });
});

describe('formatPercent', () => {
  it('calcule un pourcentage entier', () => {
    expect(formatPercent(1, 4)).toBe('25 %');
    expect(formatPercent(3, 3)).toBe('100 %');
  });

  it('renvoie un tiret quand le total est nul', () => {
    expect(formatPercent(2, 0)).toBe('—');
  });
});

describe('localDayKey', () => {
  it('produit une clé AAAA-MM-JJ', () => {
    expect(localDayKey('2026-09-14T10:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});


describe('formatRelative', () => {
  const now = Date.parse('2026-09-30T12:00:00.000Z');
  it('exprime une date passée en langage courant', () => {
    expect(formatRelative('2026-09-30T11:48:00.000Z', now)).toBe('Il y a 12 minutes');
    expect(formatRelative('2026-09-30T10:00:00.000Z', now)).toBe('Il y a 2 heures');
    expect(formatRelative('2026-09-29T11:00:00.000Z', now)).toBe('Hier');
    expect(formatRelative('2026-09-27T12:00:00.000Z', now)).toBe('Il y a 3 jours');
  });
});
