"use client";

import { useEffect, useState } from "react";
import { BellIcon, XIcon } from "@/components/icons";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import {
  getNotifications,
  markAllRead,
  markRead,
  unreadCount,
  type AppNotification,
  type NotifKind,
} from "@/lib/notifications";

const kindTone: Record<NotifKind, string> = {
  meal_reminder: "bg-teal-t text-teal-d",
  drink_reminder: "bg-blue-t text-blue-d",
  hydration: "bg-blue-t text-blue-d",
  sugar_warning: "bg-amber-t text-amber-d",
  daily_summary: "bg-navy/[0.06] text-navy",
  weekly_summary: "bg-navy/[0.06] text-navy",
  report_ready: "bg-teal-t text-teal-d",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);

  useEffect(() => {
    setCount(unreadCount());
  }, []);

  function openPanel() {
    setNotifs(getNotifications());
    setOpen(true);
  }

  function handleClose() {
    markAllRead();
    setCount(0);
    setOpen(false);
  }

  function handleRead(id: string) {
    markRead(id);
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    setCount(unreadCount());
  }

  return (
    <>
      <button
        onClick={openPanel}
        aria-label="Notifications"
        className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-white/[0.14] text-white"
      >
        <BellIcon size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[9px] w-[9px] rounded-full bg-red ring-2 ring-navy" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={handleClose}>
          <div
            className="flex h-full w-full max-w-[400px] animate-scale-in flex-col bg-card shadow-card-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-[16px] font-extrabold text-ink">Notifications</h2>
              <button onClick={handleClose} aria-label="Close" className="text-ink-3">
                <XIcon size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {notifs.length === 0 ? (
                <p className="py-10 text-center text-[13px] font-medium text-ink-3">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {notifs.map((n) => (
                    <li
                      key={n.id}
                      className={cn(
                        "flex gap-3 px-5 py-4",
                        !n.read && "bg-teal-t/20",
                      )}
                      onClick={() => handleRead(n.id)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                          kindTone[n.kind],
                        )}
                      >
                        <BellIcon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-ink">
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-teal" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-ink-2">
                          {n.body}
                        </p>
                        <span className="mt-1 text-[10.5px] font-medium text-ink-3">
                          {formatTime(n.createdAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
