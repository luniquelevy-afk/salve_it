import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/ErrorBanner';
import { api, ApiError } from '../../lib/api';
import { QUESTION_STATUS_LABELS, type Question, type QuestionOption, type QuestionStatus } from '../../lib/types';

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
const MAX_VARIANTS = 5;

interface Draft {
  id: string | null;
  category: string;
  difficulty: 1 | 2 | 3;
  questionText: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
}

// Format TOLC : 5 options par défaut (CDC §1.1), ajustable de 2 à 6.
const emptyDraft = (category = ''): Draft => ({
  id: null,
  category,
  difficulty: 1,
  questionText: '',
  options: OPTION_KEYS.slice(0, 5).map((key) => ({ key, text: '' })),
  correctAnswer: 'A',
  explanation: '',
});

const STATUS_STYLES: Record<QuestionStatus, string> = {
  draft: 'bg-stone-100 text-stone-600',
  pending_review: 'bg-amber-100 text-amber-800',
  active: 'bg-verde/10 text-verde-dark',
  archived: 'bg-stone-100 text-stone-400',
};

const excerpt = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState<{ category: string; status: QuestionStatus | '' }>({ category: '', status: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [variantTarget, setVariantTarget] = useState<{ id: string; count: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.status) params.set('status', filters.status);
      const query = params.size ? `?${params}` : '';
      const [questionsResponse, categoriesResponse] = await Promise.all([
        api<{ questions: Question[] }>(`/api/questions${query}`),
        api<{ categories: string[] }>('/api/questions/categories'),
      ]);
      setQuestions(questionsResponse.questions);
      setCategories(categoriesResponse.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de charger la banque de questions.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(question: Question) {
    setDraft({
      id: question.id,
      category: question.category,
      difficulty: question.difficulty,
      questionText: question.questionText,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateOption(index: number, text: string) {
    if (!draft) return;
    setDraft({ ...draft, options: draft.options.map((option, i) => (i === index ? { ...option, text } : option)) });
  }

  function setOptionCount(count: number) {
    if (!draft) return;
    const options = OPTION_KEYS.slice(0, count).map((key, i) => ({ key, text: draft.options[i]?.text ?? '' }));
    const correctAnswer = options.some((option) => option.key === draft.correctAnswer) ? draft.correctAnswer : 'A';
    setDraft({ ...draft, options, correctAnswer });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const body = {
      category: draft.category.trim().toLowerCase(),
      difficulty: draft.difficulty,
      questionText: draft.questionText,
      options: draft.options.map((option) => ({ key: option.key, text: option.text.trim() })),
      correctAnswer: draft.correctAnswer,
      explanation: draft.explanation.trim() || null,
    };
    try {
      if (draft.id) {
        await api(`/api/questions/${draft.id}`, { method: 'PATCH', body });
      } else {
        await api('/api/questions', { method: 'POST', body });
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(question: Question, status: QuestionStatus) {
    const confirmation =
      question.source === 'ai_generated'
        ? 'Question générée par IA : avez-vous vérifié l’énoncé, chaque option, la bonne réponse et l’explication ? Une fois activée, elle pourra être tirée dans les simulations des étudiants.'
        : 'Activer cette question ? Elle pourra être tirée dans les simulations des étudiants.';
    if (status === 'active' && !window.confirm(confirmation)) return;
    setBusyId(question.id);
    setError(null);
    try {
      await api(`/api/questions/${question.id}/status`, { method: 'POST', body: { status } });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Changement de statut impossible.');
    } finally {
      setBusyId(null);
    }
  }

  // EF-07 : les variantes arrivent « À relire » et restent hors des simulations jusqu'à activation.
  async function generateVariants(question: Question, count: number) {
    setBusyId(question.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ questions: Question[]; requested: number; rejected: number }>(`/api/questions/${question.id}/variants`, {
        method: 'POST',
        body: { count },
      });
      setVariantTarget(null);
      setNotice(
        `${result.questions.length} variante${result.questions.length > 1 ? 's' : ''} créée${result.questions.length > 1 ? 's' : ''} « À relire »` +
          (result.rejected > 0 ? ` (${result.rejected} écartée${result.rejected > 1 ? 's' : ''} car invalide${result.rejected > 1 ? 's' : ''})` : '') +
          '. Vérifiez chaque énoncé, calcul et bonne réponse avant de les activer.',
      );
      const nextFilters = { category: question.category, status: 'pending_review' as const };
      if (filters.category === nextFilters.category && filters.status === nextFilters.status) await load();
      else setFilters(nextFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Génération des variantes impossible.');
    } finally {
      setBusyId(null);
    }
  }

  const sourceOf = (question: Question) => (question.generatedFrom ? questions.find((candidate) => candidate.id === question.generatedFrom) : undefined);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Banque de questions</h1>
        <button className="btn-primary ml-auto" onClick={() => setDraft(draft ? null : emptyDraft(filters.category))}>
          {draft ? 'Fermer' : 'Nouvelle question'}
        </button>
      </div>

      <ErrorBanner message={error} />
      {notice && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {notice}
        </p>
      )}

      {draft && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="font-semibold">{draft.id ? 'Modifier la question' : 'Nouvelle question'}</h2>
          {draft.id && (
            <p className="text-xs text-stone-500">La modification crée une nouvelle version de la question ; les résultats passés restent inchangés.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="q-category">Catégorie</label>
              <input
                id="q-category"
                className="input"
                list="question-categories"
                required
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              />
              <datalist id="question-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label" htmlFor="q-difficulty">Difficulté</label>
              <select
                id="q-difficulty"
                className="input"
                value={draft.difficulty}
                onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) as 1 | 2 | 3 })}
              >
                <option value={1}>1 — facile</option>
                <option value={2}>2 — moyenne</option>
                <option value={3}>3 — difficile</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="q-count">Nombre d’options</label>
              <select id="q-count" className="input" value={draft.options.length} onChange={(e) => setOptionCount(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="q-text">Énoncé</label>
            <textarea
              id="q-text"
              className="input min-h-24"
              required
              value={draft.questionText}
              onChange={(e) => setDraft({ ...draft, questionText: e.target.value })}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="label">Options — cochez la bonne réponse</legend>
            {draft.options.map((option, index) => (
              <div key={option.key} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-answer"
                  aria-label={`Bonne réponse ${option.key}`}
                  className="h-4 w-4 accent-verde"
                  checked={draft.correctAnswer === option.key}
                  onChange={() => setDraft({ ...draft, correctAnswer: option.key })}
                />
                <span className="w-5 font-bold">{option.key}</span>
                <input className="input" required value={option.text} onChange={(e) => updateOption(index, e.target.value)} />
              </div>
            ))}
          </fieldset>

          <div>
            <label className="label" htmlFor="q-explanation">Explication (affichée dans la correction)</label>
            <textarea
              id="q-explanation"
              className="input min-h-20"
              value={draft.explanation}
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <select className="input w-auto" aria-label="Filtrer par catégorie" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
          <option value="">Toutes les catégories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          aria-label="Filtrer par statut"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value as QuestionStatus | '' })}
        >
          <option value="">Tous les statuts</option>
          {(Object.keys(QUESTION_STATUS_LABELS) as QuestionStatus[]).map((status) => (
            <option key={status} value={status}>{QUESTION_STATUS_LABELS[status]}</option>
          ))}
        </select>
        <span className="self-center text-sm text-stone-500">{questions.length} question(s)</span>
      </div>

      <div className="space-y-3">
        {loading && <p className="text-stone-500">Chargement…</p>}
        {!loading && questions.length === 0 && <p className="text-stone-500">Aucune question.</p>}
        {!loading &&
          questions.map((question) => {
            const source = sourceOf(question);
            return (
              <article key={question.id} className="card space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[question.status]}`}>{QUESTION_STATUS_LABELS[question.status]}</span>
                  <span className="text-stone-500">
                    {question.category} · difficulté {question.difficulty} · v{question.version}
                    {question.source === 'ai_generated' && ' · générée par IA'}
                  </span>
                  {question.stats && (
                    <span
                      className={`ml-auto tabular-nums ${question.stats.answers >= 5 && question.stats.successRate < 30 ? 'font-semibold text-rosso' : 'text-stone-600'}`}
                      title="Taux de réussite sur les simulations terminées"
                    >
                      {question.stats.successRate} % de réussite · {question.stats.answers} réponse{question.stats.answers > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {question.generatedFrom && (
                  <p className="text-xs text-stone-500">Variante de : « {excerpt(source?.questionText ?? question.generatedFromText ?? 'question d’origine introuvable')} »</p>
                )}
                <p className="whitespace-pre-line">{question.questionText}</p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {question.options.map((option) => (
                    <li key={option.key} className={option.key === question.correctAnswer ? 'font-semibold text-verde-dark' : 'text-stone-600'}>
                      {option.key}. {option.text}
                    </li>
                  ))}
                </ul>
                {question.source === 'ai_generated' && question.explanation && (
                  <p className="text-sm text-stone-600">
                    <span className="font-medium">Explication proposée :</span> {question.explanation}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-1 text-xs" onClick={() => edit(question)}>
                    Modifier
                  </button>
                  {question.status === 'draft' && (
                    <button className="btn-secondary px-3 py-1 text-xs" disabled={busyId === question.id} onClick={() => void changeStatus(question, 'pending_review')}>
                      Soumettre à relecture
                    </button>
                  )}
                  {(question.status === 'draft' || question.status === 'pending_review' || question.status === 'archived') && (
                    <button className="btn-primary px-3 py-1 text-xs" disabled={busyId === question.id} onClick={() => void changeStatus(question, 'active')}>
                      Activer
                    </button>
                  )}
                  {question.status !== 'archived' && (
                    <button
                      className="btn-secondary px-3 py-1 text-xs"
                      disabled={busyId === question.id}
                      onClick={() => setVariantTarget(variantTarget?.id === question.id ? null : { id: question.id, count: 3 })}
                    >
                      Générer des variantes (IA)
                    </button>
                  )}
                  {question.status !== 'archived' && (
                    <button className="btn-danger px-3 py-1 text-xs" disabled={busyId === question.id} onClick={() => void changeStatus(question, 'archived')}>
                      Archiver
                    </button>
                  )}
                </div>
                {variantTarget?.id === question.id && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-50 px-3 py-2 text-sm">
                    <label htmlFor={`variants-${question.id}`}>Nombre de variantes</label>
                    <select
                      id={`variants-${question.id}`}
                      className="input w-auto py-1"
                      value={variantTarget.count}
                      onChange={(e) => setVariantTarget({ id: question.id, count: Number(e.target.value) })}
                    >
                      {Array.from({ length: MAX_VARIANTS }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                    <button className="btn-primary px-3 py-1 text-xs" disabled={busyId === question.id} onClick={() => void generateVariants(question, variantTarget.count)}>
                      {busyId === question.id ? 'Génération…' : 'Générer'}
                    </button>
                    <p className="w-full text-xs text-stone-500">
                      Même compétence et même difficulté, énoncé différent. Les variantes sont créées « À relire » et n’entrent jamais dans les simulations sans votre validation.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
      </div>
    </div>
  );
}
