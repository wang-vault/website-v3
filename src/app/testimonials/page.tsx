import type { Metadata } from "next";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { Star } from "lucide-react";
import type { Testimonial } from "@/lib/types";
import { EmptyState } from "@/components/ui/state";

export const metadata: Metadata = {
  title: "Testimoni",
  description: "Testimoni pengguna WangStore. Kami hanya menampilkan testimoni nyata.",
};

export default async function TestimonialsPage() {
  const rows = await table<Testimonial>("testimonials", getDriver()).find(
    { status: "published" },
    { orderBy: [{ column: "created_at", dir: "desc" }] },
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Testimoni</h1>
      <p className="mt-2 text-secondary">
        Kami hanya menampilkan testimoni nyata dari pelanggan yang telah menggunakan layanan WangStore.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Belum ada testimoni"
            description="Testimoni akan tampil di sini setelah pelanggan membagikan pengalaman mereka."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((t) => (
            <figure key={t.id} className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex gap-0.5" aria-label={`Rating ${t.rating} dari 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < t.rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
                    aria-hidden
                  />
                ))}
              </div>
              <blockquote className="mt-3 text-sm leading-relaxed text-secondary">“{t.content}”</blockquote>
              <figcaption className="mt-4 text-sm font-medium">
                {t.name}
                {t.role && <span className="ml-2 text-xs font-normal text-muted">{t.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
