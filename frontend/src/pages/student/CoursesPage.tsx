import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { CEFR_LEVELS, COURSE_TYPE_LABELS, type CefrLevel, type Course, type CourseContentType } from '../../lib/types';
import { Icon } from '../public/landing-icon';
import { SectionTabs } from '../../components/SectionTabs';
import { STUDENT_LEARNING_TABS } from '../../components/section-tabs';

type LevelFilter = CefrLevel | 'all' | '';

const TYPE_ICON: Record<CourseContentType, string> = {
  text: 'solar:document-text-bold',
  pdf: 'solar:document-text-bold',
  video: 'solar:videocamera-record-bold',
  audio: 'solar:play-circle-bold',
  link: 'solar:arrow-right-linear',
};

// Liste des cours (catalogue réel) — thème sombre cohérent avec l'espace étudiant.
export function CoursesPage() {
  const [level, setLevel] = useState<LevelFilter>('');
  const [category, setCategory] = useState('');
  const [data, setData] = useState<{ studentLevel: CefrLevel | null; courses: Course[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = level ? `?level=${level}` : '';
    api<{ studentLevel: CefrLevel | null; courses: Course[] }>(`/api/courses${query}`)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Impossible de charger les cours.'));
  }, [level]);

  const categories = useMemo(() => [...new Set(data?.courses.map((course) => course.category) ?? [])].sort(), [data]);
  const courses = data?.courses.filter((course) => !category || course.category === category) ?? [];
  const total = data?.courses.length ?? 0;

  return (
    <div className="cours space-y-8">
      <SectionTabs tabs={STUDENT_LEARNING_TABS} label="Apprendre" />
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-[#2DD4BF]">
            <Icon name="solar:book-bookmark-bold" size={14} />Espace Cours &amp; Modules
          </span>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Catalogue des cours</h1>
          <p className="max-w-xl text-xs text-slate-400 sm:text-sm">
            {data?.studentLevel
              ? <>Cours de votre niveau (<span className="font-semibold text-[#2DD4BF]">{data.studentLevel}</span>) par défaut · leçons, exercices et supports du centre.</>
              : 'Ressources pédagogiques du centre : leçons, exercices et supports.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="cours-level">Niveau</label>
          <select
            id="cours-level"
            value={level}
            onChange={(e) => setLevel(e.target.value as LevelFilter)}
            className="rounded-xl border border-white/[0.1] bg-[#0D131F] px-3 py-2 text-xs font-medium text-slate-200 outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]"
          >
            <option value="">Mon niveau</option>
            <option value="all">Tous les niveaux</option>
            {CEFR_LEVELS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <Link
            to="/etudiant/exercices"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E2583E] px-4 py-2 text-xs font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#c9452d]"
          >
            <Icon name="solar:target-bold" size={14} /><span>Exercices</span>
          </Link>
        </div>
      </div>

      {/* Filtres par catégorie */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] pb-3 text-xs font-semibold">
        <button
          onClick={() => setCategory('')}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 transition-all ${
            category === '' ? 'bg-[#0E8368] text-white shadow-sm' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          <Icon name="solar:book-2-bold" size={16} /><span>Tous mes cours ({total})</span>
        </button>
        {categories.map((value) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 capitalize transition-all ${
              category === value ? 'bg-[#0E8368] text-white shadow-sm' : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
            }`}
          >
            <Icon name="solar:book-bookmark-bold" size={14} className="text-[#2DD4BF]" /><span>{value}</span>
          </button>
        ))}
      </div>

      {/* États */}
      {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Chargement des cours…</p>}
      {data && courses.length === 0 && !error && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          Aucun cours disponible pour ce filtre.
        </div>
      )}

      {/* Grille des cours */}
      {courses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/etudiant/cours/${course.id}`}
              className="group flex flex-col justify-between space-y-5 rounded-3xl border border-white/[0.08] bg-[#0D131F] p-6 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-[#0E8368] hover:shadow-[0_20px_40px_rgba(14,131,104,0.2)]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-[#0E8368]/30 bg-[#0E8368]/20 px-3 py-1 text-[10px] font-bold text-[#2DD4BF]">{course.level}</span>
                  <span className="text-[11px] font-medium capitalize text-slate-400">{course.category}</span>
                </div>
                <div className="space-y-1.5">
                  <h2 className="font-heading text-lg font-bold text-white transition-colors group-hover:text-[#2DD4BF]">{course.title}</h2>
                  {course.description && <p className="line-clamp-3 text-xs leading-relaxed text-slate-400">{course.description}</p>}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Icon name={TYPE_ICON[course.contentType]} size={16} className="text-[#0E8368]" />
                  {COURSE_TYPE_LABELS[course.contentType]}
                </span>
                <span className="flex items-center gap-1 font-bold text-[#2DD4BF] transition-transform group-hover:translate-x-1">
                  Ouvrir <Icon name="solar:arrow-right-linear" size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
