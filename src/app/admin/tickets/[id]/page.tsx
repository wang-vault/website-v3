"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { Ticket, TicketMessage } from "@/lib/types";

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<{ ticket: Ticket; messages: TicketMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ ticket: Ticket; messages: TicketMessage[] }>(`/api/admin/tickets/${params.id}`).then((res) => {
      if (res.success && res.data) setData(res.data);
      else setError(res.error?.message ?? "Tiket tidak ditemukan.");
    });
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: Record<string, unknown>) => {
    const res = await apiFetch(`/api/admin/tickets/${params.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (res.success) {
      toast.push("success", "Tiket diperbarui.");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    const res = await apiFetch(`/api/tickets/${params.id}/messages`, { method: "POST", body: JSON.stringify({ message: reply }) });
    setSending(false);
    if (res.success) {
      setReply("");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  const { ticket, messages } = data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/tickets" className="text-sm text-muted hover:text-primary">← Semua Tiket</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          <Badge tone={ticket.status === "closed" ? "neutral" : ticket.status === "answered" ? "info" : "warning"}>
            {ticket.status}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">
          {ticket.ticket_number} · {ticket.name} · {ticket.email} · {ticket.whatsapp || "no WA"}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
        <Select label="Status" value={ticket.status} onChange={(e) => update({ status: e.target.value })} className="w-44">
          {["open", "answered", "customer_reply", "closed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select label="Prioritas" value={ticket.priority} onChange={(e) => update({ priority: e.target.value })} className="w-44">
          {["rendah", "normal", "tinggi", "kritis"].map((p) => <option key={p} value={p}>{p}</option>)}
        </Select>
        <Select label="Kategori" value={ticket.category} onChange={(e) => update({ category: e.target.value })} className="w-44">
          {["Umum", "Kontak", "Pemesanan", "Pembayaran", "Layanan", "Teknis", "Penagihan", "Lainnya"].map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </div>

      <ol className="space-y-4" aria-label="Percakapan tiket">
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl border p-4 ${m.sender_type === "customer" ? "border-border bg-surface" : "ml-auto border-border bg-surface-muted"}`}>
            <p className="text-xs text-muted">
              {m.sender_type === "staff" ? "Staf WangStore" : "Pelanggan"} · {formatDateTime(m.created_at)}
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.message}</p>
          </li>
        ))}
      </ol>

      {ticket.status !== "closed" && (
        <form onSubmit={send} className="space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Tulis balasan untuk pelanggan…"
            aria-label="Balasan staf"
            className="w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-accent"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !reply.trim()}>{sending ? "Mengirim…" : "Kirim Balasan"}</Button>
          </div>
        </form>
      )}
    </div>
  );
}
