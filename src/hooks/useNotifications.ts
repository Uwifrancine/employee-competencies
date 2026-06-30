import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

const POLL_INTERVAL_MS = 25_000;

/**
 * Polls the backend for the current user's notifications. When new unread
 * notifications appear (after the first load), shows an in-app toast and a
 * browser/OS notification. Works as long as the user is logged in.
 */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const showPopups = useCallback((fresh: AppNotification[]) => {
    for (const n of fresh) {
      // In-app toast
      toast(n.title, {
        description: n.message,
        action: n.link
          ? { label: "View", onClick: () => (window.location.href = n.link!) }
          : undefined,
      });
      // Browser / OS notification (only if the user granted permission)
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          const browserNotif = new Notification(n.title, {
            body: n.message,
            tag: n.id,
          });
          if (n.link) {
            browserNotif.onclick = () => {
              window.focus();
              window.location.href = n.link!;
            };
          }
        } catch {
          /* some browsers block constructing Notification directly — ignore */
        }
      }
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await api.get<NotificationsResponse>("/api/notifications");
      setItems(res.items);
      setUnreadCount(res.unreadCount);

      if (!initialized.current) {
        // First load: establish a baseline without firing popups for history
        res.items.forEach((n) => seenIds.current.add(n.id));
        initialized.current = true;
        return;
      }

      const fresh = res.items.filter((n) => !seenIds.current.has(n.id));
      res.items.forEach((n) => seenIds.current.add(n.id));
      if (fresh.length > 0) showPopups(fresh);
    } catch {
      /* network blip — try again on the next tick */
    }
  }, [showPopups]);

  useEffect(() => {
    if (!enabled) return;
    poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    // Re-check when the tab regains focus so popups feel timely
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, poll]);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch {
      /* optimistic; will reconcile on next poll */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.post("/api/notifications/read-all");
    } catch {
      /* optimistic; will reconcile on next poll */
    }
  }, []);

  return { items, unreadCount, markRead, markAllRead, refresh: poll };
}
