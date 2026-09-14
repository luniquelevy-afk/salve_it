import { describe, expect, it } from 'vitest';
import {
  csvCell,
  fileSlug,
  formatExportDate,
  RESULTS_CSV_HEADER,
  resultsCsv,
  toCsv,
  type EmbassyExportRow,
  type SimulationExportRow,
} from '../src/services/student-export.js';

describe('EF-38 — cellules CSV', () => {
  it('neutralise les formules (injection CSV)', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33 6')).toBe("'+33 6");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('garde les nombres tels quels, négatifs compris, avec virgule décimale', () => {
    expect(csvCell(-0.25)).toBe('-0,25');
    expect(csvCell(36)).toBe('36');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('protège séparateur, guillemets et retours à la ligne', () => {
    expect(csvCell('Pise; Bologne')).toBe('"Pise; Bologne"');
    expect(csvCell('dit "oui"')).toBe('"dit ""oui"""');
    expect(csvCell('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
    expect(csvCell(null)).toBe('');
  });

  it('produit un fichier lisible par Excel en français (BOM, point-virgule, CRLF)', () => {
    const csv = toCsv(['A', 'B'], [[1.5, 'x']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toBe('﻿A;B\r\n1,5;x\r\n');
  });
});

describe('EF-38 — résultats de l’étudiant', () => {
  const simulation: SimulationExportRow = {
    id: 's1',
    mode: 'examen',
    status: 'completed',
    started_at: '2026-09-10T08:00:00Z',
    completed_at: '2026-09-10T08:20:00Z',
    total_questions: 6,
    score: '3.75',
    score_by_section: { logica: { correct: 2 }, matematica: { correct: 2 } },
    test_templates: { code: 'CENTRE-DEMO', name: 'Simulation de type TOLC — démonstration' },
  };
  const session: EmbassyExportRow = {
    id: 'e1',
    visa_type: 'etudes',
    scenario_code: 'financement_familial',
    input_mode: 'text',
    status: 'completed',
    started_at: '2026-09-12T09:00:00Z',
    completed_at: '2026-09-12T09:15:00Z',
    turn_count: 5,
    overall_score: 53,
    uses_profile: true,
    prompt_version: 'consul-v2',
    model: 'fake-consul',
    ai_report: { level: 'intermediaire', inconsistencies: [{ topic: 'Ville' }] },
  };

  it('une ligne par activité, triées par date, avec libellés lisibles', () => {
    const csv = resultsCsv([simulation], [session], new Map([['financement_familial', 'Financement par la famille']]));
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toBe(RESULTS_CSV_HEADER.join(';'));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      `Simulation;${formatExportDate(simulation.started_at)};${formatExportDate(simulation.completed_at)};Simulation de type TOLC — démonstration;Examen;Terminée;3,75;4;6;;`,
    );
    expect(lines[2]).toContain('Entretien consulaire;');
    expect(lines[2]).toContain(';Financement par la famille;Visa études;Terminé;53;;5;Préparation intermédiaire;1');
  });

  it('date en heure de Brazzaville (UTC+1)', () => {
    expect(formatExportDate('2026-09-10T08:00:00Z')).toContain('09:00');
    expect(formatExportDate(null)).toBe('');
  });

  it('nom de fichier sans accents ni caractères spéciaux', () => {
    expect(fileSlug('Étudiant Démo / N°1')).toBe('etudiant-demo-n-1');
    expect(fileSlug('***')).toBe('etudiant');
  });
});
