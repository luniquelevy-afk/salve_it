import { describe, expect, it } from 'vitest';
import { buckets, buildAnalytics } from '../src/services/dashboard-analytics.js';

const now = new Date('2026-09-30T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const section = (name: string, correct: number, total: number) => ({ name, correct, total, wrong: total - correct, blank: 0, points: correct });

const input = () => ({
  days: 30 as const,
  now,
  profiles: [
    { id: 's1', role: 'student', level: 'A2' },
    { id: 's2', role: 'student', level: null },
    { id: 't1', role: 'teacher', level: null },
  ],
  simulations: [
    { student_id: 's1', mode: 'examen', status: 'completed', started_at: daysAgo(2), completed_at: daysAgo(2), score_by_section: { l: section('Logica', 3, 4) } },
    { student_id: 's1', mode: 'entrainement', status: 'completed', started_at: daysAgo(40), completed_at: daysAgo(40), score_by_section: { l: section('Logica', 1, 4) } },
    { student_id: 's2', mode: 'examen', status: 'in_progress', started_at: daysAgo(1), completed_at: null, score_by_section: null },
  ],
  attempts: [{ student_id: 's2', created_at: daysAgo(5) }],
  embassy: [{ student_id: 's1', status: 'completed', started_at: daysAgo(3), completed_at: daysAgo(3), overall_score: 72 }],
  aiUsage: [
    { estimated_cost: 0.5, created_at: daysAgo(3) },
    { estimated_cost: 0.25, created_at: daysAgo(35) },
  ],
  leads: [
    { status: 'nouveau', created_at: daysAgo(1) },
    { status: 'inscrit', created_at: daysAgo(50) },
  ],
});

describe('buckets', () => {
  it('découpe par jour jusqu’à 90 jours, par semaine au-delà', () => {
    expect(buckets(30, now)).toHaveLength(30);
    expect(buckets(30, now).at(-1)?.start).toBe('2026-09-30T00:00:00.000Z');
    expect(buckets(365, now)).toHaveLength(53);
  });
});

describe('buildAnalytics', () => {
  it('compare la période à la précédente', () => {
    const { kpis } = buildAnalytics(input());
    expect(kpis.activeStudents).toEqual({ value: 2, previous: 1 });
    expect(kpis.simulations).toEqual({ value: 1, previous: 1 });
    expect(kpis.accuracy).toEqual({ value: 75, previous: 25 });
    expect(kpis.interviewScore).toEqual({ value: 72, previous: null });
    expect(kpis.aiCost).toEqual({ value: 0.5, previous: 0.25 });
    expect(kpis.newLeads).toEqual({ value: 1, previous: 1 });
  });

  it('produit des séries et des répartitions cohérentes', () => {
    const analytics = buildAnalytics(input());
    expect(analytics.series).toHaveLength(30);
    expect(analytics.series.reduce((sum, point) => sum + point.simulations, 0)).toBe(1);
    expect(analytics.series.find((point) => point.date === '2026-09-28')?.accuracy).toBe(75);
    expect(analytics.breakdowns.studentsByLevel).toContainEqual({ level: 'A2', count: 1 });
    expect(analytics.breakdowns.studentsByLevel).toContainEqual({ level: null, count: 1 });
    expect(analytics.breakdowns.leadsByStatus.find((entry) => entry.status === 'inscrit')?.count).toBe(1);
    expect(analytics.breakdowns.categoryAccuracy).toEqual([{ category: 'Logica', answers: 4, accuracy: 75 }]);
  });
});
