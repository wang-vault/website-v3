import Link from "next/link";
import type { Metadata } from "next";
import { getPageBySlug, getActiveFaqs, renderPageSections } from "@/lib/store/content";
import { getSettings } from "@/lib/settings";
import { getTiers, getVisiblePackages, getVpsPackages } from "@/lib/store/catalog";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { SectionRenderer } from "@/components/sections";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/utils/format";
import { ArrowRight, Gauge, Server, ShieldCheck, Wallet } from "lucide-react";
import type { Announcement, Testimonial } from "@/lib/types";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return { title: settings.seoTitle, description: settings.seoDescription };
}

export default async function HomePage() {
  const [settings, page, faqs, tiers, mediumPackages, highPackages, vpsPackages, announcements, testimonials] =
    await Promise.all([
      getSettings(),
      getPageBySlug("home"),
      getActiveFaqs(),
      getTiers(),
      getVisiblePackages("medium"),
      getVisiblePackages("high"),
      getVpsPackages(true),
      table<Announcement>("announcements", getDriver()).find(
        { status: "active" },
        { orderBy: [{ column: "created_at", dir: "desc" }] },
      ),
      table<Testimonial>("testimonials", getDriver()).find(
        { status: "published" },
        { orderBy: [{ column: "created_at", dir: "desc" }], limit: 3 },
      ),
    ]);

  const sections = renderPageSections(page?.sections);
  const hero = sections.find((s) => s.type === "hero");
  const activeAnnouncements = announcements.filter(
    (a) => (!a.starts_at || a.starts_at <= new Date().toISOString()) && (!a.ends_at || a.ends_at >= new Date().toISOString()),
  );
  return (
    <div>
      {activeAnnouncements.map((a) => (
        <div key={a.id} className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-2.5 text-center text-sm sm:px-6">
            <span className="font-medium">{a.title}</span>
            {a.message_md && <span className="text-secondary"> — {a.message_md.replace(/[#*`]/g, "").slice(0, 160)}</span>}
          </div>
        </div>
      ))}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="neutral" className="mb-5">{settings.siteTagline}</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {hero && hero.type === "hero" ? hero.title : "Bangun Server Anda Sendiri."}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-secondary">
            {hero && hero.type === "hero"
              ? hero.subtitle
              : "WangStore adalah platform pemesanan layanan hosting — Minecraft hosting, VPS, dan dedicated server. Pilih spesifikasi, lihat harga real-time, dan pesan dalam hitungan menit."}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/server-builder"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              Buat Server <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/server-builder"
              className="inline-flex items-center rounded-lg border border-border px-7 py-3.5 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted"
            >
              Lihat Paket
            </Link>
          </div>
        </div>
      </section>

      {/* Keunggulan cepat */}
      <section className="border-y border-border bg-surface" aria-label="Keunggulan">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {[
            { icon: Wallet, title: "Harga Transparan", desc: "Total terlihat sebelum memesan, dihitung ulang oleh server." },
            { icon: Gauge, title: "Estimasi Real-time", desc: "TPS, pemain, dan beban diperkirakan dari konfigurasi Anda." },
            { icon: Server, title: "Server Builder", desc: "Low custom, Medium & High dari katalog paket terkelola." },
            { icon: ShieldCheck, title: "Kebijakan Tertulis", desc: "Syarat, privasi, refund, dan SLA tersedia secara terbuka." },
          ].map((f) => (
            <div key={f.title} className="p-6">
              <f.icon className="h-5 w-5 text-secondary" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-secondary">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cara kerja */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Cara Kerja WangStore</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { step: "1", title: "Pilih Konfigurasi", desc: "Gunakan Server Builder: pilih Tier, atur CPU, RAM, dan penyimpanan. Harga dan estimasi tampil real-time." },
            { step: "2", title: "Buat Pesanan", desc: "Isi informasi kontak, terapkan kupon bila ada, dan kirim. Ringkasan otomatis dibuat untuk WhatsApp." },
            { step: "3", title: "Konfirmasi & Aktif", desc: "Tim meninjau pesanan, mengonfirmasi pembayaran, lalu layanan diaktifkan sesuai jadwal aktivasi." },
          ].map((s) => (
            <div key={s.step} className="rounded-2xl border border-border bg-surface p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-bg">{s.step}</span>
              <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tier & paket */}
      <section id="paket" className="border-y border-border bg-surface py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Pilih Cara Membangun</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-secondary">
            Tier Low untuk konfigurasi custom. Tier Medium dan High berisi paket yang dikelola tim WangStore dari database.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {tiers.map((tier) => (
              <div key={tier.id} className="flex flex-col rounded-2xl border border-border bg-bg p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{tier.name}</h3>
                  <Badge tone={tier.mode === "custom" ? "accent" : "neutral"}>
                    {tier.mode === "custom" ? "Custom" : "Paket"}
                  </Badge>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-secondary">{tier.description}</p>
                <Link
                  href="/server-builder"
                  className="mt-5 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted"
                >
                  Mulai dari {tier.slug === "low" ? formatIDR(50000) : formatIDR(tier.slug === "medium" ? (mediumPackages[0]?.price ?? 0) : (highPackages[0]?.price ?? 0))}/bln
                </Link>
              </div>
            ))}
          </div>

          {/* Pratinjau paket Medium/High (hanya jika ada di database) */}
          {(mediumPackages.length > 0 || highPackages.length > 0) && (
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {(["medium", "high"] as const).map((tierSlug) => {
                const list = tierSlug === "medium" ? mediumPackages : highPackages;
                if (list.length === 0) return null;
                const popular = list.find((p) => p.popular) ?? list[0];
                return (
                  <div key={tierSlug} className="rounded-2xl border border-border bg-bg p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">Tier {tierSlug === "medium" ? "Medium" : "High"}</h3>
                      <Link href="/server-builder" className="text-sm font-medium underline underline-offset-2">
                        Lihat semua
                      </Link>
                    </div>
                    <div className="mt-4 rounded-xl border border-border bg-surface p-5">
                      {popular.popular_label && <Badge tone="accent" className="mb-2">{popular.popular_label}</Badge>}
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-semibold">{popular.name}</p>
                        <p className="text-lg font-semibold tabular-nums">{formatIDR(popular.price)}<span className="text-xs font-normal text-muted">/bln</span></p>
                      </div>
                      <p className="mt-2 text-sm text-secondary">
                        {popular.cpu} vCore · {popular.ram} GB RAM · {popular.storage} GB Penyimpanan
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pratinjau VPS */}
          {vpsPackages.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Paket VPS</h3>
                <Link href="/server-builder" className="text-sm font-medium underline underline-offset-2">
                  Lihat semua
                </Link>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vpsPackages.slice(0, 3).map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-surface p-5">
                    <p className="font-semibold">{p.name}</p>
                    <p className="mt-1 text-sm text-secondary">
                      {p.cpu} vCore · {p.ram} GB · {p.storage} GB
                      {p.location ? ` · ${p.location}` : ""}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums">{formatIDR(p.price)}<span className="text-xs font-normal text-muted">/bln</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Estimasi & jujur soal estimasi */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface p-8 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">Estimasi, bukan janji</h2>
          <p className="mt-3 max-w-2xl text-secondary">
            Server Builder menampilkan estimasi TPS, pemain konkuren, beban CPU, penggunaan RAM, dan rekomendasi
            plugin berdasarkan konfigurasi Anda. Semua angka berlabel <strong>estimasi</strong> — bukan SLA atau
            jaminan performa. Kami tidak membuat klaim yang tidak dapat kami penuhi.
          </p>
          <Link href="/server-builder" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90">
            Coba Server Builder <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* FAQ ringkas */}
      {faqs.length > 0 && (
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Pertanyaan Umum</h2>
            <div className="mt-8 space-y-3">
              {faqs.slice(0, 4).map((f) => (
                <details key={f.id} className="rounded-2xl border border-border bg-surface">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {f.question}
                  </summary>
                  <div className="px-5 pb-4 text-sm text-secondary">{f.answer_md.replace(/[#*`\[\]()]/g, "").slice(0, 200)}</div>
                </details>
              ))}
            </div>
            <p className="mt-6 text-center text-sm">
              <Link href="/faq" className="font-medium underline underline-offset-2">Lihat semua FAQ</Link>
            </p>
          </div>
        </section>
      )}

      {/* Testimoni nyata (hanya jika ada) */}
      {testimonials.length > 0 && (
        <section className="border-t border-border bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight">Testimoni</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.map((t) => (
                <figure key={t.id} className="rounded-2xl border border-border bg-bg p-6">
                  <blockquote className="text-sm text-secondary">“{t.content.slice(0, 200)}”</blockquote>
                  <figcaption className="mt-3 text-sm font-medium">{t.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl bg-accent p-10 text-center text-bg sm:p-14">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Siap membangun server Anda?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm opacity-80">
            Buka Server Builder, pilih spesifikasi, dan lihat harga serta estimasi performa secara real-time.
          </p>
          <Link
            href="/server-builder"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-bg px-7 py-3.5 text-sm font-medium text-accent transition-opacity hover:opacity-90"
          >
            Buat Server <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Section CMS tambahan (editable) */}
      {sections.filter((s) => s.type !== "hero").length > 0 && (
        <section className="border-t border-border py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <SectionRenderer sections={sections.filter((s) => s.type !== "hero")} />
          </div>
        </section>
      )}
    </div>
  );
}
