"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatDateTime } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { LoadingState, EmptyState } from "@/components/ui/state";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AdminPageHeader } from "@/components/admin/admin-page";
import type { Row } from "@/lib/db/types";

type ResourceKey = "pages" | "faq" | "testimonials" | "blog" | "knowledgeBase" | "legal" | "announcements" | "incidents" | "maintenance";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "number" | "textarea" | "markdown" | "select" | "datetime" | "json" | "boolean";
  required?: boolean;
  options?: string[] | { value: string; label: string }[];
  hint?: string;
  emptyValue?: unknown;
}

const RESOURCES: { key: ResourceKey; label: string; titleField: string; subtitle: string; fields: FieldDef[] }[] = [
  {
    key: "pages",
    label: "Halaman",
    titleField: "title",
    subtitle: "Halaman statis (beranda, tentang, fitur, infrastruktur…)",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "seo_title", label: "SEO Title", type: "text" },
      { key: "seo_description", label: "SEO Description", type: "textarea" },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
      { key: "sections", label: "Sections (JSON)", type: "json", hint: "Array section: hero/heading/paragraph/list/cta/card. Contoh: [{\"type\":\"heading\",\"text\":\"Judul\"}]" },
    ],
  },
  {
    key: "faq",
    label: "FAQ",
    titleField: "question",
    subtitle: "Pertanyaan yang sering diajukan",
    fields: [
      { key: "question", label: "Pertanyaan", type: "text", required: true },
      { key: "answer_md", label: "Jawaban (Markdown)", type: "markdown", required: true },
      { key: "category", label: "Kategori", type: "text" },
      { key: "sort", label: "Urutan", type: "number", emptyValue: 0 },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
    ],
  },
  {
    key: "testimonials",
    label: "Testimoni",
    titleField: "name",
    subtitle: "Hanya tampilkan testimoni nyata",
    fields: [
      { key: "name", label: "Nama", type: "text", required: true },
      { key: "role", label: "Peran", type: "text" },
      { key: "content", label: "Isi Testimoni", type: "textarea", required: true },
      { key: "rating", label: "Rating (1-5)", type: "number", emptyValue: 5 },
      { key: "status", label: "Status", type: "select", options: [{ value: "pending", label: "Menunggu" }, { value: "published", label: "Dipublikasikan" }] },
    ],
  },
  {
    key: "blog",
    label: "Blog",
    titleField: "title",
    subtitle: "Artikel blog (Markdown)",
    fields: [
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "slug", label: "Slug", type: "text" },
      { key: "excerpt", label: "Ringkasan", type: "textarea" },
      { key: "content_md", label: "Konten (Markdown)", type: "markdown", required: true },
      { key: "category_id", label: "Kategori", type: "select", options: [], hint: "Dimuat dari database" },
      { key: "author_name", label: "Penulis", type: "text" },
      { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draf" }, { value: "published", label: "Terbit" }] },
      { key: "published_at", label: "Tanggal Terbit", type: "datetime" },
      { key: "seo_title", label: "SEO Title", type: "text" },
      { key: "seo_description", label: "SEO Description", type: "textarea" },
    ],
  },
  {
    key: "knowledgeBase",
    label: "Knowledge Base",
    titleField: "title",
    subtitle: "Artikel knowledge base (Markdown)",
    fields: [
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "slug", label: "Slug", type: "text" },
      { key: "excerpt", label: "Ringkasan", type: "textarea" },
      { key: "content_md", label: "Konten (Markdown)", type: "markdown", required: true },
      { key: "category", label: "Kategori", type: "select", options: ["Memulai", "Pemesanan", "Pembayaran", "Minecraft", "Server", "Troubleshooting", "Akun", "Kebijakan"] },
      { key: "author_name", label: "Penulis", type: "text" },
      { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draf" }, { value: "published", label: "Terbit" }] },
      { key: "published_at", label: "Tanggal Terbit", type: "datetime" },
      { key: "seo_title", label: "SEO Title", type: "text" },
      { key: "seo_description", label: "SEO Description", type: "textarea" },
    ],
  },
  {
    key: "legal",
    label: "Dokumen Legal",
    titleField: "title",
    subtitle: "Terms, privacy, refund, SLA, acceptable use, cookies",
    fields: [
      { key: "slug", label: "Slug", type: "text", required: true },
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "sections", label: "Sections (JSON)", type: "json", hint: "Array heading/paragraph." },
    ],
  },
  {
    key: "announcements",
    label: "Pengumuman",
    titleField: "title",
    subtitle: "Banner pengumuman di beranda",
    fields: [
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "message_md", label: "Pesan (Markdown)", type: "markdown" },
      { key: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draf" }, { value: "active", label: "Aktif" }] },
      { key: "starts_at", label: "Mulai", type: "datetime" },
      { key: "ends_at", label: "Selesai", type: "datetime" },
    ],
  },
  {
    key: "incidents",
    label: "Insiden",
    titleField: "title",
    subtitle: "Insiden untuk halaman status",
    fields: [
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "message_md", label: "Pesan (Markdown)", type: "markdown" },
      { key: "severity", label: "Severity", type: "select", options: [{ value: "degraded", label: "Penurunan Kinerja" }, { value: "major", label: "Gangguan Besar" }] },
      { key: "status", label: "Status", type: "select", options: [
        { value: "investigating", label: "Diselidiki" },
        { value: "identified", label: "Ditemukan" },
        { value: "monitoring", label: "Dipantau" },
        { value: "resolved", label: "Selesai" },
      ] },
      { key: "started_at", label: "Mulai", type: "datetime" },
      { key: "resolved_at", label: "Selesai", type: "datetime" },
    ],
  },
  {
    key: "maintenance",
    label: "Jendela Maintenance",
    titleField: "title",
    subtitle: "Jadwal maintenance untuk halaman status",
    fields: [
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "message", label: "Pesan", type: "textarea" },
      { key: "starts_at", label: "Mulai", type: "datetime", required: true },
      { key: "ends_at", label: "Selesai", type: "datetime", required: true },
      { key: "status", label: "Status", type: "select", options: [
        { value: "scheduled", label: "Terjadwal" },
        { value: "active", label: "Berlangsung" },
        { value: "completed", label: "Selesai" },
        { value: "cancelled", label: "Dibatalkan" },
      ] },
    ],
  },
];

export default function AdminCmsPage() {
  const toast = useToast();
  const [active, setActive] = useState<ResourceKey>("pages");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [blogCategories, setBlogCategories] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  const resource = RESOURCES.find((r) => r.key === active)!;

  const load = useCallback(async () => {
    const res = await apiFetch<{ rows: Row[] }>(`/api/admin/cms/${active}`);
    if (res.success && res.data) setRows(res.data.rows);
    else setError(res.error?.message ?? "Gagal memuat konten.");
    if (active === "blog") {
      const cats = await apiFetch<{ categories: { id: string; name: string }[] }>("/api/blog?pageSize=1");
      if (cats.success && cats.data) setBlogCategories(cats.data.categories);
    }
  }, [active]);

  useEffect(() => {
    setRows(null);
    setError(null);
    load();
  }, [load]);

  const openNew = () => {
    const init: Record<string, unknown> = {};
    for (const f of resource.fields) {
      init[f.key] = f.type === "boolean" ? true : f.type === "number" ? (f.emptyValue ?? 0) : "";
    }
    setForm(init);
    setEditing("new");
  };

  const openEdit = (row: Row) => {
    const init: Record<string, unknown> = {};
    for (const f of resource.fields) {
      const key = f.key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      let value = row[key] ?? row[f.key] ?? "";
      if (f.type === "datetime" && value && typeof value === "string") value = value.slice(0, 16);
      if (f.type === "json" && Array.isArray(value)) value = JSON.stringify(value, null, 2);
      if (f.type === "boolean") value = Boolean(value);
      init[f.key] = value;
    }
    setForm(init);
    setEditing(row);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    for (const f of resource.fields) {
      if (f.type === "json") {
        try {
          payload[f.key] = JSON.parse(String(payload[f.key]));
        } catch {
          toast.push("error", `Field "${f.label}" bukan JSON valid.`);
          setSaving(false);
          return;
        }
      }
      if (f.type === "number") payload[f.key] = Number(payload[f.key]) || 0;
      if (f.type === "boolean") payload[f.key] = Boolean(payload[f.key]);
      if (f.type === "datetime" && payload[f.key] === "") payload[f.key] = null;
      if ((f.type === "text" || f.type === "textarea" || f.type === "markdown") && payload[f.key] === "") payload[f.key] = "";
    }
    const res =
      editing === "new"
        ? await apiFetch(`/api/admin/cms/${active}`, { method: "POST", body: JSON.stringify(payload) })
        : await apiFetch(`/api/admin/cms/${active}/${(editing as Row).id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setSaving(false);
    if (res.success) {
      toast.push("success", editing === "new" ? "Konten dibuat." : "Konten diperbarui.");
      setEditing(null);
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const remove = async () => {
    if (!toDelete) return;
    const res = await apiFetch(`/api/admin/cms/${active}/${toDelete.id}`, { method: "DELETE" });
    if (res.success) {
      toast.push("success", "Konten dihapus.");
      load();
    } else toast.push("error", apiErrorMessage(res));
  };

  const displayTitle = (row: Row) => {
    const key = resource.titleField.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    return String(row[key] ?? row[resource.titleField] ?? "—");
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="CMS & Konten"
        description="Seluruh konten website dikelola dari sini — tanpa menyentuh kode."
        action={<Button size="sm" onClick={openNew}>Buat Baru</Button>}
      />
      <div className="flex flex-wrap gap-1 border-b border-border">
        {RESOURCES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setActive(r.key)}
            className={`-mb-px rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium ${active === r.key ? "border-accent text-primary" : "border-transparent text-muted hover:text-secondary"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{resource.subtitle}</p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!rows && !error && <LoadingState />}
      {rows && rows.length === 0 && <EmptyState title="Belum ada konten" description={`Buat ${resource.label.toLowerCase()} pertama.`} />}
      {rows && rows.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map((row) => (
            <li key={String(row.id)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{displayTitle(row)}</p>
                <p className="truncate text-xs text-muted">
                  {String(row.slug ?? row.category ?? row.status ?? "")} · diperbarui {formatDateTime(String(row.updated_at ?? ""))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.status ? <Badge tone={String(row.status) === "published" || String(row.status) === "active" || String(row.status) === "available" ? "success" : "neutral"}>{String(row.status)}</Badge> : null}
                <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setToDelete(row)}>Hapus</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={editing === "new" ? `Buat ${resource.label}` : `Edit: ${displayTitle(editing as Row)}`} wide>
          <form onSubmit={save} className="space-y-4">
            {resource.fields.map((f) => {
              const value = form[f.key];
              const label = f.label;
              if (f.type === "select") {
                const options = f.key === "category_id" && blogCategories.length ? blogCategories.map((c) => ({ value: c.id, label: c.name })) : f.options ?? [];
                if (f.key === "category_id" && blogCategories.length === 0) return null;
                return (
                  <Select key={f.key} label={label} required={f.required} value={String(value ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} hint={f.hint}>
                    <option value="">— Pilih —</option>
                    {options.map((o) => {
                      const opt = typeof o === "string" ? { value: o, label: o } : o;
                      return <option key={opt.value} value={opt.value}>{opt.label}</option>;
                    })}
                  </Select>
                );
              }
              if (f.type === "textarea" || f.type === "markdown" || f.type === "json") {
                return (
                  <Textarea key={f.key} label={label} required={f.required} rows={f.type === "json" ? 10 : 6} value={String(value ?? "")} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} hint={f.hint} />
                );
              }
              if (f.type === "boolean") {
                return (
                  <label key={f.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(value)} onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })} className="h-4 w-4 accent-accent" />
                    {label}
                  </label>
                );
              }
              return (
                <Input
                  key={f.key}
                  label={label}
                  required={f.required}
                  type={f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : "text"}
                  value={String(value ?? "")}
                  onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                  hint={f.hint}
                />
              );
            })}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title="Hapus konten?"
        message={`"${toDelete ? displayTitle(toDelete) : ""}" akan dihapus permanen.`}
      />
    </div>
  );
}
