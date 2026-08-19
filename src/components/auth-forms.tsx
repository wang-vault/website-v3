"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-secondary">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await apiFetch<{ user: { isStaff: boolean } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.success && res.data) {
      router.push(res.data.user.isStaff ? "/admin" : "/dashboard");
      router.refresh();
    } else {
      const err = apiErrorMessage(res);
      setError(err);
      if (err.toLowerCase().includes("verifikasi")) setInfo("Periksa email Anda untuk tautan verifikasi.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input label="Kata Sandi" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="info">{info}</Alert>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Memproses…" : "Masuk"}
      </Button>
      <p className="text-center text-sm text-muted">
        Belum punya akun?{" "}
        <Link href="/register" className="font-medium text-primary underline underline-offset-2">Daftar</Link> ·{" "}
        <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-2">Lupa kata sandi</Link>
      </p>
    </form>
  );
}

export function LoginPage() {
  return (
    <AuthShell title="Masuk" subtitle="Masuk untuk mengakses dashboard, pesanan, dan layanan Anda.">
      <LoginForm />
    </AuthShell>
  );
}

export function RegisterForm() {
  const [form, setForm] = useState({ fullName: "", email: "", whatsapp: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ message: string; devLink?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    if (form.password !== form.confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      setLoading(false);
      return;
    }
    const res = await apiFetch<{ message: string; emailSent: boolean; emailError?: string | null; devLink?: string | null }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify({ fullName: form.fullName, email: form.email, whatsapp: form.whatsapp, password: form.password }) },
    );
    setLoading(false);
    if (res.success && res.data) {
      setInfo({
        message: res.data.message + (res.data.emailSent ? "" : " " + (res.data.emailError ?? "")),
        devLink: res.data.devLink ?? null,
      });
      setForm({ fullName: "", email: "", whatsapp: "", password: "", confirm: "" });
    } else {
      setError(apiErrorMessage(res));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Nama Lengkap" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xxxxxxxxxx (opsional)" />
      <Input label="Kata Sandi" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="Minimal 8 karakter." />
      <Input label="Konfirmasi Kata Sandi" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      {error && <Alert tone="error">{error}</Alert>}
      {info && (
        <div className="space-y-3">
          <Alert tone="info">{info.message}</Alert>
          {info.devLink && (
            <Alert tone="warning" title="Mode Pengembangan (SMTP belum dikonfigurasi)">
              <p>Tautan verifikasi (hanya tampil di development):</p>
              <a href={info.devLink} className="mt-1 block break-all text-xs underline underline-offset-2">
                {info.devLink}
              </a>
            </Alert>
          )}
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Mendaftar…" : "Daftar"}
      </Button>
      <p className="text-center text-sm text-muted">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">Masuk</Link>
      </p>
    </form>
  );
}

export function RegisterPage() {
  return (
    <AuthShell title="Daftar" subtitle="Buat akun untuk menyimpan konfigurasi, melacak pesanan, dan membuka tiket dukungan.">
      <RegisterForm />
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ message: string; devLink?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await apiFetch<{ message: string; devLink?: string | null }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.success && res.data) {
      setInfo({ message: res.data.message, devLink: res.data.devLink ?? null });
    } else {
      setError(apiErrorMessage(res));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
      {error && <Alert tone="error">{error}</Alert>}
      {info && (
        <div className="space-y-3">
          <Alert tone="info">{info.message}</Alert>
          {info.devLink && (
            <Alert tone="warning" title="Mode Pengembangan (SMTP belum dikonfigurasi)">
              <a href={info.devLink} className="block break-all text-xs underline underline-offset-2">{info.devLink}</a>
            </Alert>
          )}
        </div>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Mengirim…" : "Kirim Tautan Reset"}
      </Button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">Kembali ke Masuk</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordPage() {
  return (
    <AuthShell title="Lupa Kata Sandi" subtitle="Masukkan email terdaftar; kami akan mengirim tautan untuk mengatur ulang kata sandi.">
      <ForgotPasswordForm />
    </AuthShell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (form.password !== form.confirm) {
      setError("Konfirmasi kata sandi tidak cocok.");
      setLoading(false);
      return;
    }
    const res = await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: form.password }),
    });
    setLoading(false);
    if (res.success) {
      setInfo("Kata sandi berhasil diubah. Silakan masuk.");
      setTimeout(() => router.push("/login"), 1500);
    } else {
      setError(apiErrorMessage(res));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Kata Sandi Baru" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint="Minimal 8 karakter." />
      <Input label="Konfirmasi Kata Sandi Baru" type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      {error && <Alert tone="error">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Menyimpan…" : "Atur Ulang Kata Sandi"}
      </Button>
    </form>
  );
}

export function ResetPasswordPage({ token }: { token: string }) {
  return (
    <AuthShell title="Atur Ulang Kata Sandi" subtitle="Tentukan kata sandi baru untuk akun Anda.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

export function VerifyEmailClient({ token }: { token: string }) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);

  const verify = async () => {
    setDone(true);
    const res = await apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
    if (res.success) {
      setState("success");
      setMessage("Email berhasil diverifikasi. Silakan masuk.");
    } else {
      setState("error");
      setMessage(apiErrorMessage(res));
    }
  };

  if (!done) {
    void verify();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      {state === "loading" && <p className="text-secondary">Memverifikasi email…</p>}
      {state === "success" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Email Terverifikasi</h1>
          <p className="mt-2 text-secondary">{message}</p>
          <Link href="/login" className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-bg hover:opacity-90">
            Masuk
          </Link>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">Verifikasi Gagal</h1>
          <p className="mt-2 text-secondary">{message}</p>
          <Link href="/login" className="mt-6 rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-surface-muted">
            Kembali ke Masuk
          </Link>
        </>
      )}
    </div>
  );
}
