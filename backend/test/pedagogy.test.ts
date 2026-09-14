import { describe, expect, it } from 'vitest';
import { isVisibleTo } from '../src/services/announcements.js';
import { compileExercise, gradeExercise, normalizeAnswer, toExerciseInput, type ExerciseInput } from '../src/services/exercise-grading.js';
import { estimateLevel } from '../src/services/level-test.js';
import { slugify } from '../src/services/site-content.js';

describe('site vitrine : adresses de page', () => {
  it('produit des slugs lisibles sans accents ni caractères spéciaux', () => {
    expect(slugify('Italien B1 — Intermédiaire')).toBe('italien-b1-intermediaire');
    expect(slugify('  Préparation TOLC & visa !  ')).toBe('preparation-tolc-visa');
    expect(slugify('---')).toBe('');
  });
});

describe('exercices : QCM', () => {
  const input: ExerciseInput = {
    type: 'qcm',
    questions: [
      { text: 'Bonsoir ?', options: ['Buongiorno', 'Buonasera', 'Ciao'], correctIndex: 1 },
      { text: 'Merci ?', options: ['Grazie', 'Prego'], correctIndex: 0 },
    ],
  };

  it('sépare contenu public et solution', () => {
    const compiled = compileExercise(input);
    expect(JSON.stringify(compiled.content)).not.toContain('correct');
    expect(compiled.solution).toEqual({ answers: { q1: 'B', q2: 'A' } });
  });

  it('corrige et ne compte pas les questions sans réponse', () => {
    const { content, solution } = compileExercise(input);
    expect(gradeExercise('qcm', content, solution, { q1: 'B' })).toMatchObject({
      score: 1,
      maxScore: 2,
      items: [
        { id: 'q1', correct: true },
        { id: 'q2', correct: false, given: null, expected: 'A' },
      ],
    });
  });

  it('se reconstruit à l’identique pour l’édition', () => {
    const { content, solution } = compileExercise(input);
    expect(toExerciseInput('qcm', content, solution)).toEqual(input);
  });
});

describe('exercices : texte à trous', () => {
  const input: ExerciseInput = { type: 'texte_a_trous', text: 'Io [[sono]] Marco e [[abito|vivo]] a Pisa. L’[[università]] è grande.' };

  it('extrait les trous et les variantes acceptées', () => {
    const { content, solution } = compileExercise(input);
    expect((content.segments as { type: string }[]).filter((segment) => segment.type === 'gap')).toHaveLength(3);
    expect(solution).toEqual({ answers: { g1: ['sono'], g2: ['abito', 'vivo'], g3: ['università'] } });
    expect(JSON.stringify(content)).not.toContain('sono');
  });

  it('tolère casse et espaces, accepte les variantes, reste strict sur les accents', () => {
    const { content, solution } = compileExercise(input);
    const result = gradeExercise('texte_a_trous', content, solution, { g1: '  SONO ', g2: 'vivo', g3: 'universita' });
    expect(result.items.map((item) => item.correct)).toEqual([true, true, false]);
    expect(normalizeAnswer('l’amico')).toBe(normalizeAnswer("L'amico"));
  });

  it('se reconstruit à l’identique pour l’édition', () => {
    const { content, solution } = compileExercise(input);
    expect(toExerciseInput('texte_a_trous', content, solution)).toEqual(input);
  });
});

describe('exercices : appariement', () => {
  const input: ExerciseInput = {
    type: 'appariement',
    pairs: [
      { left: 'cane', right: 'chien' },
      { left: 'gatto', right: 'chat' },
      { left: 'casa', right: 'maison' },
    ],
  };

  it('mélange la colonne de droite : ni l’ordre ni les ids ne révèlent les paires', () => {
    // Aléa déterministe (toujours 0) : Fisher–Yates produit alors [chat, maison, chien].
    const { content, solution } = compileExercise(input, () => 0);
    const right = content.right as { id: string; text: string }[];
    expect(right.map((item) => item.id)).toEqual(['r1', 'r2', 'r3']);
    expect(right.map((item) => item.text)).not.toEqual(['chien', 'chat', 'maison']);
    const pairs = (solution as { pairs: Record<string, string> }).pairs;
    expect(right.find((item) => item.id === pairs.l1)?.text).toBe('chien');
  });

  it('corrige chaque association', () => {
    const { content, solution } = compileExercise(input);
    const pairs = (solution as { pairs: Record<string, string> }).pairs;
    const result = gradeExercise('appariement', content, solution, { l1: pairs.l1!, l2: pairs.l1!, l3: pairs.l3! });
    expect(result).toMatchObject({ score: 2, maxScore: 3 });
    expect(toExerciseInput('appariement', content, solution)).toEqual(input);
  });
});

describe('test de niveau : estimation', () => {
  it('retient le plus haut niveau atteint sans lacune en dessous', () => {
    expect(estimateLevel({ A1: { correct: 3, total: 3 }, A2: { correct: 2, total: 3 }, B1: { correct: 1, total: 3 }, B2: { correct: 3, total: 3 } })).toBe('A2');
  });

  it('renvoie null pour un débutant', () => {
    expect(estimateLevel({ A1: { correct: 1, total: 3 }, A2: { correct: 3, total: 3 } })).toBeNull();
  });

  it('peut atteindre B2', () => {
    expect(estimateLevel({ A1: { correct: 3, total: 3 }, A2: { correct: 3, total: 3 }, B1: { correct: 2, total: 3 }, B2: { correct: 2, total: 3 } })).toBe('B2');
  });
});

describe('annonces : visibilité', () => {
  const student = { userId: 's1', role: 'student' as const, aal: 'aal1' as const, mustChangePassword: false };
  const teacher = { userId: 't1', role: 'teacher' as const, aal: 'aal1' as const, mustChangePassword: false };

  it('applique la cible (tous, rôle, classe)', () => {
    expect(isVisibleTo(student, ['c1'], { target: 'all', target_class_id: null, published_by: 'x' })).toBe(true);
    expect(isVisibleTo(student, ['c1'], { target: 'teachers', target_class_id: null, published_by: 'x' })).toBe(false);
    expect(isVisibleTo(teacher, ['c1'], { target: 'teachers', target_class_id: null, published_by: 'x' })).toBe(true);
    expect(isVisibleTo(student, ['c1'], { target: 'class', target_class_id: 'c1', published_by: 'x' })).toBe(true);
    expect(isVisibleTo(student, ['c1'], { target: 'class', target_class_id: 'c2', published_by: 'x' })).toBe(false);
    expect(isVisibleTo(teacher, [], { target: 'class', target_class_id: 'c2', published_by: 't1' })).toBe(true);
  });
});
