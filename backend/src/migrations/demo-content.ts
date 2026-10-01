// Contenu de démonstration (programmes, modèle de test, questions, FAQ, test de niveau, cours).
// Idempotent : relançable sans créer de doublons. Jamais en production.
import { db } from '../lib/db/index.js';
import {
  DEMO_COURSE,
  DEMO_EXERCISE,
  DEMO_FAQ,
  DEMO_PROGRAMS,
  DEMO_QUESTIONS,
  DEMO_SECTIONS,
  DEMO_TEMPLATE,
  LEVEL_TEST_QUESTIONS,
} from './demo-data.js';

async function must<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Lignes sans clé naturelle : insérées seulement si aucune ligne n'a déjà cette valeur.
async function insertIfAbsent(table: string, column: string, rows: Record<string, unknown>[]) {
  const existing = await must(db.from(table).select(column));
  const known = new Set((existing as Record<string, unknown>[]).map((row) => row[column]));
  const missing = rows.filter((row) => !known.has(row[column]));
  if (missing.length > 0) await must(db.from(table).insert(missing));
  return missing.length;
}

export async function seedDemoContent(): Promise<string> {
  await must(db.from('programs').upsert(DEMO_PROGRAMS, { onConflict: 'slug', ignoreDuplicates: true }));

  await must(db.from('test_templates').upsert(DEMO_TEMPLATE, { onConflict: 'code', ignoreDuplicates: true }));
  const template = await must(db.from('test_templates').select('id').eq('code', DEMO_TEMPLATE.code).single());
  await must(
    db.from('test_sections').upsert(
      DEMO_SECTIONS.map((section) => ({ ...section, template_id: template.id })),
      { onConflict: 'template_id,order_index', ignoreDuplicates: true },
    ),
  );

  const questions = await insertIfAbsent('questions', 'question_text', DEMO_QUESTIONS);
  const faq = await insertIfAbsent('faq_items', 'question', DEMO_FAQ);
  // Le test de positionnement du programme (migration 0003) prime sur ces questions de démonstration.
  const levelTest = await must(db.from('level_test_questions').select('id').limit(1));
  if ((levelTest as unknown[]).length === 0) {
    await must(db.from('level_test_questions').upsert(LEVEL_TEST_QUESTIONS, { onConflict: 'order_index', ignoreDuplicates: true }));
  }

  let course = await must(db.from('courses').select('id').eq('title', DEMO_COURSE.title).maybeSingle());
  course ??= await must(db.from('courses').insert({ ...DEMO_COURSE, published_at: new Date().toISOString() }).select('id').single());
  await insertIfAbsent('exercises', 'title', [{ ...DEMO_EXERCISE, course_id: course.id }]);

  return `Contenu de démonstration prêt : ${DEMO_PROGRAMS.length} programmes, modèle ${DEMO_TEMPLATE.code}, ${questions} question(s) et ${faq} FAQ ajoutées.`;
}
