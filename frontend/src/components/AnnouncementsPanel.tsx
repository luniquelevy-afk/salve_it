import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Announcement } from '../lib/types';

// EF-29 : annonces récentes sur le tableau de bord.
export function AnnouncementsPanel({ limit = 3 }: { limit?: number }) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  useEffect(() => {
    api<{ announcements: Announcement[] }>('/api/announcements')
      .then((response) => setAnnouncements(response.announcements))
      .catch(() => setAnnouncements([]));
  }, []);

  if (announcements === null) return null;

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Annonces</h2>
        <Link to="/annonces" className="text-sm text-verde-dark hover:underline">
          Tout voir
        </Link>
      </div>
      {announcements.length === 0 && <p className="text-sm text-stone-500">Aucune annonce pour le moment.</p>}
      {announcements.slice(0, limit).map((announcement) => (
        <article key={announcement.id} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
          <p className="font-medium">{announcement.title}</p>
          <p className="line-clamp-2 whitespace-pre-line text-sm text-stone-600">{announcement.body}</p>
          <p className="mt-1 text-xs text-stone-400">
            {formatDateTime(announcement.publishedAt)}
            {announcement.className && ` · ${announcement.className}`}
          </p>
        </article>
      ))}
    </section>
  );
}
