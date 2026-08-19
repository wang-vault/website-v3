"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Ticket, TicketMessage } from "@/lib/types";

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<{ ticket: Ticket; messages: TicketMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => {
    apiFetch<{ ticket: Ticket; messages: TicketMessage[] }>(`/api/tickets/${params.id}`).then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Tiket tidak ditemukan.");
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const res = await apiFetch(`/api/tickets/${params.id}/messages`, { method: "POST", body: JSON.stringify({ message: reply }) });
    setSending(false);
    if (res.success) {
      setReply("");
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  const close = async () => {
    const res = await apiFetch(`/api/tickets/${params.id}`, { method: "POST" });
    if (res.success) {
      toast.push("success", "Tiket ditutup.");
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { ticket, messages } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/tickets" className="text-sm text-muted hover:text-primary">← Semua Tiket</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <Badge tone={ticket.status === "closed" ? "neutral" : ticket.status === "answered" ? "info" : "warning"}>
            {ticket.status === "closed" ? "Ditutup" : ticket.status === "answered" ? "Dijawab" : "Terbuka"}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {ticket.ticket_number} · {ticket.category} · Prioritas {ticket.priority}
        </p>
      </div>

      <ol className="space-y-4" aria-label="Percakapan tiket">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`max-w-[85%] rounded-2xl border p-4 ${
              m.sender_type === "customer" ? "ml-auto border-border bg-surface" : "border-border bg-surface-muted"
            }`}
          >
            <p className="text-xs text-muted">
              {m.sender_type === "staff" ? "Staf WangStore" : "Anda"} · {formatDateTime(m.created_at)}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.message}</p>
          </li>
        ))}
      </ol>

      {ticket.status !== "closed" ? (
        <form onSubmit={send} className="space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Tulis balasan Anda…"
            aria-label="Balasan"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>Tutup Tiket</Button>
            <Button type="submit" disabled={sending || !reply.trim()}>{sending ? "Mengirim…" : "Kirim Balasan"}</Button>
          </div>
        </form>
      ) : (
        <p className="text-center text-sm text-muted">Tiket ini telah ditutup.</p>
      )}
    </div>
  );
}
