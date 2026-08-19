"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/lib/types";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    apiFetch<{ notifications: NotificationRow[] }>("/api/notifications").then((res) => {
      if (res.success && res.data) setNotifications(res.data.notifications);
      else setError("Gagal memuat notifikasi.");
    });
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}`, { method: "POST" });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifikasi</h1>
        <p className="mt-1 text-sm text-secondary">Pembaruan pesanan, layanan, dan pengingat.</p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!notifications && !error && <LoadingState />}
      {notifications && notifications.length === 0 && (
        <EmptyState title="Belum ada notifikasi" description="Notifikasi akan muncul di sini." />
      )}
      {notifications && notifications.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {notifications.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-4 px-5 py-4 ${n.read_at ? "opacity-70" : ""}`}>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {n.title}
                  {!n.read_at && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-accent" aria-label="Belum dibaca" />}
                </p>
                <p className="mt-0.5 text-sm text-secondary">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.created_at)}</p>
                {n.link && (
                  <Link href={n.link} className="mt-1 inline-block text-xs font-medium underline underline-offset-2">
                    Lihat detail
                  </Link>
                )}
              </div>
              {!n.read_at && (
                <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                  Tandai dibaca
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
