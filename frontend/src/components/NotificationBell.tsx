import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AppNotification } from '../lib/types';

const POLL_MS = 60_000;

// §15 : centre de notifications in-app (sondage léger, adapté aux connexions lentes).
export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unreadCount: number; notifications: AppNotification[] } | null>(null);
  const [emailEnabled, setEmailEnabled] = useState<boolean | null>(null);

  const load = useCallback(() => {
    api<{ unreadCount: number; notifications: AppNotification[] }>('/api/notifications')
      .then(setData)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      api<{ email: boolean }>('/api/notifications/preferences')
        .then((response) => setEmailEnabled(response.email))
        .catch(() => undefined);
    }
  }

  async function openNotification(notification: AppNotification) {
    if (!notification.readAt) await api('/api/notifications/read', { method: 'POST', body: { ids: [notification.id] } }).catch(() => undefined);
    setOpen(false);
    load();
    if (notification.link) navigate(notification.link);
  }

  async function markAllRead() {
    await api('/api/notifications/read', { method: 'POST', body: {} }).catch(() => undefined);
    load();
  }

  async function toggleEmail(enabled: boolean) {
    const response = await api<{ email: boolean }>('/api/notifications/preferences', { method: 'PUT', body: { email: enabled } }).catch(() => null);
    if (response) setEmailEnabled(response.email);
  }

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button className="btn-secondary relative px-3" aria-haspopup="true" aria-expanded={open} aria-label={`Notifications, ${unread} non lue${unread > 1 ? 's' : ''}`} onClick={toggle}>
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span aria-hidden className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-rosso px-1 text-center text-[11px] font-bold leading-5 text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button aria-label="Fermer les notifications" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white shadow-lg" role="dialog" aria-label="Notifications">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2">
              <span className="font-semibold">Notifications</span>
              {unread > 0 && (
                <button className="text-xs text-verde-dark hover:underline" onClick={() => void markAllRead()}>
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
              {data?.notifications.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-500">Aucune notification.</li>}
              {data?.notifications.map((notification) => (
                <li key={notification.id}>
                  <button className={`w-full px-4 py-3 text-left hover:bg-stone-50 ${notification.readAt ? '' : 'bg-verde/5'}`} onClick={() => void openNotification(notification)}>
                    <span className="flex items-start gap-2">
                      {!notification.readAt && <span aria-label="Non lue" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-verde" />}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-stone-900">{notification.title}</span>
                        {notification.body && <span className="line-clamp-2 block text-xs text-stone-600">{notification.body}</span>}
                        <span className="block text-[11px] text-stone-400">{formatDateTime(notification.createdAt)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {emailEnabled !== null && (
              <label className="flex items-center gap-2 border-t border-stone-100 px-4 py-2 text-xs text-stone-600">
                <input type="checkbox" className="accent-verde" checked={emailEnabled} onChange={(e) => void toggleEmail(e.target.checked)} />
                Recevoir aussi ces notifications par email
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}
