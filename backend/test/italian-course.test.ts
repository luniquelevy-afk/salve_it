import { describe, expect, it } from 'vitest';
import { acceptedAnswers, loadItalianCourse, loadPlacementTest, parseQcmItems } from '../src/migrations/italian-course.js';
import { compileExercise, gradeExercise } from '../src/services/exercise-grading.js';

describe('programme d’italien (content/cours-italien)', () => {
  const courses = loadItalianCourse();

  it('importe les 39 modules, l’évaluation A1 et les ressources', () => {
    const modules = courses.filter((course) => /^[AB][12]-M\d\d$/.test(course.code));
    expect(modules).toHaveLength(39);
    expect(courses.some((course) => course.code === 'EVAL-A1')).toBe(true);
    expect(courses.filter((course) => course.category === 'ressources').length).toBeGreaterThanOrEqual(10);
    expect(new Set(courses.map((course) => course.title)).size).toBe(courses.length);
  });

  it('garde les évaluations (corrigé enseignant) hors de la vue étudiant', () => {
    for (const course of courses.filter((candidate) => candidate.category === 'évaluation')) {
      expect(course.isPublished).toBe(false);
      expect(course.exercises).toHaveLength(0);
    }
  });

  it('remplace les liens internes par le titre du module', () => {
    const course = courses.find((candidate) => candidate.code === 'A1-M02')!;
    expect(course.body).not.toMatch(/\[\[/);
    expect(course.body).toContain('**A1-M03 — ');
    expect(course.body.startsWith('# ')).toBe(false);
  });

  it('génère des exercices autocorrigés valides pour (presque) chaque module', () => {
    const exercises = courses.flatMap((course) => course.exercises);
    expect(exercises.length).toBeGreaterThan(90);
    for (const exercise of exercises) expect(() => compileExercise(exercise.input)).not.toThrow();
    expect(new Set(exercises.map((exercise) => exercise.title)).size).toBe(exercises.length);
  });

  it('corrige le QCM du module A1-M02 selon le corrigé du cours', () => {
    const qcm = courses.find((course) => course.code === 'A1-M02')!.exercises.find((exercise) => exercise.input.type === 'qcm')!;
    const compiled = compileExercise(qcm.input);
    // Corrigé du module : 1-b · 2-a · 3-c · 4-a · 5-b · 6-c
    const answers = { q1: 'B', q2: 'A', q3: 'C', q4: 'A', q5: 'B', q6: 'C' };
    expect(gradeExercise('qcm', compiled.content, compiled.solution, answers).score).toBe(6);
  });

  it('accepte les variantes du corrigé dans les textes à trous', () => {
    const gap = courses.find((course) => course.code === 'A2-M04')!.exercises.find((exercise) => exercise.input.type === 'texte_a_trous')!;
    expect(gap.input.type === 'texte_a_trous' && gap.input.text).toContain('[[piace]]');
    expect(acceptedAnswers('fosse (già) cominciata')).toEqual(['fosse già cominciata', 'fosse cominciata']);
    expect(acceptedAnswers('Ho vent\'anni *(ou : venti anni)*')).toEqual(['Ho vent\'anni', 'venti anni']);
    expect(acceptedAnswers('piace *(verbe à l\'infinitif → singulier)*')).toEqual(['piace']);
  });

  it('transforme une association à réponses répétées en QCM', () => {
    const first = courses.find((course) => course.code === 'A1-M04')!.exercises[0]!;
    expect(first.input.type).toBe('qcm');
  });

  it('lit le test de positionnement : 40 questions, 10 par niveau', () => {
    const placement = loadPlacementTest();
    expect(placement).toHaveLength(40);
    for (const level of ['A1', 'A2', 'B1', 'B2']) expect(placement.filter((item) => item.level === level)).toHaveLength(10);
    expect(placement[0]).toMatchObject({ options: ['Ciao', 'Buongiorno', 'Buonanotte'], correctIndex: 1 });
  });

  it('analyse une ligne de QCM « a) b) c) »', () => {
    expect(parseQcmItems('1. Io ___ studentessa. a) è b) sono c) sei', '1-b')).toEqual([
      { text: 'Io ___ studentessa.', options: ['è', 'sono', 'sei'], correctIndex: 1 },
    ]);
  });
});
