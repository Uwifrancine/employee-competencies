import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppNotification } from "@/hooks/useNotifications";

interface NotificationBellProps {
  items: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * Presentational notification bell. State (polling, popups) lives in
 * useNotifications, lifted to AppShell so a single poller drives every
 * rendered bell (desktop + mobile) without firing duplicate popups.
 */
export function NotificationBell({ items, unreadCount, markRead, markAllRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false);

  const onItemClick = (id: string, link: string | null, isRead: boolean) => {
    if (!isRead) markRead(id);
    setOpen(false);
    if (link) window.location.href = link;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-foreground/10 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <CheckCheck className="size-3" /> Mark all read
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            You're all caught up.
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n.id, n.link, n.isRead)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 ${
                    n.isRead ? "" : "bg-accent/5"
                  }`}
                >
                  <span
                    className={`mt-1.5 size-2 rounded-full shrink-0 ${
                      n.isRead ? "bg-transparent" : "bg-accent"
                    }`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{n.message}</span>
                    <span className="block text-[10px] text-muted-foreground/70 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
