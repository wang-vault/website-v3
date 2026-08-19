"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Ticket } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  open: "Terbuka",
  answered: "Dijawab",
  customer_reply: "Balasan Pelanggan",
  closed: "Ditutup",
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "error" | "info" | "accent"> = {
  open: "warning",
  answered: "info",
  customer_reply: "accent",
  closed: "neutral",
};

export default function TicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "Umum", priority: "normal", message: "" });
  const [loading, setLoading] = useState(false);

  const load = () => {
    apiFetch<{ tickets: Ticket[] }>("/api/tickets").then((res) => {
      if (res.success && res.data) setTickets(res.data.tickets);
      else setError("Gagal memuat tiket.");
    });
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await apiFetch<{ ticket: { id: string; ticketNumber: string } }>("/api/tickets", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.success && res.data) {
      setCreateOpen(false);
      setForm({ subject: "", category: "Umum", priority: "normal", message: "" });
      toast.push("success", `Tiket ${res.data.ticket.ticketNumber} dibuat.`);
      load();
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tiket</h1>
          <p className="mt-1 text-sm text-secondary">Ajukan pertanyaan atau kendala, dan pantau balasan staf.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Buat Tiket</Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!tickets && !error && <LoadingState />}
      {tickets && tickets.length === 0 && (
        <EmptyState
          title="Belum ada tiket"
          description="Buat tiket pertama Anda untuk bertanya atau melaporkan kendala."
        />
      )}
      {tickets && tickets.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.ticket_number} · {t.category} · prioritas {t.priority} · {formatDateTime(t.updated_at)}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <Modal open onClose={() => setCreateOpen(false)} title="Buat Tiket">
          <form onSubmit={create} className="space-y-4">
            <Input label="Subjek" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["Umum", "Pemesanan", "Pembayaran", "Layanan", "Teknis", "Penagihan", "Lainnya"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select label="Prioritas" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="rendah">Rendah</option>
                <option value="normal">Normal</option>
                <option value="tinggi">Tinggi</option>
                <option value="kritis">Kritis</option>
              </Select>
            </div>
            <Textarea label="Pesan" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button type="submit" disabled={loading}>{loading ? "Membuat…" : "Buat Tiket"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
