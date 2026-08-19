"use client";

import { useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const res = await apiFetch<{ message: string; ticketNumber: string }>("/api/contact", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.success && res.data) {
      setResult({ ok: true, message: `${res.data.message} Nomor tiket: ${res.data.ticketNumber}.` });
      setForm({ name: "", email: "", whatsapp: "", subject: "", message: "" });
    } else {
      setResult({ ok: false, message: apiErrorMessage(res) });
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-surface p-6" aria-label="Formulir kontak">
      <Input label="Nama" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama Anda" />
      <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
      <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xxxxxxxxxx (opsional)" />
      <Input label="Subjek" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ringkasan pertanyaan" />
      <Textarea label="Pesan" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tulis pertanyaan atau kendala Anda…" />
      {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Mengirim…" : "Kirim Pesan"}
      </Button>
    </form>
  );
}
