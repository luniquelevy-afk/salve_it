import { describe, expect, it } from 'vitest';
import { buildUpcoming, summarizeEmbassy, summarizeSimulations } from '../src/services/student-dashboard.js';

describe('§16.1 — simulations', () => {
  it('sans simulation : aucun indicateur inventé', () => {
    expect(summarizeSimulations([])).toEqual({ count: 0, latest: null, averagePercent: null, firstPercent: null, progressionPoints: null });
  });

  it('dernier taux, moyenne et progression depuis la première, quel que soit l’ordre reçu', () => {
    const summary = summarizeSimulations([
      { completedAt: '2026-09-12T10:00:00Z', accuracy: 0.8, templateName: 'TOLC-E' },
      { completedAt: '2026-09-01T10:00:00Z', accuracy: 0.5, templateName: 'TOLC-E' },
      { completedAt: '2026-09-05T10:00:00Z', accuracy: 0.65, templateName: 'CENTRE-DEMO' },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.latest).toEqual({ percent: 80, templateName: 'TOLC-E', completedAt: '2026-09-12T10:00:00Z' });
    expect(summary.averagePercent).toBe(65);
    expect(summary.firstPercent).toBe(50);
    expect(summary.progressionPoints).toBe(30);
  });

  it('une seule simulation : pas de progression calculée', () => {
    expect(summarizeSimulations([{ completedAt: '2026-09-01T10:00:00Z', accuracy: 0.42, templateName: null }]).progressionPoints).toBeNull();
  });
});

describe('§16.1 — entretiens', () => {
  it('score moyen, cohérence moyenne et incohérences du plus récent', () => {
    const summary = summarizeEmbassy([
      { completedAt: '2026-09-01T10:00:00Z', overallScore: 50, coherence: 40, inconsistencies: 0 },
      { completedAt: '2026-09-10T10:00:00Z', overallScore: 71, coherence: null, inconsistencies: 2 },
      { completedAt: '2026-09-05T10:00:00Z', overallScore: 60, coherence: 61, inconsistencies: 1 },
    ]);
    expect(summary).toEqual({ count: 3, averageScore: 60, averageCoherence: 51, latestInconsistencies: 2 });
  });

  it('sans entretien : valeurs nulles', () => {
    expect(summarizeEmbassy([])).toEqual({ count: 0, averageScore: null, averageCoherence: null, latestInconsistencies: null });
  });
});

describe('§16.1 — prochaines échéances', () => {
  it('mélange séances et expirations dans l’ordre chronologique, avec une limite', () => {
    const upcoming = buildUpcoming(
      [
        { title: 'Italien B1', className: 'Classe B1', startsAt: '2026-09-16T08:00:00.000Z', location: 'Salle 2' },
        { title: 'Atelier visa', className: null, startsAt: '2026-09-20T14:00:00.000Z', location: null },
      ],
      [
        { label: 'Assurance santé', expiresAt: '2026-09-18', expired: false },
        { label: 'Passeport', expiresAt: '2026-09-10', expired: true },
      ],
      3,
    );
    expect(upcoming.map((item) => item.title)).toEqual(['Passeport : document expiré', 'Italien B1', 'Assurance santé : expiration']);
    expect(upcoming[1]).toMatchObject({ kind: 'class_session', detail: 'Classe B1 · Salle 2', link: '/calendrier' });
    expect(upcoming[0]).toMatchObject({ kind: 'document_expiry', detail: 'À renouveler', link: '/etudiant/documents' });
  });
});
