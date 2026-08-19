import Link from "next/link";
import type { PageSection } from "@/lib/types";
import { Markdown } from "@/components/markdown";

/** Renderer section CMS (hero/heading/paragraph/list/cta/card). */
export function SectionRenderer({ sections }: { sections: PageSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section, idx) => (
        <SectionView key={idx} section={section} />
      ))}
    </div>
  );
}

function SectionView({ section }: { section: PageSection }) {
  switch (section.type) {
    case "hero":
      return (
        <div className="mx-auto max-w-3xl py-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{section.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary">{section.subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {section.ctaHref && (
              <Link
                href={section.ctaHref}
                className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
              >
                {section.ctaLabel}
              </Link>
            )}
            {section.ctaSecondaryHref && (
              <Link
                href={section.ctaSecondaryHref}
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-secondary transition-colors hover:bg-surface-muted"
              >
                {section.ctaSecondaryLabel}
              </Link>
            )}
          </div>
        </div>
      );
    case "heading":
      return <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{section.text}</h2>;
    case "paragraph":
      return <Markdown content={section.text} />;
    case "list":
      return (
        <div>
          {section.title && <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>}
          <ul className="space-y-2.5">
            {section.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-secondary">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "cta":
      return (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-secondary">{section.description}</p>
          {section.href && (
            <Link
              href={section.href}
              className="mt-6 inline-flex rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              {section.label}
            </Link>
          )}
        </div>
      );
    case "card":
      return (
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h3 className="text-base font-semibold">{section.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-secondary">{section.description}</p>
        </div>
      );
  }
}
