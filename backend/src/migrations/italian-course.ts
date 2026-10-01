// Programme d'italien Salve Italia (A1 → B2) : lecture des modules Markdown de content/cours-italien
// et génération des cours, exercices autocorrigés, questions de la banque, modèles de test par niveau
// et test de positionnement. Les fichiers sources restent la référence : l'import ne fait que les traduire.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/db/index.js';
import { compileExercise, type ExerciseInput } from '../services/exercise-grading.js';

export type Level = 'A1' | 'A2' | 'B1' | 'B2';

export const CONTENT_DIR = fileURLToPath(new URL('../../content/cours-italien/', import.meta.url));

export interface ParsedQcmItem {
  text: string;
  options: string[];
  correctIndex: number;
}

export interface ParsedExercise {
  title: string;
  instructions: string | null;
  input: ExerciseInput;
}

export interface ParsedCourse {
  code: string;
  title: string;
  description: string | null;
  level: Level;
  category: 'italien' | 'évaluation' | 'ressources';
  body: string;
  isPublished: boolean;
  exercises: ParsedExercise[];
  // QCM du module, versés dans la banque de questions (simulations par niveau).
  qcm: (ParsedQcmItem & { context: string })[];
}

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2'];
const BLANK = /_{3,}/g;

// ─────────────────────────────────────────────────────────────
// Outils Markdown
// ─────────────────────────────────────────────────────────────

function splitFrontmatter(source: string): { meta: Record<string, string>; content: string } {
  const text = source.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return { meta: {}, content: text };
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (field) meta[field[1]!] = field[2]!.replace(/^"(.*)"$/, '$1').trim();
  }
  return { meta, content: text.slice(match[0].length) };
}

// Sections de niveau `depth` (## = 2, ### = 3) : titre → contenu jusqu'au prochain titre de même niveau ou supérieur.
function sections(content: string, depth: number): { heading: string; body: string }[] {
  const lines = content.split('\n');
  const marker = '#'.repeat(depth) + ' ';
  const result: { heading: string; body: string[] }[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    const level = inFence ? 0 : (/^(#+) /.exec(line)?.[1]?.length ?? 0);
    if (level === depth && line.startsWith(marker)) {
      result.push({ heading: line.slice(marker.length).trim(), body: [] });
    } else if (level > 0 && level < depth) {
      result.push({ heading: '', body: [] });
    } else {
      result.at(-1)?.body.push(line);
    }
  }
  return result.filter((section) => section.heading).map((section) => ({ heading: section.heading, body: section.body.join('\n') }));
}

const stripMarkdown = (value: string) =>
  value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

// « 1-c · 2-d » → { 1: 'c', 2: 'd' }
function letterKey(corrige: string): Map<number, string> {
  const key = new Map<number, string>();
  for (const match of corrige.matchAll(/(\d+)\s*[-–]\s*([a-f])\b/g)) key.set(Number(match[1]), match[2]!);
  return key;
}

// Éléments numérotés « 1. … » (sur une ligne chacun ou séparés par « · »).
function numberedItems(text: string): Map<number, string> {
  const items = new Map<number, string>();
  const flat = text
    .split('\n')
    .filter((line) => !line.startsWith('**Explication') && !line.startsWith('>') && !line.startsWith('**Méthode'))
    .join('\n');
  const parts = flat.split(/(?:^|\n|·)\s*(\d+)\.\s+/);
  for (let index = 1; index < parts.length; index += 2) {
    const value = parts[index + 1]!.trim();
    if (value) items.set(Number(parts[index]), value);
  }
  return items;
}

// Réponse du corrigé → variantes acceptées : « l'ho (già) vista » accepte avec et sans « già »,
// « Li devo chiamare. / Devo chiamarli. » et « (ou : …) » donnent des alternatives.
export function acceptedAnswers(raw: string): string[] {
  const alternatives: string[] = [];
  let text = raw.replace(/\*\*/g, '');
  for (const match of text.matchAll(/\*?\((?:ou|or)\s*:\s*([^)]+)\)\*?/gi)) alternatives.push(match[1]!);
  text = text.replace(/\*?\([^)]*\)\*?/g, (group) => (/^\*?\((?:ou|or)\s*:/i.test(group) ? '' : group));
  text = text.replace(/\*\([^)]*\)\*/g, '');
  alternatives.unshift(...text.split(/\s+\/\s+/));

  const variants = new Set<string>();
  for (const alternative of alternatives) {
    const clean = alternative.replace(/\*/g, '').replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const optional = /\(([^)]+)\)/.exec(clean);
    if (optional) {
      variants.add(clean.replace(optional[0], optional[1]!).replace(/\s+/g, ' ').trim());
      variants.add(clean.replace(optional[0], '').replace(/\s+/g, ' ').trim());
    } else {
      variants.add(clean);
    }
  }
  return [...variants].filter((value) => value && !value.includes('|') && !value.includes(']'));
}

// ─────────────────────────────────────────────────────────────
// Exercices
// ─────────────────────────────────────────────────────────────

function introLines(body: string): string | null {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^\d+\./.test(line) && !line.startsWith('|') && !line.startsWith('>'));
  return lines.length ? stripMarkdown(lines.join(' ')).slice(0, 500) : null;
}

function parseMatching(body: string, corrige: string): ExerciseInput | null {
  const left = new Map<number, string>();
  const right = new Map<string, string>();
  for (const row of body.split('\n').filter((line) => line.trim().startsWith('|'))) {
    for (const cell of row.split('|').map((value) => value.trim())) {
      const numbered = /^(\d+)\.\s+(.+)$/.exec(cell);
      const lettered = /^([a-f])\.\s+(.+)$/.exec(cell);
      if (numbered) left.set(Number(numbered[1]), stripMarkdown(numbered[2]!));
      else if (lettered) right.set(lettered[1]!, stripMarkdown(lettered[2]!));
    }
  }
  const key = letterKey(corrige);
  const pairs = [...left.entries()]
    .map(([number, text]) => ({ left: text, right: right.get(key.get(number) ?? '') ?? '' }))
    .filter((pair) => pair.right);
  if (pairs.length < 2 || pairs.length !== left.size) return null;
  const unique = (values: string[]) => new Set(values.map((value) => value.toLowerCase())).size === values.length;
  if (!unique(pairs.map((pair) => pair.left))) return null;
  if (!unique(pairs.map((pair) => pair.right))) {
    // Même réponse pour deux éléments (ex. « l' ») : l'appariement un à un est impossible, on passe en QCM.
    const options = [...new Set(pairs.map((pair) => pair.right))];
    if (options.length < 2 || options.length > 6) return null;
    return { type: 'qcm', questions: pairs.map((pair) => ({ text: pair.left, options, correctIndex: options.indexOf(pair.right) })) };
  }
  return { type: 'appariement', pairs: pairs.slice(0, 15) };
}

export function parseQcmItems(body: string, corrige: string): ParsedQcmItem[] {
  const key = letterKey(corrige);
  const result: ParsedQcmItem[] = [];
  for (const [number, raw] of numberedItems(body.split('\n').filter((line) => !line.startsWith('|')).join('\n'))) {
    const parts = raw.replace(/\n/g, ' ').split(/\s+([a-f])\)\s+/);
    const text = stripMarkdown(parts[0]!);
    const letters: string[] = [];
    const options: string[] = [];
    for (let index = 1; index < parts.length; index += 2) {
      letters.push(parts[index]!);
      options.push(stripMarkdown(parts[index + 1]!));
    }
    const correctIndex = letters.indexOf(key.get(number) ?? '');
    if (!text || options.length < 2 || correctIndex < 0) continue;
    result.push({ text, options, correctIndex });
  }
  return result;
}

function parseGapFill(body: string, corrige: string): ExerciseInput | null {
  const lines = body.split('\n').map((line) => line.trim());
  const items = numberedItems(lines.filter((line) => /^\d+\./.test(line)).join('\n'));
  const gapLines: string[] = [];

  if (items.size > 0) {
    const answers = numberedItems(corrige);
    for (const [number, item] of items) {
      const blanks = item.match(BLANK)?.length ?? 0;
      const answer = answers.get(number);
      if (blanks === 0 || !answer) continue;
      let pieces = blanks === 1 ? [answer] : answer.split(/\s+(?:\/|…|\.\.\.)\s+/);
      // « ______ ______ » → « i libri » : un mot par trou.
      if (pieces.length !== blanks && answer.trim().split(/\s+/).length === blanks) pieces = answer.trim().split(/\s+/);
      if (pieces.length !== blanks) continue;
      let index = 0;
      const filled = item.replace(BLANK, () => {
        const accepted = acceptedAnswers(pieces[index++]!);
        return accepted.length ? `[[${accepted.join('|')}]]` : '______';
      });
      if (filled.includes('______')) continue;
      gapLines.push(`${number}. ${stripMarkdown(filled.replace(/^>\s*/, ''))}`);
    }
  } else {
    // Paragraphe à trous : les réponses sont les mots en gras du corrigé, dans l'ordre.
    const paragraph = lines.filter((line) => line.startsWith('>') && BLANK.test(line)).map((line) => line.replace(/^>\s*/, '')).join(' ');
    BLANK.lastIndex = 0;
    const answers = [...corrige.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1]!);
    const blanks = paragraph.match(BLANK)?.length ?? 0;
    if (!blanks || blanks !== answers.length) return null;
    let index = 0;
    gapLines.push(stripMarkdown(paragraph.replace(BLANK, () => `[[${acceptedAnswers(answers[index++]!).join('|')}]]`)));
  }

  return gapLines.length ? { type: 'texte_a_trous', text: gapLines.join('\n') } : null;
}

function parseExercises(code: string, content: string): { exercises: ParsedExercise[]; qcm: ParsedCourse['qcm'] } {
  const top = sections(content, 2);
  const statements = sections(top.find((section) => section.heading.startsWith('Exercices'))?.body ?? '', 3);
  const answers = sections(top.find((section) => section.heading.startsWith('Corrig'))?.body ?? '', 3);
  const exercises: ParsedExercise[] = [];
  const qcm: ParsedCourse['qcm'] = [];

  for (const statement of statements) {
    const number = /^Exercice (\d+)/.exec(statement.heading)?.[1];
    if (!number) continue;
    const corrige = answers.find((answer) => new RegExp(`^Exercice ${number}\\b`).test(answer.heading))?.body;
    if (!corrige) continue;
    const label = stripMarkdown(statement.heading.replace(/^Exercice \d+\s*[—–-]\s*/, ''));
    const title = `${code} · ${label}`.slice(0, 200);
    const instructions = introLines(statement.body);

    let input: ExerciseInput | null = null;
    if (/association/i.test(label)) {
      input = parseMatching(statement.body, corrige);
    } else if (/qcm/i.test(label)) {
      const items = parseQcmItems(statement.body, corrige);
      if (items.length) {
        input = { type: 'qcm', questions: items.slice(0, 30) };
        qcm.push(...items.map((item) => ({ ...item, context: `${code} — ${label}` })));
      }
    } else if (BLANK.test(statement.body)) {
      BLANK.lastIndex = 0;
      input = parseGapFill(statement.body, corrige);
    }
    BLANK.lastIndex = 0;
    if (!input) continue;
    // Vérifie le format exact attendu par le moteur d'exercices.
    compileExercise(input);
    exercises.push({ title, instructions: instructions ?? defaultInstructions(input.type), input });
  }
  return { exercises, qcm };
}

function defaultInstructions(type: ExerciseInput['type']): string {
  if (type === 'qcm') return 'Choisissez la bonne réponse.';
  if (type === 'appariement') return 'Associez chaque élément à sa correspondance.';
  return 'Complétez les trous.';
}

// ─────────────────────────────────────────────────────────────
// Cours
// ─────────────────────────────────────────────────────────────

function readMarkdown(relative: string) {
  return splitFrontmatter(readFileSync(join(CONTENT_DIR, relative), 'utf8'));
}

function moduleFiles(): string[] {
  return LEVELS.flatMap((level) =>
    readdirSync(join(CONTENT_DIR, 'niveaux', level))
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((file) => join('niveaux', level, file)),
  );
}

// [[A1-M03-nombres-dates-heures]] → « A1-M03 — Nombres, dates et heures » (en gras).
function linkResolver(titles: Map<string, string>) {
  return (body: string) =>
    body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug: string, alias?: string) => `**${alias ?? titles.get(slug) ?? slug}**`);
}

const withoutTitle = (content: string) => content.replace(/^\s*# .+\n/, '').trim();

function competences(content: string): string | null {
  return /\*\*Compétences :\*\*\s*(.+)/.exec(content)?.[1]?.trim() ?? null;
}

function sliceLevel(content: string, level: Level): string | null {
  const section = sections(content, 2).find((candidate) => candidate.heading.startsWith(level));
  return section ? section.body.trim() : null;
}

export function loadItalianCourse(): ParsedCourse[] {
  const files = moduleFiles();
  const titles = new Map<string, string>();
  for (const file of [...files, join('evaluations', 'evaluation-A1.md')]) {
    const { meta } = readMarkdown(file);
    const slug = file.split(/[\\/]/).pop()!.replace(/\.md$/, '');
    titles.set(slug, `${meta.code} — ${meta.titre}`);
  }
  const resolve = linkResolver(titles);
  const courses: ParsedCourse[] = [];

  for (const file of files) {
    const { meta, content } = readMarkdown(file);
    const code = meta.code!;
    const level = meta.niveau as Level;
    const isEvaluation = /évaluation/i.test(meta.type ?? '') || /evaluation/.test(file);
    const { exercises, qcm } = parseExercises(code, content);
    const duration = meta.duree ? `${meta.duree}` : null;
    courses.push({
      code,
      title: `${code} — ${meta.titre}`,
      description: [duration, competences(content)].filter(Boolean).join(' · ') || null,
      level,
      category: isEvaluation ? 'évaluation' : 'italien',
      body: resolve(withoutTitle(content)),
      // Les évaluations contiennent le corrigé réservé à l'enseignant : visibles du seul personnel.
      isPublished: !isEvaluation,
      exercises: isEvaluation ? [] : exercises,
      qcm: isEvaluation ? [] : qcm,
    });
  }

  {
    const { meta, content } = readMarkdown(join('evaluations', 'evaluation-A1.md'));
    courses.push({
      code: meta.code!,
      title: `${meta.code} — ${meta.titre}`,
      description: meta.duree ?? null,
      level: 'A1',
      category: 'évaluation',
      body: resolve(withoutTitle(content)),
      isPublished: false,
      exercises: [],
      qcm: [],
    });
  }

  // Ressources : vocabulaire et grammaire découpés par niveau, les autres en un seul cours.
  for (const [file, name] of [
    ['vocabulaire.md', 'Vocabulaire essentiel'],
    ['grammaire.md', 'Mémo de grammaire'],
  ] as const) {
    const { content } = readMarkdown(join('ressources', file));
    for (const level of LEVELS) {
      const body = sliceLevel(content, level);
      if (!body) continue;
      courses.push({
        code: `RES-${file.replace('.md', '').toUpperCase()}-${level}`,
        title: `Ressource — ${name} ${level}`,
        description: `${name} du niveau ${level}`,
        level,
        category: 'ressources',
        body: resolve(body),
        isPublished: true,
        exercises: [],
        qcm: [],
      });
    }
  }
  for (const [file, level] of [
    ['dialogues.md', 'A1'],
    ['situations-italie.md', 'A2'],
  ] as const) {
    const { meta, content } = readMarkdown(join('ressources', file));
    courses.push({
      code: `RES-${file.replace('.md', '').toUpperCase()}`,
      title: `Ressource — ${meta.titre}`,
      description: null,
      level,
      category: 'ressources',
      body: resolve(withoutTitle(content)),
      isPublished: true,
      exercises: [],
      qcm: [],
    });
  }
  return courses;
}

// Test de positionnement (40 QCM, 10 par niveau) de evaluations/evaluations.md.
export function loadPlacementTest(): { level: Level; text: string; options: string[]; correctIndex: number }[] {
  const { content } = readMarkdown(join('evaluations', 'evaluations.md'));
  const placement = sections(content, 2).find((section) => section.heading.includes('Test de positionnement'))?.body ?? '';
  const corrige = placement.split('\n').filter((line) => line.startsWith('>')).join('\n');
  const result: ReturnType<typeof loadPlacementTest> = [];
  for (const section of sections(placement, 3)) {
    const level = /^Section (A1|A2|B1|B2)/.exec(section.heading)?.[1] as Level | undefined;
    if (!level) continue;
    for (const item of parseQcmItems(section.body, corrige)) result.push({ level, ...item });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Import (migration 0003) — idempotent : un élément déjà présent (même titre / code / énoncé) est conservé
// tel quel, y compris s'il a été retouché depuis par l'équipe pédagogique.
// ─────────────────────────────────────────────────────────────

const QUESTIONS_PER_TEST = 20;
const DIFFICULTY: Record<Level, number> = { A1: 1, A2: 1, B1: 2, B2: 3 };
const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const questionCategory = (level: Level) => `italien-${level.toLowerCase()}`;

async function must<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function existing(table: string, column: string): Promise<Map<unknown, string>> {
  const rows = (await must(db.from(table).select(`id, ${column}`))) as Record<string, unknown>[];
  return new Map(rows.map((row) => [row[column], row.id as string]));
}

export async function importItalianCourse(log: (message: string) => void) {
  const courses = loadItalianCourse();
  const now = new Date().toISOString();

  const knownCourses = await existing('courses', 'title');
  const missingCourses = courses.filter((course) => !knownCourses.has(course.title));
  if (missingCourses.length) {
    const inserted = (await must(
      db
        .from('courses')
        .insert(
          missingCourses.map((course) => ({
            title: course.title,
            description: course.description,
            level: course.level,
            category: course.category,
            content_type: 'text',
            body: course.body,
            is_published: course.isPublished,
            published_at: course.isPublished ? now : null,
          })),
        )
        .select('id, title'),
    )) as { id: string; title: string }[];
    for (const row of inserted) knownCourses.set(row.title, row.id);
  }

  const knownExercises = await existing('exercises', 'title');
  const exercises = courses.flatMap((course) =>
    course.exercises
      .filter((exercise) => !knownExercises.has(exercise.title))
      .map((exercise) => {
        const compiled = compileExercise(exercise.input);
        return {
          course_id: knownCourses.get(course.title) ?? null,
          title: exercise.title,
          level: course.level,
          category: 'italien',
          exercise_type: compiled.exerciseType,
          instructions: exercise.instructions,
          content: compiled.content,
          solution: compiled.solution,
          is_published: true,
        };
      }),
  );
  if (exercises.length) await must(db.from('exercises').insert(exercises));

  const knownQuestions = await existing('questions', 'question_text');
  const questions = courses.flatMap((course) =>
    course.qcm.map((item) => ({
      category: questionCategory(course.level),
      difficulty: DIFFICULTY[course.level],
      question_text: item.text,
      options: item.options.map((text, index) => ({ key: OPTION_KEYS[index]!, text })),
      correct_answer: OPTION_KEYS[item.correctIndex]!,
      explanation: `Module ${item.context}`,
      source: 'manual',
      validation_status: 'active',
    })),
  );
  // Un même énoncé peut revenir d'un module à l'autre : une seule question par énoncé.
  const freshQuestions = [...new Map(questions.filter((question) => !knownQuestions.has(question.question_text)).map((q) => [q.question_text, q])).values()];
  if (freshQuestions.length) await must(db.from('questions').insert(freshQuestions));

  // Un modèle de test par niveau, tiré de la banque ci-dessus.
  const perLevel = new Map<Level, number>();
  for (const question of questions) {
    const level = question.category.slice(-2).toUpperCase() as Level;
    perLevel.set(level, (perLevel.get(level) ?? 0) + 1);
  }
  let templates = 0;
  for (const level of LEVELS) {
    const available = perLevel.get(level) ?? 0;
    if (available === 0) continue;
    const code = `ITALIEN-${level}`;
    const count = Math.min(QUESTIONS_PER_TEST, available);
    const found = (await must(db.from('test_templates').select('id').eq('code', code).maybeSingle())) as { id: string } | null;
    if (found) continue;
    const template = (await must(
      db
        .from('test_templates')
        .insert({
          code,
          name: `Italien ${level} — test du programme`,
          description: `${count} questions tirées au hasard parmi les QCM des modules ${level} du programme d'italien.`,
          total_duration_seconds: count * 60,
          is_active: true,
        })
        .select('id')
        .single(),
    )) as { id: string };
    await must(db.from('test_sections').insert({ template_id: template.id, name: `Italien ${level}`, category: questionCategory(level), question_count: count, order_index: 0 }));
    templates += 1;
  }

  // Test de positionnement : remplace les questions existantes (désactivées, jamais supprimées : historique des tentatives).
  const placement = loadPlacementTest();
  const knownPlacement = await existing('level_test_questions', 'question_text');
  const freshPlacement = placement.filter((item) => !knownPlacement.has(item.text));
  if (freshPlacement.length) {
    await must(db.from('level_test_questions').update({ is_active: false }).eq('is_active', true));
    const rows = (await must(db.from('level_test_questions').select('order_index'))) as { order_index: number }[];
    const start = Math.max(100, ...rows.map((row) => row.order_index)) + 1;
    await must(
      db.from('level_test_questions').insert(
        placement.map((item, index) => ({
          level: item.level,
          question_text: item.text,
          options: item.options.map((text, optionIndex) => ({ key: OPTION_KEYS[optionIndex]!, text })),
          correct_answer: OPTION_KEYS[item.correctIndex]!,
          order_index: start + index,
          is_active: true,
        })),
      ),
    );
  }

  log(
    `${missingCourses.length} cours, ${exercises.length} exercices, ${freshQuestions.length} questions, ${templates} modèles de test, ` +
      `${freshPlacement.length ? placement.length : 0} questions de positionnement ajoutés`,
  );
}
