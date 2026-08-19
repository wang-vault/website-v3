import Link from "next/link";
import { getSettings } from "@/lib/settings";

const FOOTER_LINKS = {
  Layanan: [
    { href: "/server-builder", label: "Server Builder" },
    { href: "/server-builder", label: "Paket Medium & High" },
    { href: "/server-builder", label: "Paket VPS" },
    { href: "/infrastructure", label: "Infrastruktur" },
  ],
  Informasi: [
    { href: "/about", label: "Tentang" },
    { href: "/features", label: "Fitur" },
    { href: "/why-wangstore", label: "Mengapa WangStore" },
    { href: "/blog", label: "Blog" },
    { href: "/knowledge-base", label: "Knowledge Base" },
    { href: "/status", label: "Status Layanan" },
    { href: "/testimonials", label: "Testimoni" },
  ],
  Bantuan: [
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Kontak" },
    { href: "/terms", label: "Syarat Layanan" },
    { href: "/privacy", label: "Kebijakan Privasi" },
    { href: "/refund", label: "Kebijakan Refund" },
    { href: "/sla", label: "SLA" },
    { href: "/acceptable-use", label: "Penggunaan yang Dapat Diterima" },
    { href: "/cookie-policy", label: "Kebijakan Cookie" },
  ],
};

export async function Footer() {
  const settings = await getSettings();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
                  <rect x="3" y="4" width="18" height="14" rx="2" />
                  <path d="M8 21h8M12 18v3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-base font-semibold">{settings.siteName}</span>
            </div>
            <p className="mt-3 text-sm text-secondary">{settings.siteTagline}</p>
            <p className="mt-2 max-w-xs text-sm text-muted">{settings.siteDescription}</p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <nav key={group} aria-label={`Tautan footer: ${group}`}>
              <h2 className="text-sm font-semibold">{group}</h2>
              <ul className="mt-3 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-secondary transition-colors hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.siteName}. Seluruh hak cipta dilindungi.
          </p>
          <p>WangStore adalah platform penjualan &amp; pengelolaan layanan hosting.</p>
        </div>
      </div>
    </footer>
  );
}
