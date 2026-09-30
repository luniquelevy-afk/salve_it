import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  single: vi.fn(),
  listResult: { data: [] as unknown[], error: null as unknown },
}));

vi.mock('../src/lib/db/index.js', () => {
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'insert', 'update']) builder[method] = () => builder;
  builder.single = () => mocks.single();
  builder.maybeSingle = () => mocks.single();
  builder.then = (resolve: (value: unknown) => void) => resolve(mocks.listResult);
  return { db: { from: () => builder } };
});

vi.mock('../src/lib/firebase.js', () => ({
  firebaseAuth: { verifyIdToken: mocks.verifyIdToken },
  firestore: {},
  storageBucket: () => ({}),
  usingEmulators: false,
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

// Jeton factice : { aal } se traduit comme Firebase Auth le ferait (claim sign_in_second_factor).
function claimsOf(token: string) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { aal?: string };
  return { uid: '00000000-0000-4000-8000-000000000001', firebase: payload.aal === 'aal2' ? { sign_in_second_factor: 'totp' } : {} };
}

function signedInAs(profile: { role: string; status?: string; must_change_password?: boolean }) {
  mocks.verifyIdToken.mockImplementation(async (token: string) => claimsOf(token));
  mocks.single.mockResolvedValue({
    data: { status: 'active', must_change_password: false, ...profile },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('API — contrôle d’accès', () => {
  it('expose un healthcheck public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('refuse une requête sans jeton', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('refuse un jeton invalide', async () => {
    mocks.verifyIdToken.mockRejectedValue(Object.assign(new Error('bad jwt'), { code: 'auth/argument-error' }));
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });

  it('bloque immédiatement un compte suspendu (EF-03)', async () => {
    signedInAs({ role: 'student', status: 'suspended' });
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('account_suspended');
  });

  it('interdit le back-office admin à un étudiant', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('interdit le back-office admin à un enseignant', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
  });

  it('exige le changement du mot de passe temporaire avant tout accès métier (EF-02)', async () => {
    signedInAs({ role: 'admin', must_change_password: true });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal2' })}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('password_change_required');
  });

  it('exige la MFA pour un admin', async () => {
    signedInAs({ role: 'admin' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('mfa_required');
  });

  it('autorise un admin avec MFA', async () => {
    signedInAs({ role: 'admin' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal2' })}`);
    expect(res.status).toBe(200);
    expect(res.body.accounts).toEqual([]);
  });

  it('valide les données de création de compte', async () => {
    signedInAs({ role: 'admin' });
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal2' })}`)
      .send({ email: 'pas-un-email', fullName: 'X', role: 'superadmin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_input');
  });

  it('réserve les simulations aux étudiants', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app)
      .post('/api/simulations')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ templateId: '00000000-0000-4000-8000-000000000002' });
    expect(res.status).toBe(403);
  });

  it('interdit la banque de questions (et donc les bonnes réponses) à un étudiant', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app).get('/api/questions').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
  });

  it('refuse une question dont la bonne réponse ne fait pas partie des options', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app)
      .post('/api/questions')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({
        category: 'logica',
        difficulty: 1,
        questionText: 'Domanda ?',
        options: [{ key: 'A', text: 'uno' }, { key: 'B', text: 'due' }],
        correctAnswer: 'E',
      });
    expect(res.status).toBe(400);
  });

  it('réserve l’agent ambassade aux étudiants', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app)
      .post('/api/embassy/sessions')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ visaType: 'etudes' });
    expect(res.status).toBe(403);
  });

  it('répond 503 sans appeler l’IA quand aucune clé n’est configurée', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .post('/api/embassy/sessions')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ visaType: 'etudes', inputMode: 'text' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ai_unavailable');
  });

  it('valide le type de visa', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .post('/api/embassy/sessions')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ visaType: 'diplomatique' });
    expect(res.status).toBe(400);
  });

  it('réserve la création de cours aux enseignants et admins', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .post('/api/manage/courses')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ title: 'x', level: 'A1', category: 'x', contentType: 'text', body: 'x' });
    expect(res.status).toBe(403);
  });

  it('refuse un cours avec un lien non https', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app)
      .post('/api/manage/courses')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ title: 'Vidéo', level: 'A1', category: 'oral', contentType: 'video', contentUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('réserve la gestion des classes à l’admin', async () => {
    signedInAs({ role: 'teacher' });
    const res = await request(app).post('/api/admin/classes').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`).send({ name: 'B1 soir' });
    expect(res.status).toBe(403);
  });

  it('exige un consentement pour laisser ses coordonnées au test de niveau', async () => {
    const res = await request(app)
      .post('/api/public/level-test')
      .send({ answers: {}, contact: { consent: false, fullName: 'Jean', phone: '060000000' } });
    expect(res.status).toBe(400);
  });

  it('formulaire de contact : consentement et moyen de contact obligatoires', async () => {
    const noConsent = await request(app).post('/api/public/contact').send({ fullName: 'Jean Test', phone: '+242 06 000 00 00', consent: false });
    const noReach = await request(app).post('/api/public/contact').send({ fullName: 'Jean Test', consent: true });
    expect(noConsent.status).toBe(400);
    expect(noReach.status).toBe(400);
  });

  it('formulaire de contact : un robot (champ piège rempli) reçoit un faux succès', async () => {
    const res = await request(app)
      .post('/api/public/contact')
      .send({ fullName: 'Spam Bot', email: 'bot@example.com', consent: true, website: 'https://spam.example' });
    expect(res.status).toBe(201);
  });

  it('réserve l’édition du site et les prospects à l’admin', async () => {
    signedInAs({ role: 'teacher' });
    const settings = await request(app).get('/api/admin/site-content/settings').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    const leads = await request(app).get('/api/admin/leads').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(settings.status).toBe(403);
    expect(leads.status).toBe(403);
  });

  it('exige un modèle de test sauf en mode révision', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app).post('/api/simulations').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`).send({ mode: 'defi' });
    expect(res.status).toBe(400);
  });

  it('réserve le suivi des étudiants aux enseignants et admins', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .get('/api/teacher/students/00000000-0000-4000-8000-000000000009')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.status).toBe(403);
  });

  it('réserve le tableau de bord et les modèles de test à l’admin', async () => {
    signedInAs({ role: 'teacher' });
    const dashboard = await request(app).get('/api/admin/learning/dashboard').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    const templates = await request(app).get('/api/admin/learning/test-templates').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(dashboard.status).toBe(403);
    expect(templates.status).toBe(403);
  });

  it('refuse un montant de budget exact dans le profil (fourchettes uniquement)', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .put('/api/student/profile')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ budgetRange: '742 euros', diplomas: [], preferredCities: [] });
    expect(res.status).toBe(400);
  });

  it('documents : dépôt réservé à l’étudiant, vérification réservée à l’équipe', async () => {
    signedInAs({ role: 'teacher' });
    const upload = await request(app)
      .put('/api/student/documents/passeport/file')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.7'));
    expect(upload.status).toBe(403);

    signedInAs({ role: 'student' });
    const review = await request(app)
      .post('/api/staff/documents/00000000-0000-4000-8000-000000000001/review')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ action: 'validate', version: 1 });
    expect(review.status).toBe(403);
  });

  it('documents : réponses jamais mises en cache', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .get('/api/student/documents/not-a-uuid/file')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('documents : fichier de plus de 10 Mo refusé avant tout traitement', async () => {
    signedInAs({ role: 'student' });
    const res = await request(app)
      .put('/api/student/documents/passeport/file')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(10 * 1024 * 1024 + 1));
    expect(res.status).toBe(413);
  });

  it('checklist : référentiel réservé à l’admin, date de vérification jamais future', async () => {
    signedInAs({ role: 'teacher' });
    const teacherRes = await request(app).get('/api/admin/checklist').set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`);
    expect(teacherRes.status).toBe(403);
    signedInAs({ role: 'admin' });
    const future = await request(app)
      .post('/api/admin/checklist/00000000-0000-4000-8000-000000000001/verify')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal2' })}`)
      .send({ verifiedOn: '2999-01-01' });
    expect(future.status).toBe(400);
  });

  it('limitation de débit : réponse 429 au format JSON de l’API', async () => {
    let last: request.Response | undefined;
    for (let i = 0; i < 11; i += 1) {
      last = await request(app).post('/api/public/level-test').send({ answers: {} });
    }
    expect(last?.status).toBe(429);
    expect(last?.body).toEqual({ error: { code: 'rate_limited', message: expect.any(String) } });
  });

  it('refuse un mot de passe trop faible', async () => {
    signedInAs({ role: 'student', must_change_password: true });
    const res = await request(app)
      .post('/api/me/password')
      .set('Authorization', `Bearer ${fakeJwt({ aal: 'aal1' })}`)
      .send({ password: 'court' });
    expect(res.status).toBe(400);
  });
});
