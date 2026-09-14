// Critère d'acceptation Phase 1 : « un étudiant ne peut accéder à aucune donnée d'un autre étudiant ».
// Nécessite une instance Supabase avec les migrations appliquées :
//   RLS_TEST=1 pnpm --filter @salve/backend test
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

describe.skipIf(process.env.RLS_TEST !== '1')('RLS — cloisonnement des données', () => {
  const admin = createClient(url, serviceKey, clientOptions);
  const password = `Rls-${randomUUID()}`;
  const createdUserIds: string[] = [];
  let classId: string | undefined;
  let simulationB: string;

  type TestUser = { id: string; email: string };
  let studentA: TestUser;
  let studentB: TestUser;
  let teacher: TestUser;
  let otherTeacher: TestUser;

  async function makeUser(role: 'student' | 'teacher', fullName: string): Promise<TestUser> {
    const email = `rls-${role}-${randomUUID()}@test.local`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    createdUserIds.push(data.user.id);
    const { error: profileError } = await admin.from('profiles').insert({
      id: data.user.id,
      email,
      role,
      full_name: fullName,
      level: role === 'student' ? 'A1' : null,
      must_change_password: false,
    });
    if (profileError) throw profileError;
    return { id: data.user.id, email };
  }

  async function clientFor(user: TestUser): Promise<SupabaseClient> {
    const client = createClient(url, anonKey, clientOptions);
    const { error } = await client.auth.signInWithPassword({ email: user.email, password });
    if (error) throw error;
    return client;
  }

  async function visibleProfileIds(client: SupabaseClient): Promise<string[]> {
    const { data, error } = await client.from('profiles').select('id');
    expect(error).toBeNull();
    return (data ?? []).map((row) => row.id as string).sort();
  }

  beforeAll(async () => {
    studentA = await makeUser('student', 'Étudiant A');
    studentB = await makeUser('student', 'Étudiant B');
    teacher = await makeUser('teacher', 'Enseignant titulaire');
    otherTeacher = await makeUser('teacher', 'Autre enseignant');

    const { data, error } = await admin.from('classes').insert({ name: 'Classe RLS', teacher_id: teacher.id }).select('id').single();
    if (error) throw error;
    classId = data.id as string;
    const { error: memberError } = await admin.from('class_students').insert({ class_id: classId, student_id: studentA.id });
    if (memberError) throw memberError;

    // Simulation en cours de l'étudiant B (hors de la classe de l'enseignant), avec une réponse déjà donnée.
    const { data: template, error: templateError } = await admin.from('test_templates').select('id, version').eq('code', 'CENTRE-DEMO').single();
    if (templateError) throw templateError;
    const { data: question, error: questionError } = await admin.from('questions').select('id').eq('validation_status', 'active').limit(1).single();
    if (questionError) throw questionError;
    const { data: simulation, error: simulationError } = await admin
      .from('simulations')
      .insert({
        student_id: studentB.id,
        test_template_id: template.id,
        template_version: template.version,
        deadline_at: new Date(Date.now() + 3_600_000).toISOString(),
        total_questions: 1,
      })
      .select('id')
      .single();
    if (simulationError) throw simulationError;
    simulationB = simulation.id as string;
    const { error: drawError } = await admin.from('simulation_questions').insert({ simulation_id: simulationB, position: 0, question_id: question.id });
    if (drawError) throw drawError;
    const { error: answerError } = await admin
      .from('simulation_answers')
      .insert({ simulation_id: simulationB, position: 0, question_id: question.id, answer_given: 'A', is_correct: true });
    if (answerError) throw answerError;
  });

  afterAll(async () => {
    if (classId) await admin.from('classes').delete().eq('id', classId);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  it("l'inscription publique est refusée, la connexion d'un compte créé par l'admin fonctionne (EF-01)", async () => {
    const anon = createClient(url, anonKey, clientOptions);
    const { error } = await anon.auth.signUp({ email: `rls-signup-${randomUUID()}@test.local`, password });
    expect(error).not.toBeNull();
    await expect(clientFor(studentA)).resolves.toBeDefined();
  });

  it('le rôle anon ne lit aucune donnée', async () => {
    const anon = createClient(url, anonKey, clientOptions);
    const { data } = await anon.from('profiles').select('id');
    expect(data ?? []).toEqual([]);
  });

  it('un étudiant ne voit que son propre profil', async () => {
    const client = await clientFor(studentA);
    expect(await visibleProfileIds(client)).toEqual([studentA.id]);
  });

  it("un étudiant ne peut pas lire un autre étudiant, même en ciblant son id", async () => {
    const client = await clientFor(studentA);
    const { data } = await client.from('profiles').select('id, email').eq('id', studentB.id);
    expect(data ?? []).toEqual([]);
  });

  it('un étudiant ne peut pas modifier son rôle', async () => {
    const client = await clientFor(studentA);
    await client.from('profiles').update({ role: 'admin' }).eq('id', studentA.id);
    const { data } = await admin.from('profiles').select('role').eq('id', studentA.id).single();
    expect(data?.role).toBe('student');
  });

  it('un enseignant ne voit que les étudiants de ses classes', async () => {
    const client = await clientFor(teacher);
    expect(await visibleProfileIds(client)).toEqual([studentA.id, teacher.id].sort());
  });

  it("un enseignant sans classe ne voit aucun étudiant", async () => {
    const client = await clientFor(otherTeacher);
    expect(await visibleProfileIds(client)).toEqual([otherTeacher.id]);
  });

  it('un étudiant ne voit pas la composition des classes des autres', async () => {
    const client = await clientFor(studentB);
    const { data } = await client.from('class_students').select('student_id');
    expect(data ?? []).toEqual([]);
  });

  // ── Moteur de test (Phase 2) ──────────────────────────────
  it('un étudiant ne peut jamais lire la banque de questions ni les bonnes réponses', async () => {
    const client = await clientFor(studentA);
    const { data } = await client.from('questions').select('id, correct_answer');
    expect(data ?? []).toEqual([]);
  });

  it('un enseignant lit la banque de questions', async () => {
    const client = await clientFor(teacher);
    const { data, error } = await client.from('questions').select('id').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("un étudiant ne voit pas les simulations d'un autre étudiant", async () => {
    const client = await clientFor(studentA);
    const { data } = await client.from('simulations').select('id').eq('id', simulationB);
    expect(data ?? []).toEqual([]);
  });

  it('pendant une simulation en cours, la correction de ses propres réponses reste masquée', async () => {
    const client = await clientFor(studentB);
    const { data: simulations } = await client.from('simulations').select('id');
    expect((simulations ?? []).map((row) => row.id)).toEqual([simulationB]);
    const { data: answers } = await client.from('simulation_answers').select('is_correct').eq('simulation_id', simulationB);
    expect(answers ?? []).toEqual([]);
  });

  it("un étudiant ne peut pas écrire directement ses réponses ni son score", async () => {
    const client = await clientFor(studentB);
    const { error } = await client.from('simulations').update({ score: 999 }).eq('id', simulationB);
    expect(error).not.toBeNull();
    const { data } = await admin.from('simulations').select('score').eq('id', simulationB).single();
    expect(data?.score).toBeNull();
  });

  it("un enseignant ne voit pas les simulations d'un étudiant hors de ses classes", async () => {
    const client = await clientFor(teacher);
    const { data } = await client.from('simulations').select('id').eq('id', simulationB);
    expect(data ?? []).toEqual([]);
  });

  // ── Agent ambassade (Phase 3) ─────────────────────────────
  it("les transcripts d'entretien sont cloisonnés (ENF-02)", async () => {
    const { data: session, error } = await admin
      .from('embassy_sessions')
      .insert({ student_id: studentB.id, visa_type: 'etudes', prompt_version: 'test', model: 'test', max_turns: 5 })
      .select('id')
      .single();
    if (error) throw error;
    const { error: messageError } = await admin
      .from('embassy_messages')
      .insert({ session_id: session.id, speaker: 'student', sequence_number: 1, text_content: 'Mon garant est mon oncle.' });
    if (messageError) throw messageError;

    const owner = await clientFor(studentB);
    const { data: own } = await owner.from('embassy_messages').select('text_content').eq('session_id', session.id);
    expect(own).toHaveLength(1);

    for (const other of [studentA, teacher]) {
      const client = await clientFor(other);
      const { data: sessions } = await client.from('embassy_sessions').select('id').eq('id', session.id);
      const { data: messages } = await client.from('embassy_messages').select('id').eq('session_id', session.id);
      expect(sessions ?? []).toEqual([]);
      expect(messages ?? []).toEqual([]);
    }

    const { error: deleteError } = await owner.from('embassy_sessions').delete().eq('id', session.id);
    expect(deleteError).not.toBeNull();
  });

  it("le journal d'usage IA n'est lisible par aucun étudiant ni enseignant", async () => {
    await admin.from('ai_usage_logs').insert({ student_id: studentB.id, operation: 'embassy_turn', model: 'test', estimated_cost: 0.01 });
    for (const user of [studentB, teacher]) {
      const client = await clientFor(user);
      const { data } = await client.from('ai_usage_logs').select('id');
      expect(data ?? []).toEqual([]);
    }
  });

  // ── Contenu pédagogique (Phase 4) ─────────────────────────
  it("un étudiant ne lit jamais les exercices directement (colonne solution)", async () => {
    const client = await clientFor(studentA);
    const { data } = await client.from('exercises').select('id, solution');
    expect(data ?? []).toEqual([]);
    const staff = await clientFor(teacher);
    const { data: staffData, error } = await staff.from('exercises').select('id').limit(1);
    expect(error).toBeNull();
    expect(staffData).toHaveLength(1);
  });

  it('cours : brouillons et cours réservés à une autre classe invisibles pour un étudiant', async () => {
    const { data: courses, error } = await admin
      .from('courses')
      .insert([
        { title: 'RLS brouillon', level: 'A1', category: 'rls', content_type: 'text', body: 'x', is_published: false },
        { title: 'RLS classe', level: 'A1', category: 'rls', content_type: 'text', body: 'x', is_published: true, class_id: classId },
      ])
      .select('id, title');
    if (error) throw error;
    try {
      const member = await clientFor(studentA);
      const outsider = await clientFor(studentB);
      const titles = async (client: SupabaseClient) =>
        ((await client.from('courses').select('title').eq('category', 'rls')).data ?? []).map((row) => row.title as string);
      expect(await titles(member)).toEqual(['RLS classe']);
      expect(await titles(outsider)).toEqual([]);
    } finally {
      await admin.from('courses').delete().in('id', courses.map((course) => course.id as string));
    }
  });

  it('les prospects du test de niveau ne sont lisibles ni par un étudiant ni par un enseignant', async () => {
    const { data: attempt, error } = await admin
      .from('level_test_attempts')
      .insert({ answers: {}, score: 1, total: 12, contact_consent: true, full_name: 'Prospect RLS', phone: '+242000' })
      .select('id')
      .single();
    if (error) throw error;
    try {
      for (const user of [studentA, teacher]) {
        const client = await clientFor(user);
        const { data } = await client.from('level_test_attempts').select('full_name');
        expect(data ?? []).toEqual([]);
      }
      const anon = createClient(url, anonKey, clientOptions);
      const { data: anonQuestions } = await anon.from('level_test_questions').select('correct_answer');
      expect(anonQuestions ?? []).toEqual([]);
    } finally {
      await admin.from('level_test_attempts').delete().eq('id', attempt.id);
    }
  });

  it("le calendrier d'une classe n'est visible que par ses membres et son enseignant", async () => {
    const startsAt = new Date(Date.now() + 86_400_000);
    const { data: session, error } = await admin
      .from('class_sessions')
      .insert({ class_id: classId, title: 'RLS séance', starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString() })
      .select('id')
      .single();
    if (error) throw error;
    const visible = async (user: TestUser) => ((await (await clientFor(user)).from('class_sessions').select('id').eq('id', session.id)).data ?? []).length;
    expect(await visible(studentA)).toBe(1);
    expect(await visible(teacher)).toBe(1);
    expect(await visible(studentB)).toBe(0);
    expect(await visible(otherTeacher)).toBe(0);
  });

  // ── Site vitrine (Phase 5) ────────────────────────────────
  it('les prospects et le contenu d’administration du site ne sont lisibles ni par anon, ni par un étudiant, ni par un enseignant', async () => {
    const { data: lead, error } = await admin
      .from('leads')
      .insert({ full_name: 'Prospect RLS', phone: '+242000', source: 'contact_form', contact_consent: true })
      .select('id')
      .single();
    if (error) throw error;
    try {
      const anon = createClient(url, anonKey, clientOptions);
      const clients = [anon, await clientFor(studentA), await clientFor(teacher)];
      for (const client of clients) {
        for (const table of ['leads', 'site_settings', 'testimonials', 'faq_items', 'gallery_images']) {
          const { data } = await client.from(table).select('*');
          expect(data ?? [], table).toEqual([]);
        }
      }
    } finally {
      await admin.from('leads').delete().eq('id', lead.id);
    }
  });

  it('un témoignage ne peut pas être publié sans consentement, même en base', async () => {
    const { error } = await admin.from('testimonials').insert({ author_name: 'Sans accord', quote: 'Test', is_published: true, consent_confirmed: false });
    expect(error?.code).toBe('23514');
  });

  // ── V1.1 : profil, statistiques, feedback, agrégats ──────
  it('profil étudiant et statistiques : l’étudiant et l’enseignant de sa classe seulement', async () => {
    const { data: question } = await admin.from('questions').select('id').eq('validation_status', 'active').limit(1).single();
    await admin.from('student_profiles').insert({ student_id: studentA.id, study_objective: 'licence', budget_range: '500_800' });
    await admin.from('student_question_stats').insert({ student_id: studentA.id, question_id: question!.id, attempts_count: 1, correct_count: 0 });

    const read = async (user: TestUser, table: string) => ((await (await clientFor(user)).from(table).select('student_id').eq('student_id', studentA.id)).data ?? []).length;
    for (const table of ['student_profiles', 'student_question_stats']) {
      expect(await read(studentA, table), `${table} / propriétaire`).toBe(1);
      expect(await read(teacher, table), `${table} / enseignant de la classe`).toBe(1);
      expect(await read(studentB, table), `${table} / autre étudiant`).toBe(0);
      expect(await read(otherTeacher, table), `${table} / autre enseignant`).toBe(0);
    }
  });

  it("le feedback enseignant n'est jamais visible par l'étudiant concerné", async () => {
    const { error } = await admin
      .from('teacher_feedback')
      .insert({ student_id: studentA.id, target_type: 'simulation', target_id: randomUUID(), teacher_id: teacher.id, comment: 'Revoir la logique.' });
    if (error) throw error;
    const read = async (user: TestUser) => ((await (await clientFor(user)).from('teacher_feedback').select('id').eq('student_id', studentA.id)).data ?? []).length;
    expect(await read(studentA)).toBe(0);
    expect(await read(otherTeacher)).toBe(0);
    expect(await read(teacher)).toBe(1);
  });

  it('agrégats de tableau de bord et statistiques globales : réservés au backend', async () => {
    const client = await clientFor(teacher);
    const anon = createClient(url, anonKey, clientOptions);
    for (const caller of [client, anon]) {
      expect((await caller.rpc('admin_overview')).error).not.toBeNull();
      expect((await caller.rpc('teacher_overview', { p_teacher_id: null })).error).not.toBeNull();
      expect((await caller.from('question_success_stats').select('question_id')).error).not.toBeNull();
    }
    const { data, error } = await admin.rpc('teacher_overview', { p_teacher_id: teacher.id });
    expect(error).toBeNull();
    expect((data as { students: { id: string }[] }).students.map((student) => student.id)).toEqual([studentA.id]);
  });

  // ── V1.2 : documents, notifications, emails, CRM, stockage ─
  it('documents : étudiant concerné et enseignant de sa classe uniquement ; fichiers inaccessibles hors backend', async () => {
    const storagePath = `${studentA.id}/passeport/${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage.from('student-documents').upload(storagePath, Buffer.from('%PDF-1.4 test RLS'), { contentType: 'application/pdf' });
    if (uploadError) throw uploadError;
    const { data: document, error } = await admin
      .from('student_documents')
      .insert({ student_id: studentA.id, document_type: 'passeport', storage_path: storagePath, file_name: 'passeport.pdf', mime_type: 'application/pdf', size_bytes: 17 })
      .select('id')
      .single();
    if (error) throw error;

    try {
      const visible = async (user: TestUser) => ((await (await clientFor(user)).from('student_documents').select('id').eq('id', document.id)).data ?? []).length;
      expect(await visible(studentA)).toBe(1);
      expect(await visible(teacher)).toBe(1);
      expect(await visible(studentB)).toBe(0);
      expect(await visible(otherTeacher)).toBe(0);

      // Bucket privé sans policy : même le propriétaire ne télécharge que via une URL signée émise par le backend.
      for (const client of [await clientFor(studentA), await clientFor(teacher), createClient(url, anonKey, clientOptions)]) {
        const { data, error: downloadError } = await client.storage.from('student-documents').download(storagePath);
        expect(data).toBeNull();
        expect(downloadError).not.toBeNull();
      }
      const owner = await clientFor(studentA);
      const { error: writeError } = await owner.storage.from('student-documents').upload(`${studentA.id}/passeport/intrus.pdf`, Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' });
      expect(writeError).not.toBeNull();
    } finally {
      await admin.storage.from('student-documents').remove([storagePath]);
      await admin.from('student_documents').delete().eq('id', document.id);
    }
  });

  it('notifications : chacun ne lit que les siennes ; file d’emails et interactions CRM invisibles', async () => {
    const { data: notification, error } = await admin
      .from('notifications')
      .insert({ user_id: studentA.id, type: 'document_validated', title: 'Test RLS' })
      .select('id')
      .single();
    if (error) throw error;
    await admin.from('email_outbox').insert({ notification_id: notification.id, to_email: studentA.email, subject: 'Test', body_text: 'Test' });
    const { data: lead } = await admin.from('leads').insert({ full_name: 'Prospect RLS V12', phone: '+242', source: 'contact_form', contact_consent: true }).select('id').single();
    await admin.from('lead_interactions').insert({ lead_id: lead!.id, kind: 'note', summary: 'Note RLS' });

    try {
      const own = await clientFor(studentA);
      expect(((await own.from('notifications').select('id')).data ?? []).length).toBe(1);
      for (const user of [studentB, teacher]) {
        const client = await clientFor(user);
        expect((await client.from('notifications').select('id').eq('id', notification.id)).data ?? []).toEqual([]);
      }
      for (const user of [studentA, teacher]) {
        const client = await clientFor(user);
        expect((await client.from('email_outbox').select('id')).data ?? []).toEqual([]);
        expect((await client.from('lead_interactions').select('id')).data ?? []).toEqual([]);
      }
    } finally {
      await admin.from('notifications').delete().eq('id', notification.id);
      await admin.from('leads').delete().eq('id', lead!.id);
    }
  });

  // ── §13 : présence et devoirs ─────────────────────────────
  it('présence et devoirs : étudiant concerné et enseignant de la classe uniquement ; aucune écriture directe', async () => {
    const startsAt = new Date(Date.now() - 3_600_000);
    const { data: session, error } = await admin
      .from('class_sessions')
      .insert({ class_id: classId, title: 'RLS présence', starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString() })
      .select('id')
      .single();
    if (error) throw error;
    const { error: attendanceError } = await admin.from('class_attendance').insert({ session_id: session.id, student_id: studentA.id, status: 'absent' });
    if (attendanceError) throw attendanceError;
    const { data: homework, error: homeworkError } = await admin
      .from('homework_assignments')
      .insert({ class_id: classId, title: 'RLS devoir', due_at: new Date(Date.now() + 86_400_000).toISOString() })
      .select('id')
      .single();
    if (homeworkError) throw homeworkError;
    const { error: submissionError } = await admin.from('homework_submissions').insert({ assignment_id: homework.id, student_id: studentA.id, answer: 'Ma réponse' });
    if (submissionError) throw submissionError;

    const count = async (user: TestUser, table: string, column: string, value: string) =>
      ((await (await clientFor(user)).from(table).select(column).eq(column, value)).data ?? []).length;
    const cases: [string, string, string][] = [
      ['class_attendance', 'session_id', session.id as string],
      ['homework_assignments', 'id', homework.id as string],
      ['homework_submissions', 'assignment_id', homework.id as string],
    ];
    for (const [table, column, value] of cases) {
      expect(await count(studentA, table, column, value), `${table} / étudiant de la classe`).toBe(1);
      expect(await count(teacher, table, column, value), `${table} / enseignant de la classe`).toBe(1);
      expect(await count(studentB, table, column, value), `${table} / étudiant hors classe`).toBe(0);
      expect(await count(otherTeacher, table, column, value), `${table} / autre enseignant`).toBe(0);
    }

    // Un étudiant ne peut ni valider son devoir ni corriger sa présence lui-même.
    const owner = await clientFor(studentA);
    await owner.from('homework_submissions').update({ status: 'valide' }).eq('assignment_id', homework.id);
    await owner.from('class_attendance').update({ status: 'present' }).eq('session_id', session.id);
    const { data: submission } = await admin.from('homework_submissions').select('status').eq('assignment_id', homework.id).single();
    const { data: attendance } = await admin.from('class_attendance').select('status').eq('session_id', session.id).single();
    expect(submission?.status).toBe('rendu');
    expect(attendance?.status).toBe('absent');

    // Une reprise sans commentaire est refusée par la base.
    const { error: reworkError } = await admin.from('homework_submissions').update({ status: 'a_reprendre' }).eq('assignment_id', homework.id);
    expect(reworkError?.code).toBe('23514');
  });

  it("un compte suspendu perd l'accès immédiatement, même avec une session ouverte", async () => {
    const client = await clientFor(studentB);
    expect(await visibleProfileIds(client)).toEqual([studentB.id]);
    await admin.from('profiles').update({ status: 'suspended' }).eq('id', studentB.id);
    expect(await visibleProfileIds(client)).toEqual([]);
  });

  it("le journal d'audit n'est pas lisible par un admin sans MFA", async () => {
    const client = await clientFor(teacher);
    const { data } = await client.from('audit_logs').select('id');
    expect(data ?? []).toEqual([]);
  });
});
