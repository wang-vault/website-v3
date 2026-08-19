import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * SMTP untuk email authentication & transactional:
 * - Register → Email Verification
 * - Forgot Password → Reset Password
 * Tidak pernah mengklaim email terkirim jika SMTP belum dikonfigurasi.
 */

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export interface SendMailResult {
  ok: boolean;
  error?: string;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendMailResult> {
  const t = getTransporter();
  if (!t) {
    return { ok: false, error: "SMTP belum dikonfigurasi (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)." };
  }
  try {
    await t.sendMail({
      from: `"${process.env.SMTP_FROM_NAME ?? "WangStore"}" <${process.env.SMTP_FROM ?? "no-reply@wangstore.example"}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { ok: true };
  } catch (e) {
    console.error("[mail] gagal mengirim:", e instanceof Error ? e.message : e);
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengirim email." };
  }
}

function layout(title: string, body: string): string {
  return `<!doctype html><html lang="id"><body style="margin:0;padding:0;background:#f8f8f8;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;padding:32px 16px">
  <tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
  <tr><td style="padding:24px 32px;border-bottom:1px solid #e5e5e5">
  <strong style="font-size:18px;color:#111111">WangStore</strong>
  <span style="color:#888888;font-size:13px"> — Build Your Own Server.</span>
  </td></tr>
  <tr><td style="padding:32px">
  <h1 style="margin:0 0 16px;font-size:20px;color:#111111">${title}</h1>
  ${body}
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #e5e5e5;color:#888888;font-size:12px">
  Email ini dikirim otomatis oleh WangStore. Jangan membalas email ini.
  </td></tr>
  </table></td></tr></table></body></html>`;
}

export function verificationEmailHtml(url: string, siteName: string): { html: string; text: string } {
  const body = `
  <p style="margin:0 0 16px;color:#444444;font-size:14px;line-height:1.6">Halo,</p>
  <p style="margin:0 0 16px;color:#444444;font-size:14px;line-height:1.6">Terima kasih telah mendaftar di ${siteName}. Untuk mengaktifkan akun Anda, verifikasi alamat email dengan tombol di bawah:</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px">Verifikasi Email</a></p>
  <p style="margin:0 0 8px;color:#888888;font-size:13px">Tautan berlaku 24 jam dan hanya dapat dipakai sekali. Jika tombol tidak berfungsi, salin tautan ini:</p>
  <p style="margin:0;color:#888888;font-size:12px;word-break:break-all">${url}</p>`;
  return { html: layout("Verifikasi Email", body), text: `Verifikasi email Anda: ${url}` };
}

export function resetPasswordEmailHtml(url: string, siteName: string): { html: string; text: string } {
  const body = `
  <p style="margin:0 0 16px;color:#444444;font-size:14px;line-height:1.6">Halo,</p>
  <p style="margin:0 0 16px;color:#444444;font-size:14px;line-height:1.6">Kami menerima permintaan untuk mengatur ulang kata sandi akun ${siteName} Anda. Klik tombol di bawah untuk melanjutkan:</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px">Atur Ulang Kata Sandi</a></p>
  <p style="margin:0 0 8px;color:#888888;font-size:13px">Tautan berlaku 1 jam dan hanya dapat dipakai sekali. Jika Anda tidak meminta reset kata sandi, abaikan email ini.</p>
  <p style="margin:0;color:#888888;font-size:12px;word-break:break-all">${url}</p>`;
  return { html: layout("Atur Ulang Kata Sandi", body), text: `Atur ulang kata sandi Anda: ${url}` };
}

/** URL produksi untuk tautan verifikasi/reset (jangan pernah hardcode domain dev). */
export function appUrl(): string {
  const url = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return url.replace(/\/+$/, "");
}

export { smtpConfigured as isSmtpConfigured };
