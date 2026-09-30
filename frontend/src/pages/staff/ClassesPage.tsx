import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/auth-context';
import { ClassAttendancePanel, ClassHomeworkPanel } from '../../components/ClassWorkPanels';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { CEFR_LEVELS, type Account, type CefrLevel, type ClassDetail, type ClassSummary, type Program } from '../../lib/types';
import { useScrollToHash } from '../../hooks/useScrollToHash';

export function ClassesPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  useScrollToHash(classes !== null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Account[]>([]);
  const [students, setStudents] = useState<Account[]>([]);
  const [classForm, setClassForm] = useState({ name: '', programId: '', teacherId: '' });
  const [programForm, setProgramForm] = useState<{ name: string; level: CefrLevel | '' }>({ name: '', level: '' });
  const [studentToAdd, setStudentToAdd] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadClasses = useCallback(async () => {
    try {
      setClasses((await api<{ classes: ClassSummary[] }>('/api/classes')).classes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger les classes.');
    }
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const [programsResponse, teachersResponse, studentsResponse] = await Promise.all([
      api<{ programs: Program[] }>('/api/admin/programs'),
      api<{ accounts: Account[] }>('/api/admin/users?role=teacher'),
      api<{ accounts: Account[] }>('/api/admin/users?role=student'),
    ]);
    setPrograms(programsResponse.programs);
    setTeachers(teachersResponse.accounts.filter((account) => account.status === 'active'));
    setStudents(studentsResponse.accounts.filter((account) => account.status === 'active'));
  }, [isAdmin]);

  const loadDetail = useCallback(async (classId: string) => {
    try {
      setDetail(await api<ClassDetail>(`/api/classes/${classId}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la classe.');
    }
  }, []);

  useEffect(() => {
    void loadClasses();
    loadAdminData().catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Chargement incomplet.'));
  }, [loadClasses, loadAdminData]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action impossible.');
    }
  }

  const createClass = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api('/api/admin/classes', {
        method: 'POST',
        body: { name: classForm.name, programId: classForm.programId || null, teacherId: classForm.teacherId || null },
      });
      setClassForm({ name: '', programId: '', teacherId: '' });
      await loadClasses();
    });
  };

  const createProgram = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api('/api/admin/programs', { method: 'POST', body: { name: programForm.name, level: programForm.level || null } });
      setProgramForm({ name: '', level: '' });
      await loadAdminData();
    });
  };

  const changeTeacher = (teacherId: string) =>
    selectedId &&
    void run(async () => {
      await api(`/api/admin/classes/${selectedId}`, { method: 'PATCH', body: { teacherId: teacherId || null } });
      await Promise.all([loadClasses(), loadDetail(selectedId)]);
    });

  const addStudent = () =>
    selectedId &&
    studentToAdd &&
    void run(async () => {
      await api(`/api/admin/classes/${selectedId}/students`, { method: 'POST', body: { studentId: studentToAdd } });
      setStudentToAdd('');
      await Promise.all([loadClasses(), loadDetail(selectedId)]);
    });

  const removeStudent = (studentId: string, name: string) =>
    selectedId &&
    window.confirm(`Retirer ${name} de la classe ?`) &&
    void run(async () => {
      await api(`/api/admin/classes/${selectedId}/students/${studentId}`, { method: 'DELETE' });
      await Promise.all([loadClasses(), loadDetail(selectedId)]);
    });

  const memberIds = new Set(detail?.students.map((student) => student.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Classes</h1>
        <p className="text-stone-600">
          {isAdmin ? 'Créez les classes, affectez un enseignant et les étudiants ; suivez la présence et les devoirs.' : 'Vos classes, leurs étudiants, la présence et les devoirs.'}
        </p>
      </div>

      <ErrorBanner message={error} />

      {isAdmin && (
        <form onSubmit={createClass} className="card grid gap-3 sm:grid-cols-4">
          <input className="input sm:col-span-2" required maxLength={120} placeholder="Nom de la classe (ex. B1 soir)" aria-label="Nom de la classe" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} />
          <select className="input" aria-label="Programme" value={classForm.programId} onChange={(e) => setClassForm({ ...classForm, programId: e.target.value })}>
            <option value="">Programme…</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          <select className="input" aria-label="Enseignant" value={classForm.teacherId} onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })}>
            <option value="">Enseignant…</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.fullName}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary sm:col-span-4 sm:justify-self-start">
            Créer la classe
          </button>
        </form>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="card divide-y divide-stone-100 p-0">
          {classes?.length === 0 && <p className="px-4 py-6 text-center text-stone-500">{isAdmin ? 'Aucune classe.' : 'Aucune classe ne vous est affectée.'}</p>}
          {classes?.map((klass) => (
            <button
              key={klass.id}
              className={`flex w-full flex-col items-start px-4 py-3 text-left hover:bg-stone-50 ${selectedId === klass.id ? 'bg-verde/5' : ''}`}
              onClick={() => setSelectedId(klass.id === selectedId ? null : klass.id)}
            >
              <span className="font-medium">
                {klass.name} {!klass.isActive && <span className="text-xs text-stone-400">(inactive)</span>}
              </span>
              <span className="text-xs text-stone-500">
                {klass.programName ?? 'Sans programme'} · {klass.teacherName ?? 'Sans enseignant'} · {klass.studentCount} étudiant(s)
              </span>
            </button>
          ))}
        </div>

        {detail && (
          <section className="card space-y-4">
            <h2 className="text-lg font-semibold">{detail.class.name}</h2>
            {isAdmin && (
              <div>
                <label className="label" htmlFor="detail-teacher">Enseignant principal</label>
                <select id="detail-teacher" className="input" value={detail.class.teacherId ?? ''} onChange={(e) => changeTeacher(e.target.value)}>
                  <option value="">Aucun</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isAdmin && (
              <div className="flex gap-2">
                <select className="input" aria-label="Étudiant à ajouter" value={studentToAdd} onChange={(e) => setStudentToAdd(e.target.value)}>
                  <option value="">Ajouter un étudiant…</option>
                  {students
                    .filter((student) => !memberIds.has(student.id))
                    .map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} {student.level ? `(${student.level})` : ''}
                      </option>
                    ))}
                </select>
                <button className="btn-primary" disabled={!studentToAdd} onClick={addStudent}>
                  Ajouter
                </button>
              </div>
            )}

            <ul className="divide-y divide-stone-100">
              {detail.students.length === 0 && <li className="py-3 text-sm text-stone-500">Aucun étudiant.</li>}
              {detail.students.map((student) => (
                <li key={student.id} className="flex items-center gap-3 py-2">
                  <span>{student.fullName}</span>
                  <span className="text-xs text-stone-500">{student.level ?? '—'}</span>
                  {student.status !== 'active' && <span className="text-xs text-rosso">suspendu</span>}
                  {isAdmin && (
                    <button className="ml-auto text-xs text-rosso hover:underline" onClick={() => removeStudent(student.id, student.fullName)}>
                      Retirer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {detail && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ClassHomeworkPanel classId={detail.class.id} />
          <ClassAttendancePanel classId={detail.class.id} className={detail.class.name} />
        </div>
      )}

      {isAdmin && (
        <section id="programmes" className="scroll-mt-20 space-y-3">
          <h2 className="text-lg font-semibold">Programmes</h2>
          <form onSubmit={createProgram} className="card flex flex-wrap gap-3">
            <input className="input flex-1" required maxLength={120} placeholder="Nom du programme" aria-label="Nom du programme" value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} />
            <select className="input w-auto" aria-label="Niveau du programme" value={programForm.level} onChange={(e) => setProgramForm({ ...programForm, level: e.target.value as CefrLevel | '' })}>
              <option value="">Niveau…</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
            <button type="submit" className="btn-secondary">
              Créer
            </button>
          </form>
          <div className="card divide-y divide-stone-100 p-0">
            {programs.map((program) => (
              <div key={program.id} className="flex items-center gap-3 px-4 py-2">
                <span className="font-medium">{program.name}</span>
                <span className="text-xs text-stone-500">{program.level ?? '—'}</span>
                <span className="ml-auto text-sm text-stone-600">{program.enrollmentCount} inscrit(s)</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
