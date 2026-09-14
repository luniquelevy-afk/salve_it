import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GamificationPanel } from '../src/components/GamificationPanel';
import type { Gamification } from '../src/lib/types';

const data: Gamification = {
  streakDays: 3,
  weeklyGoal: { target: 3, done: 1, reached: false },
  earnedCount: 2,
  generatedAt: '2026-09-14T10:00:00.000Z',
  badges: [
    { code: 'first_simulation', label: 'Première simulation', description: 'Terminez une simulation.', earned: true, awardedAt: '2026-09-12T00:00:00.000Z' },
    { code: 'section_80', label: '80 % dans une section', description: 'Atteignez 80 %.', earned: true, awardedAt: '2026-09-14T00:00:00.000Z' },
    { code: 'week_streak', label: "7 jours d'activité", description: 'Sept jours de suite.', earned: false, awardedAt: null },
  ],
};

describe('GamificationPanel', () => {
  it('affiche la série, l’objectif et le décompte de badges', () => {
    render(<GamificationPanel data={data} />);
    expect(screen.getByText('2 / 3 badges')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // série active (span dédié)
    expect(screen.getByText('1')).toBeInTheDocument(); // objectif : activités faites
    expect(screen.getByText(/\/ 3 activités/)).toBeInTheDocument();
  });

  it('liste chaque badge du catalogue avec son libellé', () => {
    render(<GamificationPanel data={data} />);
    expect(screen.getByText('Première simulation')).toBeInTheDocument();
    expect(screen.getByText('80 % dans une section')).toBeInTheDocument();
    expect(screen.getByText("7 jours d'activité")).toBeInTheDocument();
  });

  it('distingue visuellement les badges obtenus des verrouillés', () => {
    render(<GamificationPanel data={data} />);
    // Un médaille pour chaque badge obtenu, un cadenas pour chaque verrouillé.
    expect(screen.getAllByText('🏅')).toHaveLength(2);
    expect(screen.getAllByText('🔒')).toHaveLength(1);
  });
});
