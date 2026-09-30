// Couche d'accès Firestore : garanties relationnelles portées du schéma SQL (émulateur requis).
import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetEmulators } from './emulator.js';

const { db } = await import('../../src/lib/db/index.js');

async function ok<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function profile(role: 'student' | 'teacher' | 'admin', overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  await ok(db.from('profiles').insert({ id, email: `${id}@salve.test`, role, full_name: `${role} ${id.slice(0, 4)}`, ...overrides }));
  return id;
}

beforeAll(resetEmulators);
beforeEach(resetEmulators);

describe('écritures : valeurs par défaut et contraintes', () => {
  it('applique les valeurs par défaut et renvoie la ligne insérée', async () => {
    const id = await profile('student', { level: 'A2' });
    const row = await ok(db.from('profiles').select('*').eq('id', id).single());
    expect(row).toMatchObject({ status: 'active', must_change_password: true, email_notifications: true, level: 'A2', phone: null });
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('refuse un doublon sur une colonne unique (23505)', async () => {
    const id = await profile('teacher');
    const { error } = await db.from('profiles').insert({ id: randomUUID(), email: `${id}@salve.test`, role: 'teacher', full_name: 'Doublon' });
    expect(error?.code).toBe('23505');
  });

  it('refuse une colonne obligatoire manquante (23502) et une contrainte CHECK (23514)', async () => {
    expect((await db.from('programs').insert({ level: 'A1' })).error?.code).toBe('23502');
    const { error } = await db.from('leads').insert({ full_name: 'Sans contact', source: 'contact_form', contact_consent: true });
    expect(error?.code).toBe('23514');
  });

  it('applique l’index unique partiel : une seule simulation en cours par étudiant', async () => {
    const student = await profile('student');
    const template = await ok(db.from('test_templates').insert({ code: 'T1', name: 'Test', total_duration_seconds: 600 }).select('id').single());
    const simulation = (status: string) => ({
      student_id: student,
      test_template_id: template.id,
      template_version: 1,
      status,
      deadline_at: new Date(Date.now() + 600_000).toISOString(),
      total_questions: 3,
    });
    await ok(db.from('simulations').insert(simulation('in_progress')));
    await ok(db.from('simulations').insert(simulation('completed')));
    expect((await db.from('simulations').insert(simulation('in_progress'))).error?.code).toBe('23505');
  });

  it('vérifie les clés étrangères à l’écriture (23503)', async () => {
    const { error } = await db.from('enrollments').insert({ student_id: randomUUID(), program_id: randomUUID() });
    expect(error?.code).toBe('23503');
  });

  it('met à jour updated_at et suspended_at comme les déclencheurs SQL', async () => {
    const id = await profile('student');
    const before = await ok(db.from('profiles').select('updated_at').eq('id', id).single());
    await new Promise((resolve) => setTimeout(resolve, 5));
    const suspended = await ok(db.from('profiles').update({ status: 'suspended' }).eq('id', id).select('updated_at, suspended_at').single());
    expect(suspended.updated_at > before.updated_at).toBe(true);
    expect(suspended.suspended_at).not.toBeNull();
    const reactivated = await ok(db.from('profiles').update({ status: 'active' }).eq('id', id).select('suspended_at').single());
    expect(reactivated.suspended_at).toBeNull();
  });

  it('conserve fidèlement les colonnes JSON (tableaux imbriqués compris)', async () => {
    const content = { pairs: [['ciao', 'salut'], ['grazie', 'merci']], nested: { deep: [1, [2, 3]] } };
    const exercise = await ok(
      db.from('exercises').insert({ title: 'Appariement', level: 'A1', category: 'vocabulaire', exercise_type: 'appariement', content, solution: { ok: true } }).select('id, content').single(),
    );
    expect(exercise.content).toEqual(content);
  });
});

describe('upsert', () => {
  it('met à jour sur conflit et ignore les doublons si demandé', async () => {
    const student = await profile('student');
    const program = await ok(db.from('programs').insert({ name: 'B1' }).select('id').single());
    const first = await ok(db.from('enrollments').upsert({ student_id: student, program_id: program.id, status: 'active' }, { onConflict: 'student_id,program_id' }).select('id, status').single());
    const second = await ok(db.from('enrollments').upsert({ student_id: student, program_id: program.id, status: 'completed' }, { onConflict: 'student_id,program_id' }).select('id, status').single());
    expect(second).toEqual({ id: first.id, status: 'completed' });
    await ok(db.from('enrollments').upsert({ student_id: student, program_id: program.id, status: 'suspended' }, { onConflict: 'student_id,program_id', ignoreDuplicates: true }));
    const rows = await ok(db.from('enrollments').select('status').eq('student_id', student));
    expect(rows).toEqual([{ status: 'completed' }]);
  });
});

describe('suppressions : cascade, set null, restrict, déclencheurs', () => {
  it('propage la suppression d’un profil selon les clés étrangères', async () => {
    const teacher = await profile('teacher');
    const student = await profile('student');
    const klass = await ok(db.from('classes').insert({ name: 'A1 matin', teacher_id: teacher }).select('id').single());
    await ok(db.from('class_students').insert({ class_id: klass.id, student_id: student }));

    await ok(db.from('profiles').delete().eq('id', student));
    expect(await ok(db.from('class_students').select('*').eq('class_id', klass.id))).toEqual([]);

    await ok(db.from('profiles').delete().eq('id', teacher));
    expect(await ok(db.from('classes').select('teacher_id').eq('id', klass.id).single())).toEqual({ teacher_id: null });
  });

  it('bloque la suppression d’une ligne encore référencée (restrict → 23503)', async () => {
    const student = await profile('student');
    const program = await ok(db.from('programs').insert({ name: 'A2' }).select('id').single());
    await ok(db.from('enrollments').insert({ student_id: student, program_id: program.id }));
    expect((await db.from('programs').delete().eq('id', program.id)).error?.code).toBe('23503');
    expect(await ok(db.from('programs').select('id').eq('id', program.id))).toHaveLength(1);
  });

  it('supprime les feedbacks d’un entretien supprimé (cible polymorphe)', async () => {
    const student = await profile('student');
    await ok(db.from('embassy_scenarios').insert({ code: 'standard', label: 'Standard', description: 'd', agent_instructions: 'i' }));
    const session = await ok(
      db.from('embassy_sessions').insert({ student_id: student, visa_type: 'etudes', prompt_version: 'v1', model: 'fake', max_turns: 10 }).select('id').single(),
    );
    await ok(db.from('teacher_feedback').insert({ student_id: student, target_type: 'embassy_session', target_id: session.id, comment: 'Bien' }));
    const { count } = await db.from('embassy_sessions').delete({ count: 'exact' }).eq('id', session.id);
    expect(count).toBe(1);
    expect(await ok(db.from('teacher_feedback').select('id').eq('student_id', student))).toEqual([]);
  });
});

describe('lectures : filtres, tri, jointures', () => {
  it('filtre avec or / not / is / in / plages, trie (NULL en dernier) et pagine', async () => {
    const klass = await ok(db.from('classes').insert({ name: 'B1' }).select('id').single());
    const other = await ok(db.from('classes').insert({ name: 'B2' }).select('id').single());
    for (const [title, classId, category] of [
      ['Commun', null, 'grammaire'],
      ['Classe B1', klass.id, 'vocabulaire'],
      ['Classe B2', other.id, 'grammaire'],
    ] as const) {
      await ok(db.from('courses').insert({ title, level: 'B1', category, content_type: 'text', body: 'x', class_id: classId, is_published: true }));
    }
    const visible = await ok(db.from('courses').select('title').eq('is_published', true).or(`class_id.is.null,class_id.in.(${klass.id})`).order('title'));
    expect(visible.map((row: { title: string }) => row.title)).toEqual(['Classe B1', 'Commun']);

    const notGrammar = await ok(db.from('courses').select('title').not('category', 'in', '(grammaire)'));
    expect(notGrammar).toEqual([{ title: 'Classe B1' }]);

    const withClass = await ok(db.from('courses').select('title').not('class_id', 'is', null).order('title', { ascending: false }).limit(1));
    expect(withClass).toEqual([{ title: 'Classe B2' }]);

    const { count, data } = await db.from('courses').select('id', { count: 'exact', head: true }).gte('created_at', '2000-01-01');
    expect(count).toBe(3);
    expect(data).toBeNull();

    const sorted = await ok(db.from('courses').select('title, class_id').order('class_id').order('title'));
    expect(sorted.at(-1)).toMatchObject({ class_id: null });
  });

  it('résout les jointures : vers un parent, vers des enfants, comptage, alias, !inner', async () => {
    const teacher = await profile('teacher', { full_name: 'Prof Rossi' });
    const active = await profile('student', { full_name: 'Ada' });
    const suspended = await profile('student', { full_name: 'Bob', status: 'suspended' });
    const klass = await ok(db.from('classes').insert({ name: 'A1', teacher_id: teacher }).select('id').single());
    await ok(db.from('class_students').insert([{ class_id: klass.id, student_id: active }, { class_id: klass.id, student_id: suspended }]));

    const members = await ok(db.from('class_students').select('student_id, profiles!inner(status)').eq('class_id', klass.id).eq('profiles.status', 'active'));
    expect(members).toEqual([{ student_id: active, profiles: { status: 'active' } }]);

    const classes = await ok(db.from('classes').select('name, class_students(count), teacher:profiles!classes_teacher_id_fkey(full_name)').eq('id', klass.id).single());
    expect(classes).toEqual({ name: 'A1', class_students: [{ count: 2 }], teacher: { full_name: 'Prof Rossi' } });

    const template = await ok(db.from('test_templates').insert({ code: 'T2', name: 'Modèle', total_duration_seconds: 60 }).select('id').single());
    await ok(db.from('test_sections').insert([
      { template_id: template.id, name: 'Logica', category: 'logica', question_count: 2, order_index: 0 },
      { template_id: template.id, name: 'Matematica', category: 'matematica', question_count: 3, order_index: 1 },
    ]));
    const withSections = await ok(db.from('test_templates').select('code, test_sections(category, question_count)').eq('id', template.id).single());
    expect(withSections.test_sections).toHaveLength(2);
  });

  it('lit un chemin JSON (->>) et signale single() sans ligne (PGRST116)', async () => {
    const student = await profile('student');
    await ok(db.from('embassy_scenarios').insert({ code: 'standard', label: 'Standard', description: 'd', agent_instructions: 'i' }));
    const report = { level: 'solide', inconsistencies: ['budget'] };
    await ok(
      db.from('embassy_sessions').insert({ student_id: student, visa_type: 'etudes', prompt_version: 'v1', model: 'fake', max_turns: 10, status: 'completed', ai_report: report, overall_score: 72 }),
    );
    const rows = await ok(db.from('embassy_sessions').select('overall_score, ai_report->>level, ai_report->inconsistencies').eq('student_id', student));
    expect(rows).toEqual([{ overall_score: 72, level: 'solide', inconsistencies: ['budget'] }]);
    expect((await db.from('profiles').select('id').eq('id', randomUUID()).single()).error?.code).toBe('PGRST116');
    expect((await db.from('profiles').select('id').eq('id', randomUUID()).maybeSingle()).data).toBeNull();
  });

  it('découpe les clauses in de plus de 30 valeurs', async () => {
    const ids = await Promise.all(Array.from({ length: 35 }, () => profile('student')));
    const rows = await ok(db.from('profiles').select('id').in('email', ids.map((id) => `${id}@salve.test`)));
    expect(rows).toHaveLength(35);
  });
});
