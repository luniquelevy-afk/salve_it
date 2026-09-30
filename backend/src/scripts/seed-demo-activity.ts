// Activité fictive sur 90 jours (étudiants, simulations, exercices, entretiens, prospects, coûts IA)
// pour visualiser les tableaux de bord en développement. Émulateurs uniquement : refusé si la
// base visée n'est pas un projet « demo-* ».
// Usage : pnpm --filter @salve/backend demo:activity   (après db:migrate, db:seed et demo:seed)
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { db } from '../lib/db/index.js';
import { firebaseAuth } from '../lib/firebase.js';

if (process.env.NODE_ENV === 'production' || !env.FIREBASE_PROJECT_ID.startsWith('demo-')) {
  console.error('Refus : l’activité fictive est réservée aux émulateurs (projet demo-*).');
  process.exit(1);
}

const DAY = 86_400_000;
const now = Date.now();
let seed = 42;
const random = () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)] as T;
const at = (daysAgo: number) => new Date(now - daysAgo * DAY - Math.floor(random() * 8) * 3_600_000).toISOString();

async function must<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const NAMES = ['Grâce Moukoko', 'Merveille Nkouka', 'Christ Loubaki', 'Divine Mabiala', 'Exaucé Bouanga', 'Prisca Ngoma', 'Jordy Massamba', 'Fiacre Tchicaya', 'Ornella Kimbembe', 'Rodrigue Samba', 'Chancelvie Ibara', 'Hervé Mpassi'];
const LEVELS = ['A1', 'A2', 'A2', 'B1', 'B1', 'B2'] as const;

const template = await must(db.from('test_templates').select('id, version').eq('code', 'CENTRE-DEMO').single());
const exercise = await must(db.from('exercises').select('id').limit(1).single());
await must(db.from('embassy_scenarios').select('code').eq('code', 'standard').single());

const students: string[] = [];
for (const [index, fullName] of NAMES.entries()) {
  const email = `etudiant${index + 1}.demo@salve.test`;
  let uid: string;
  try {
    uid = (await firebaseAuth.getUserByEmail(email)).uid;
  } catch {
    uid = (await firebaseAuth.createUser({ uid: randomUUID(), email, password: `Demo${randomUUID()}`, emailVerified: true })).uid;
  }
  await must(db.from('profiles').upsert({ id: uid, email, role: 'student', full_name: fullName, level: pick(LEVELS), must_change_password: false }, { onConflict: 'id', ignoreDuplicates: true }));
  students.push(uid);
}

// Engagement croissant sur la période, avec une progression de la réussite.
const simulations = [];
const attempts = [];
const sessions = [];
for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
  const intensity = 1 + (89 - daysAgo) / 45;
  for (const student of students) {
    if (random() < 0.12 * intensity) {
      const started = at(daysAgo);
      const skill = 0.45 + (89 - daysAgo) / 400 + random() * 0.2;
      const logica = Math.round(3 * Math.min(1, skill + random() * 0.15));
      const matematica = Math.round(3 * Math.min(1, skill - 0.05 + random() * 0.15));
      simulations.push({
        student_id: student,
        test_template_id: template.id,
        template_version: template.version,
        mode: pick(['entrainement', 'entrainement', 'examen', 'defi']),
        status: 'completed',
        started_at: started,
        deadline_at: new Date(Date.parse(started) + 20 * 60_000).toISOString(),
        completed_at: new Date(Date.parse(started) + 14 * 60_000).toISOString(),
        total_questions: 6,
        current_position: 6,
        score: logica + matematica - 0.25 * (6 - logica - matematica),
        score_by_section: {
          logica: { name: 'Logica', correct: logica, wrong: 3 - logica, blank: 0, total: 3, points: logica },
          matematica: { name: 'Matematica', correct: matematica, wrong: 3 - matematica, blank: 0, total: 3, points: matematica },
        },
      });
    }
    if (random() < 0.18 * intensity) {
      const score = Math.round(random() * 2);
      attempts.push({ exercise_id: exercise.id, student_id: student, answers: { q1: 'B', q2: score > 1 ? 'B' : 'A' }, score, max_score: 2, created_at: at(daysAgo) });
    }
    if (random() < 0.035 * intensity) {
      const started = at(daysAgo);
      const failed = random() < 0.08;
      const score = Math.round(48 + (89 - daysAgo) / 3 + random() * 20);
      sessions.push({
        student_id: student,
        visa_type: 'etudes',
        prompt_version: 'demo',
        model: 'fake',
        max_turns: 12,
        turn_count: 12,
        input_mode: random() < 0.6 ? 'text' : 'voice',
        status: failed ? 'failed' : 'completed',
        started_at: started,
        ended_at: new Date(Date.parse(started) + 18 * 60_000).toISOString(),
        completed_at: failed ? null : new Date(Date.parse(started) + 19 * 60_000).toISOString(),
        overall_score: failed ? null : Math.min(100, score),
        ai_report: failed ? null : { level: 'demo', summary: 'Rapport de démonstration.' },
      });
    }
  }
}

const leads = Array.from({ length: 46 }, (_, index) => {
  const daysAgo = Math.floor(random() * 90);
  return {
    full_name: `Prospect démo ${index + 1}`,
    email: `prospect${index + 1}@exemple.test`,
    source: pick(['contact_form', 'level_test']),
    status: pick(['nouveau', 'nouveau', 'contacte', 'test_realise', 'interesse', 'a_relancer', 'inscrit', 'non_interesse']),
    contact_consent: true,
    created_at: at(daysAgo),
  };
});

const usage = sessions.flatMap((session) =>
  session.status === 'completed'
    ? [
        { student_id: session.student_id, operation: 'embassy_turn', model: 'fake', estimated_cost: Number((0.02 + random() * 0.03).toFixed(4)), created_at: session.started_at },
        { student_id: session.student_id, operation: 'embassy_report', model: 'fake', estimated_cost: Number((0.01 + random() * 0.02).toFixed(4)), created_at: session.completed_at },
      ]
    : [],
);

for (const [table, rows] of [
  ['simulations', simulations],
  ['exercise_attempts', attempts],
  ['embassy_sessions', sessions],
  ['leads', leads],
  ['ai_usage_logs', usage],
] as const) {
  for (let index = 0; index < rows.length; index += 200) await must(db.from(table).insert(rows.slice(index, index + 200)));
}

console.log(`Activité fictive : ${students.length} étudiants, ${simulations.length} simulations, ${attempts.length} exercices, ${sessions.length} entretiens, ${leads.length} prospects.`);
process.exit(0);
