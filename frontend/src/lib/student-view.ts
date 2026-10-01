import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Les pages Cours / Exercice de l'étudiant servent aussi à la « vue étudiant » du personnel
// (/vue-etudiant/…) : mêmes écrans, données via les routes d'aperçu, aucune tentative enregistrée.
export const STUDENT_VIEW_ROOT = '/vue-etudiant';

export function useStudentView() {
  const preview = useLocation().pathname.startsWith(STUDENT_VIEW_ROOT);
  return useMemo(() => buildView(preview), [preview]);
}

function buildView(preview: boolean) {
  const base = preview ? STUDENT_VIEW_ROOT : '/etudiant';
  return {
    preview,
    paths: {
      courses: `${base}/cours`,
      course: (id: string) => `${base}/cours/${id}`,
      // L'aperçu n'a pas de liste d'exercices propre : ils s'ouvrent depuis leur cours.
      exercises: preview ? `${base}/cours` : `${base}/exercices`,
      exercise: (id: string) => `${base}/exercices/${id}`,
    },
    api: {
      courses: preview ? '/api/manage/courses/preview' : '/api/courses',
      course: (id: string) => (preview ? `/api/manage/courses/preview/${id}` : `/api/courses/${id}`),
      exercise: (id: string) => (preview ? `/api/manage/exercises/preview/${id}` : `/api/exercises/${id}`),
      attempt: (id: string) => (preview ? `/api/manage/exercises/preview/${id}/attempts` : `/api/exercises/${id}/attempts`),
    },
  };
}
