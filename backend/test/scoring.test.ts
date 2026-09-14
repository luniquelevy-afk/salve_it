import { describe, expect, it } from 'vitest';
import { scoreAnswers, shuffle, type GradedAnswer } from '../src/services/scoring.js';

const TOLC_LIKE = { correct: 1, wrong: -0.25, blank: 0 };

function answer(sectionKey: string, answerGiven: string | null, isCorrect: boolean): GradedAnswer {
  return { sectionKey, sectionName: sectionKey.toUpperCase(), answerGiven, isCorrect };
}

describe('scoreAnswers', () => {
  it('applique le barème bonne / mauvaise / sans réponse', () => {
    const result = scoreAnswers(
      [answer('logica', 'A', true), answer('logica', 'B', false), answer('logica', null, false), answer('logica', 'C', true)],
      TOLC_LIKE,
    );
    expect(result).toMatchObject({ correct: 2, wrong: 1, blank: 1, total: 4, points: 1.75 });
  });

  it('ne compte jamais juste une question sans réponse (EF-10)', () => {
    const result = scoreAnswers([answer('math', null, true)], TOLC_LIKE);
    expect(result).toMatchObject({ correct: 0, blank: 1, points: 0 });
  });

  it('détaille le score par section et arrondit au centième', () => {
    const result = scoreAnswers(
      [answer('logica', 'A', false), answer('logica', 'B', false), answer('logica', 'C', false), answer('math', 'A', true)],
      TOLC_LIKE,
    );
    expect(result.bySection.logica).toMatchObject({ name: 'LOGICA', wrong: 3, points: -0.75 });
    expect(result.bySection.math).toMatchObject({ correct: 1, points: 1 });
    expect(result.points).toBe(0.25);
  });

  it('gère une simulation vide', () => {
    expect(scoreAnswers([], TOLC_LIKE)).toMatchObject({ total: 0, points: 0, bySection: {} });
  });
});

describe('shuffle', () => {
  it('conserve tous les éléments sans modifier la source', () => {
    const source = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(source);
    expect([...shuffled].sort()).toEqual(source);
    expect(source).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('utilise la source d’aléa fournie', () => {
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
  });
});
