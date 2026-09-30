// Parcours complet via l'API réelle sur les émulateurs Firebase (Auth, Firestore, Storage) :
// migrations, premier admin, comptes, classe, simulation, documents, tableaux de bord, suspension.
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetEmulators, signIn } from './emulator.js';

const { createApp } = await import('../../src/app.js');
const { runMigrations } = await import('../../src/migrations/index.js');
const { seedDemoContent } = await import('../../src/migrations/demo-content.js');
const { createAccount } = await import('../../src/services/accounts.js');

const app = createApp();
const NEW_PASSWORD = 'Nouveau2026secret';
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// Première connexion : mot de passe temporaire → changement obligatoire → reconnexion.
async function activate(email: string, temporaryPassword: string): Promise<string> {
  const first = await signIn(email, temporaryPassword);
  const blocked = await request(app).get('/api/notifications').set(bearer(first));
  expect(blocked.body.error.code).toBe('password_change_required');
  expect((await request(app).post('/api/me/password').set(bearer(first)).send({ password: NEW_PASSWORD })).status).toBe(204);
  // Firebase révoque les sessions antérieures au changement (granularité : la seconde) : on se reconnecte.
  return signIn(email, NEW_PASSWORD);
}

let adminToken: string;
let teacherToken: string;
let studentToken: string;
let studentId: string;
let teacherId: string;

beforeAll(async () => {
  await resetEmulators();
  await runMigrations(() => {});
  await seedDemoContent();
});

describe('parcours de bout en bout', () => {
  it('amorce le premier admin et active son compte', async () => {
    const { account, temporaryPassword } = await createAccount({ email: 'admin@salve.test', fullName: 'Admin Centre', role: 'admin' }, null);
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    adminToken = await activate('admin@salve.test', temporaryPassword);
    const me = await request(app).get('/api/me').set(bearer(adminToken));
    expect(me.body).toMatchObject({ role: 'admin', mustChangePassword: false, fullName: 'Admin Centre' });
  });

  it('crée un enseignant et un étudiant, refuse un email en double', async () => {
    const teacher = await request(app).post('/api/admin/users').set(bearer(adminToken)).send({ email: 'prof@salve.test', fullName: 'Prof Bianchi', role: 'teacher' });
    const student = await request(app).post('/api/admin/users').set(bearer(adminToken)).send({ email: 'etudiant@salve.test', fullName: 'Grâce Moukoko', role: 'student', level: 'A2' });
    expect(teacher.status).toBe(201);
    expect(student.status).toBe(201);
    teacherId = teacher.body.account.id;
    studentId = student.body.account.id;
    const duplicate = await request(app).post('/api/admin/users').set(bearer(adminToken)).send({ email: 'prof@salve.test', fullName: 'Autre', role: 'teacher' });
    expect(duplicate.status).toBe(409);

    teacherToken = await activate('prof@salve.test', teacher.body.temporaryPassword);
    studentToken = await activate('etudiant@salve.test', student.body.temporaryPassword);
    expect((await request(app).get('/api/admin/users').set(bearer(studentToken))).status).toBe(403);
  });

  it('constitue une classe et l’expose à l’étudiant', async () => {
    const klass = await request(app).post('/api/admin/classes').set(bearer(adminToken)).send({ name: 'A2 soir', teacherId });
    expect(klass.status).toBe(201);
    const classId = klass.body.id ?? klass.body.class?.id;
    expect((await request(app).post(`/api/admin/classes/${classId}/students`).set(bearer(adminToken)).send({ studentId })).status).toBe(204);
    const mine = await request(app).get('/api/classes').set(bearer(studentToken));
    expect(JSON.stringify(mine.body)).toContain('A2 soir');
  });

  it('déroule une simulation complète sans retour en arrière', async () => {
    const templates = await request(app).get('/api/test-templates').set(bearer(studentToken));
    const template = (templates.body.templates ?? templates.body).find((item: { code: string }) => item.code === 'CENTRE-DEMO');
    const started = await request(app).post('/api/simulations').set(bearer(studentToken)).send({ templateId: template.id, mode: 'examen' });
    expect(started.status).toBe(201);
    const simulationId = started.body.id;
    expect(started.body.question).not.toHaveProperty('correctAnswer');
    expect((await request(app).post('/api/simulations').set(bearer(studentToken)).send({ templateId: template.id, mode: 'examen' })).status).toBe(409);

    for (let position = 0; position < started.body.totalQuestions; position++) {
      const answered = await request(app).post(`/api/simulations/${simulationId}/answers`).set(bearer(studentToken)).send({ position, answer: 'C' });
      expect(answered.status).toBe(200);
    }
    const replay = await request(app).post(`/api/simulations/${simulationId}/answers`).set(bearer(studentToken)).send({ position: 0, answer: 'A' });
    expect(replay.status).toBe(409);

    const results = await request(app).get(`/api/simulations/${simulationId}/results`).set(bearer(studentToken));
    expect(results.status).toBe(200);
    expect(JSON.stringify(results.body)).toContain('correct');
  });

  it('dépose un document, le télécharge par URL signée et le signale à l’enseignant', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
    const uploaded = await request(app)
      .put('/api/student/documents/passeport/file')
      .set({ ...bearer(studentToken), 'Content-Type': 'application/pdf', 'X-File-Name': 'passeport.pdf' })
      .send(pdf);
    expect(uploaded.status).toBe(201);
    const document = JSON.stringify(uploaded.body).match(/"id":"([0-9a-f-]{36})","documentType":"passeport"/)?.[1];
    expect(document).toBeDefined();

    const link = await request(app).get(`/api/student/documents/${document}/file`).set(bearer(studentToken));
    expect(link.status).toBe(200);
    const file = await fetch(link.body.url);
    expect(Buffer.from(await file.arrayBuffer()).equals(pdf)).toBe(true);

    const overview = await request(app).get('/api/staff/documents/overview').set(bearer(teacherToken));
    expect(overview.body.toReviewCount).toBe(1);
    expect(overview.body.toReview[0]).toMatchObject({ studentName: 'Grâce Moukoko', documentType: 'Passeport' });
  });

  it('alimente les tableaux de bord enseignant et admin', async () => {
    const teacher = await request(app).get('/api/teacher/overview').set(bearer(teacherToken));
    expect(teacher.status).toBe(200);
    expect(teacher.body.classes).toEqual([expect.objectContaining({ name: 'A2 soir', studentCount: 1 })]);
    expect(teacher.body.students[0]).toMatchObject({ fullName: 'Grâce Moukoko', simulations30: 1, inactive: false });
    expect(teacher.body.toReview.some((item: { type: string }) => item.type === 'simulation')).toBe(true);

    const admin = await request(app).get('/api/admin/learning/dashboard').set(bearer(adminToken));
    expect(admin.status).toBe(200);
    expect(admin.body.students).toMatchObject({ total: 1, active7: 1 });
    expect(admin.body.simulations.completed30).toBe(1);
  });

  it('sert le site public et enregistre un prospect', async () => {
    const site = await request(app).get('/api/public/site');
    expect(site.status).toBe(200);
    expect(JSON.stringify(site.body)).toContain('Italien A1');
    expect((await request(app).get('/api/public/programs/italien-b1')).status).toBe(200);
    const contact = await request(app).post('/api/public/contact').send({ fullName: 'Prospect Test', email: 'prospect@salve.test', consent: true });
    expect(contact.status).toBe(201);
    const leads = await request(app).get('/api/admin/leads').set(bearer(adminToken));
    expect(JSON.stringify(leads.body)).toContain('Prospect Test');
  });

  it('suspend un compte : accès coupé immédiatement et connexion refusée', async () => {
    expect((await request(app).post(`/api/admin/users/${studentId}/suspend`).set(bearer(adminToken))).status).toBe(200);
    const denied = await request(app).get('/api/me').set(bearer(studentToken));
    expect([401, 403]).toContain(denied.status);
    await expect(signIn('etudiant@salve.test', NEW_PASSWORD)).rejects.toThrow(/USER_DISABLED/);

    expect((await request(app).post(`/api/admin/users/${studentId}/reactivate`).set(bearer(adminToken))).status).toBe(200);
    const again = await signIn('etudiant@salve.test', NEW_PASSWORD);
    expect((await request(app).get('/api/me').set(bearer(again))).status).toBe(200);
  });
});
