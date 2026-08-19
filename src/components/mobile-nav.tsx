"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/server-builder", label: "Server Builder" },
  { href: "/features", label: "Fitur" },
  { href: "/blog", label: "Blog" },
  { href: "/knowledge-base", label: "Knowledge Base" },
  { href: "/status", label: "Status" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Kontak" },
] as const;

export function MobileNavClient({ userLoggedIn }: { userLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Tutup menu navigasi" : "Buka menu navigasi"}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary hover:text-primary"
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>
      {open && (
        <nav
          className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-border bg-bg p-2 shadow-lg"
          aria-label="Navigasi mobile"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-secondary hover:bg-surface-muted hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 border-t border-border" />
          {userLoggedIn ? (
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-primary hover:bg-surface-muted"
            >
              Masuk
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
