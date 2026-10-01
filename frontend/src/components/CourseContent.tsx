import type { Course } from '../lib/types';
import { CourseMarkdown } from './course/CourseMarkdown';

function youTubeId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null;
    if (parsed.hostname === 'youtube.com' || parsed.hostname.endsWith('.youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] ?? null;
      return parsed.searchParams.get('v');
    }
  } catch {
    // URL invalide : affichée comme simple lien.
  }
  return null;
}

function ExternalResource({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary">
      {label} ↗
    </a>
  );
}

// Médias chargés à la demande (preload none/metadata) : connexions lentes (ENF-03).
export function CourseContent({ course }: { course: Course }) {
  const url = course.contentUrl ?? '';

  switch (course.contentType) {
    case 'text':
      return <CourseMarkdown source={course.body ?? ''} />;
    case 'video': {
      const id = youTubeId(url);
      if (id && /^[\w-]{6,20}$/.test(id)) {
        return (
          <div className="aspect-video overflow-hidden rounded-lg bg-stone-900">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title={course.title}
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <video controls preload="metadata" className="w-full rounded-lg bg-stone-900" src={url} />
          <ExternalResource url={url} label="Ouvrir la vidéo" />
        </div>
      );
    }
    case 'audio':
      return <audio controls preload="none" className="w-full" src={url} />;
    case 'pdf':
      return <ExternalResource url={url} label="Ouvrir le document PDF" />;
    case 'link':
      return <ExternalResource url={url} label="Ouvrir la ressource" />;
  }
}
