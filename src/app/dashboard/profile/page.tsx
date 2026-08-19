"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/state";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

interface ProfileData {
  profile: { full_name: string; whatsapp: string; discord: string; bio: string } | null;
  user: { email: string; emailVerified: boolean; role: string };
}

export default function ProfilePage() {
  const toast = useToast();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ fullName: "", whatsapp: "", discord: "", bio: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProfileData>("/api/auth/profile").then((res) => {
      if (res.success && res.data) {
        setData(res.data);
        setForm({
          fullName: res.data.profile?.full_name ?? "",
          whatsapp: res.data.profile?.whatsapp ?? "",
          discord: res.data.profile?.discord ?? "",
          bio: res.data.profile?.bio ?? "",
        });
      } else {
        setError("Gagal memuat profil.");
      }
    });
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const res = await apiFetch("/api/auth/profile", { method: "PATCH", body: JSON.stringify(form) });
    setSavingProfile(false);
    if (res.success) toast.push("success", "Profil diperbarui.");
    else toast.push("error", apiErrorMessage(res));
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) {
      toast.push("error", "Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setSavingPw(true);
    const res = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
    });
    setSavingPw(false);
    if (res.success) {
      toast.push("success", "Kata sandi diubah.");
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <LoadingState />;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="mt-1 text-sm text-secondary">Kelola informasi akun Anda.</p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">Informasi Akun</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{data.user.email}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Status verifikasi</dt><dd>{data.user.emailVerified ? "Terverifikasi" : "Belum diverifikasi"}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Role</dt><dd className="capitalize">{data.user.role}</dd></div>
        </dl>
      </section>

      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">Data Profil</h2>
        <Input label="Nama Lengkap" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xxxxxxxxxx" hint="Dipakai untuk mengisi formulir pesanan otomatis" />
        <Input label="Discord" value={form.discord} onChange={(e) => setForm({ ...form, discord: e.target.value })} placeholder="username#0000 (opsional)" />
        <Textarea label="Bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Tentang Anda (opsional)" />
        <Button type="submit" disabled={savingProfile}>{savingProfile ? "Menyimpan…" : "Simpan Profil"}</Button>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold">Ubah Kata Sandi</h2>
        <Input label="Kata Sandi Saat Ini" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        <Input label="Kata Sandi Baru" type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} hint="Minimal 8 karakter." />
        <Input label="Konfirmasi Kata Sandi Baru" type="password" required autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <Button type="submit" disabled={savingPw}>{savingPw ? "Menyimpan…" : "Ubah Kata Sandi"}</Button>
      </form>

      <Alert tone="info">
        Data profil hanya digunakan untuk mempermudah pemesanan dan dukungan. Untuk pertanyaan terkait akun, hubungi kami melalui tiket.
      </Alert>
    </div>
  );
}
