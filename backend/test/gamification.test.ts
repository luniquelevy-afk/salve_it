import { describe, expect, it } from 'vitest';
import {
  activitiesThisWeek,
  buildGamificationView,
  computeStreak,
  earnedBadgeCodes,
  WEEKLY_GOAL_TARGET,
  type BadgeCatalogueEntry,
  type GamificationSignals,
} from '../src/services/gamification.js';

// Mercredi 2026-09-16, 10:00 UTC.
const NOW = new Date('2026-09-16T10:00:00.000Z');

function iso(day: string): string {
  return `${day}T08:00:00.000Z`;
}

describe('computeStreak', () => {
  it("compte les jours consécutifs se terminant aujourd'hui", () => {
    const dates = ['2026-09-16', '2026-09-15', '2026-09-14'].map(iso);
    expect(computeStreak(dates, NOW)).toBe(3);
  });

  it('tolère une série se terminant hier (journée en cours non jouée)', () => {
    const dates = ['2026-09-15', '2026-09-14'].map(iso);
    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it("s'arrête au premier jour manquant", () => {
    const dates = ['2026-09-16', '2026-09-14', '2026-09-13'].map(iso);
    expect(computeStreak(dates, NOW)).toBe(1);
  });

  it('dédoublonne plusieurs activités le même jour', () => {
    const dates = [iso('2026-09-16'), '2026-09-16T20:00:00.000Z', iso('2026-09-15')];
    expect(computeStreak(dates, NOW)).toBe(2);
  });

  it('retourne 0 si la dernière activité est trop ancienne', () => {
    expect(computeStreak([iso('2026-09-10')], NOW)).toBe(0);
    expect(computeStreak([], NOW)).toBe(0);
  });
});

describe('activitiesThisWeek', () => {
  it('ne compte que les activités depuis le lundi de la semaine en cours', () => {
    // Lundi = 2026-09-14. Dimanche précédent (13) exclu.
    const dates = ['2026-09-16', '2026-09-14', '2026-09-13', '2026-09-09'].map(iso);
    expect(activitiesThisWeek(dates, NOW)).toBe(2);
  });
});

describe('earnedBadgeCodes', () => {
  const base: GamificationSignals = {
    completedSimulations: 0,
    maxSectionAccuracy: 0,
    completedInterviews: 0,
    documentsComplete: false,
    streakDays: 0,
  };

  it('aucun badge sans activité', () => {
    expect(earnedBadgeCodes(base)).toEqual([]);
  });

  it('débloque chaque badge à son seuil', () => {
    expect(earnedBadgeCodes({ ...base, completedSimulations: 1 })).toContain('first_simulation');
    expect(earnedBadgeCodes({ ...base, maxSectionAccuracy: 0.8 })).toContain('section_80');
    expect(earnedBadgeCodes({ ...base, streakDays: 7 })).toContain('week_streak');
    expect(earnedBadgeCodes({ ...base, completedInterviews: 5 })).toContain('five_interviews');
    expect(earnedBadgeCodes({ ...base, documentsComplete: true })).toContain('documents_complete');
  });

  it('ne débloque pas sous le seuil', () => {
    expect(earnedBadgeCodes({ ...base, maxSectionAccuracy: 0.79 })).not.toContain('section_80');
    expect(earnedBadgeCodes({ ...base, streakDays: 6 })).not.toContain('week_streak');
    expect(earnedBadgeCodes({ ...base, completedInterviews: 4 })).not.toContain('five_interviews');
  });
});

describe('buildGamificationView', () => {
  const catalogue: BadgeCatalogueEntry[] = [
    { code: 'first_simulation', label: 'Première simulation', description: '…' },
    { code: 'week_streak', label: '7 jours', description: '…' },
  ];

  it('marque earned + conserve la date de déblocage existante', () => {
    const signals: GamificationSignals = {
      completedSimulations: 2,
      maxSectionAccuracy: 0.5,
      completedInterviews: 0,
      documentsComplete: false,
      streakDays: 3,
    };
    const awarded = new Map([['first_simulation', '2026-09-01T00:00:00.000Z']]);
    const view = buildGamificationView(catalogue, awarded, signals, 2, NOW);

    expect(view.earnedCount).toBe(1);
    expect(view.badges.find((b) => b.code === 'first_simulation')).toMatchObject({
      earned: true,
      awardedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(view.badges.find((b) => b.code === 'week_streak')).toMatchObject({ earned: false, awardedAt: null });
    expect(view.streakDays).toBe(3);
  });

  it("calcule l'atteinte de l'objectif hebdomadaire", () => {
    const signals: GamificationSignals = {
      completedSimulations: 0,
      maxSectionAccuracy: 0,
      completedInterviews: 0,
      documentsComplete: false,
      streakDays: 0,
    };
    const reached = buildGamificationView(catalogue, new Map(), signals, WEEKLY_GOAL_TARGET, NOW);
    expect(reached.weeklyGoal).toMatchObject({ target: WEEKLY_GOAL_TARGET, done: WEEKLY_GOAL_TARGET, reached: true });

    const notYet = buildGamificationView(catalogue, new Map(), signals, 1, NOW);
    expect(notYet.weeklyGoal.reached).toBe(false);
  });
});
