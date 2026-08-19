import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/contact-form";
import { MessageCircle, Mail, MessageSquare, LifeBuoy } from "lucide-react";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi WangStore melalui WhatsApp, Discord, email, atau tiket dukungan.",
};

export default async function ContactPage() {
  const settings = await getSettings();
  const channels = [
    {
      icon: MessageCircle,
      title: "WhatsApp",
      value: settings.whatsappNumber ? `+${settings.whatsappNumber}` : null,
      href: settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : null,
      note: settings.whatsappNumber ? "Respons tercepat" : "Belum dikonfigurasi",
    },
    {
      icon: MessageSquare,
      title: "Discord",
      value: settings.discordUrl ? "Server komunitas" : null,
      href: settings.discordUrl || null,
      note: settings.discordUrl ? "Diskusi komunitas" : "Belum dikonfigurasi",
    },
    {
      icon: Mail,
      title: "Email",
      value: settings.emailPublic || null,
      href: settings.emailPublic ? `mailto:${settings.emailPublic}` : null,
      note: settings.emailPublic ? "Untuk pertanyaan formal" : "Belum dikonfigurasi",
    },
    {
      icon: LifeBuoy,
      title: "Tiket Dukungan",
      value: "Formulir di bawah",
      href: null,
      note: "Selalu tersedia",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Hubungi Kami</h1>
      <p className="mt-2 max-w-2xl text-secondary">
        {settings.contactNote} Konsultasi pra-pembelian sangat disarankan sebelum memesan — pembelian bersifat final.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {channels.map((ch) => {
          const Icon = ch.icon;
          const inner = (
            <>
              <Icon className="h-5 w-5 text-secondary" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold">{ch.title}</h2>
              <p className="mt-1 text-sm text-secondary">{ch.value ?? "—"}</p>
              <p className="mt-1 text-xs text-muted">{ch.note}</p>
            </>
          );
          return ch.href ? (
            <a key={ch.title} href={ch.href} target={ch.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-muted">
              {inner}
            </a>
          ) : (
            <div key={ch.title} className="rounded-2xl border border-border bg-surface p-5">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="text-xl font-semibold">Konsultasi sebelum memesan</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">
            Tidak yakin dengan spesifikasi atau paket yang tepat? Kirim pesan melalui formulir di samping —
            pesan Anda masuk sebagai tiket dan tim kami akan merespons melalui email atau WhatsApp.
          </p>
          <p className="mt-4 text-xs text-muted">
            Pesan yang Anda kirim akan tercatat sebagai tiket dengan nomor referensi. Anda dapat melacaknya di
            dashboard setelah masuk dengan akun.
          </p>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
