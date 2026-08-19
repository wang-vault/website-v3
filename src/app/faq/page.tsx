import type { Metadata } from "next";
import { getActiveFaqs } from "@/lib/store/content";
import { FaqClient } from "@/components/faq-client";
import { Markdown } from "@/components/markdown";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Pertanyaan yang sering diajukan tentang WangStore: pemesanan, pembayaran, layanan, dan kebijakan.",
};

export default async function FaqPage() {
  const faqs = await getActiveFaqs();
  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Pertanyaan yang Sering Diajukan</h1>
      <p className="mt-2 text-secondary">
        Jawaban singkat untuk pertanyaan umum. Tidak menemukan jawaban? Kunjungi{" "}
        <a href="/contact" className="underline underline-offset-2">halaman Kontak</a>.
      </p>

      {categories.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-secondary">
          Belum ada pertanyaan yang dipublikasikan.
        </p>
      ) : (
        categories.map((category) => (
          <section key={category} className="mt-10" aria-label={category}>
            <h2 className="text-xl font-semibold">{category}</h2>
            <FaqClient
              items={faqs
                .filter((f) => f.category === category)
                .map((f) => ({ id: f.id, question: f.question, answer: f.answer_md }))}
            />
          </section>
        ))
      )}

      <div className="mt-12 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold">Masih ada pertanyaan?</h2>
        <div className="mt-2 prose-cms text-sm">
          <Markdown content="Hubungi tim kami melalui halaman [Kontak](/contact) atau buka tiket dari dashboard setelah masuk." />
        </div>
      </div>
    </div>
  );
}
