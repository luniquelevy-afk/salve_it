import { describe, expect, it } from 'vitest';
import { buildFollowUps, groupFollowUps, weeklyTrend } from '../src/services/admin-home.js';

const now = new Date('2026-09-30T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const sim = (student: string, days: number, correct: number) => ({
  id: `${student}-${days}`,
  student_id: student,
  status: 'completed',
  started_at: daysAgo(days),
  completed_at: daysAgo(days),
  score_by_section: { l: { name: 'Logica', correct, total: 10 } },
});

describe('buildFollowUps', () => {
  it('signale inactivité, baisse de score, documents et rapports à consulter', () => {
    const followUps = buildFollowUps({
      now,
      students: [
        { id: 'a', full_name: 'Grâce M.', created_at: daysAgo(60) },
        { id: 'b', full_name: 'Patrick K.', created_at: daysAgo(60) },
        { id: 'c', full_name: 'Nadia L.', created_at: daysAgo(2) },
      ],
      simulations: [sim('a', 1, 5), sim('a', 3, 8), sim('b', 12, 7)],
      attempts: [],
      embassy: [{ id: 'e1', student_id: 'a', status: 'completed', started_at: daysAgo(2), completed_at: daysAgo(2) }],
      documents: [{ student_id: 'c', status: 'submitted' }],
      feedbackTargets: new Set(),
    });
    expect(followUps.map((item) => [item.name, item.reason])).toEqual([
      ['Nadia L.', 'document_to_review'],
      ['Grâce M.', 'report_to_review'],
      ['Grâce M.', 'score_drop'],
      ['Patrick K.', 'inactive'],
    ]);
    expect(followUps.find((item) => item.reason === 'inactive')?.detail).toBe('Inactif depuis 12 jours');
  });

  it('ne signale pas un compte récent sans activité', () => {
    expect(buildFollowUps({ now, students: [{ id: 'n', full_name: 'Nouveau', created_at: daysAgo(3) }], simulations: [], attempts: [], embassy: [], documents: [], feedbackTargets: new Set() })).toEqual([]);
  });
});

describe('weeklyTrend', () => {
  it('agrège 12 semaines : nombre de simulations et score moyen', () => {
    const trend = weeklyTrend([sim('a', 1, 6), sim('b', 2, 8), sim('a', 20, 5)], now);
    expect(trend).toHaveLength(12);
    expect(trend.at(-1)).toMatchObject({ simulations: 2, averageScore: 70 });
    expect(trend.reduce((sum, week) => sum + week.simulations, 0)).toBe(3);
  });
});

describe('groupFollowUps', () => {
  it('garde une ligne par étudiant avec le motif prioritaire', () => {
    const grouped = groupFollowUps([
      { studentId: 'a', name: 'Grâce', reason: 'report_to_review', detail: 'Rapport', link: '/x' },
      { studentId: 'b', name: 'Patrick', reason: 'inactive', detail: 'Inactif', link: '/y' },
      { studentId: 'a', name: 'Grâce', reason: 'score_drop', detail: 'Score en baisse', link: '/x' },
    ]);
    expect(grouped).toEqual([
      { studentId: 'a', name: 'Grâce', reason: 'report_to_review', detail: 'Rapport', link: '/x', others: ['Score en baisse'] },
      { studentId: 'b', name: 'Patrick', reason: 'inactive', detail: 'Inactif', link: '/y', others: [] },
    ]);
  });
});
