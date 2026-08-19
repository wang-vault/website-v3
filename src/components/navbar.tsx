import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { MobileNavClient } from "@/components/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { ButtonLink } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/server-builder", label: "Server Builder" },
  { href: "/features", label: "Fitur" },
  { href: "/blog", label: "Blog" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/status", label: "Status" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Kontak" },
] as const;

export async function Navbar() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="WangStore — Beranda">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden>
              <rect x="3" y="4" width="18" height="14" rx="2" />
              <path d="M8 21h8M12 18v3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight">WangStore</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi utama">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <>
              <ButtonLink href="/dashboard" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Dashboard
              </ButtonLink>
              <ButtonLink href="/server-builder" size="sm">
                Buat Server
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Masuk
              </ButtonLink>
              <ButtonLink href="/server-builder" size="sm">
                Buat Server
              </ButtonLink>
            </>
          )}
          <MobileNav userLoggedIn={!!user} />
        </div>
      </div>
    </header>
  );
}

function MobileNav({ userLoggedIn }: { userLoggedIn: boolean }) {
  return <MobileNavClient userLoggedIn={userLoggedIn} />;
}

export function NavbarFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg">WS</span>
          <span className="text-base font-semibold">WangStore</span>
        </span>
      </div>
    </header>
  );
}
