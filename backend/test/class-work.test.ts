import { describe, expect, it } from 'vitest';
import { summarizeAttendance } from '../src/services/attendance.js';
import { CLASS_REPORT_HEADER } from '../src/services/class-report.js';
import { homeworkState, isLateSubmission } from '../src/services/homework.js';

describe('§13 — présence', () => {
  it('taux de présence : présents et retards sur les séances non excusées', () => {
    expect(summarizeAttendance(['present', 'retard', 'absent', 'excuse', 'present'])).toEqual({
      recorded: 5,
      present: 2,
      late: 1,
      absent: 1,
      excused: 1,
      ratePercent: 75,
    });
  });

  it('aucune séance comptée (rien saisi ou tout excusé) : pas de taux inventé', () => {
    expect(summarizeAttendance([]).ratePercent).toBeNull();
    expect(summarizeAttendance(['excuse', 'excuse']).ratePercent).toBeNull();
  });
});

describe('§13 — devoirs', () => {
  const now = new Date('2026-09-14T12:00:00Z');

  it('à faire avant l’échéance, en retard après, sans rendu', () => {
    expect(homeworkState('2026-09-15T12:00:00Z', null, now)).toBe('a_faire');
    expect(homeworkState('2026-09-13T12:00:00Z', null, now)).toBe('en_retard');
  });

  it('le statut du rendu prime sur l’échéance', () => {
    expect(homeworkState('2026-09-13T12:00:00Z', { status: 'rendu' }, now)).toBe('rendu');
    expect(homeworkState('2026-09-13T12:00:00Z', { status: 'a_reprendre' }, now)).toBe('a_reprendre');
    expect(homeworkState('2026-09-15T12:00:00Z', { status: 'valide' }, now)).toBe('valide');
  });

  it('rendu en retard seulement après la date limite', () => {
    expect(isLateSubmission('2026-09-14T12:00:00Z', '2026-09-14T11:59:00Z')).toBe(false);
    expect(isLateSubmission('2026-09-14T12:00:00Z', '2026-09-14T12:01:00Z')).toBe(true);
  });

  it('le rapport de classe couvre présence, devoirs et résultats', () => {
    expect(CLASS_REPORT_HEADER).toContain('Taux de présence (%)');
    expect(CLASS_REPORT_HEADER).toContain('Devoirs non rendus');
    expect(CLASS_REPORT_HEADER).toContain('Réussite moyenne en simulation (%)');
    expect(new Set(CLASS_REPORT_HEADER).size).toBe(CLASS_REPORT_HEADER.length);
  });
});
