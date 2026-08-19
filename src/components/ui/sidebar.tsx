"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface SidebarItem {
  href: string;
  label: string;
  icon?: ReactNode;
  exact?: boolean;
}

export function Sidebar({ items, title, footer }: { items: SidebarItem[]; title: string; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <aside className="w-full shrink-0 lg:w-60">
      <div className="rounded-2xl border border-border bg-surface p-3">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <nav className="flex flex-row flex-wrap gap-1 lg:flex-col" aria-label={title}>
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent font-medium text-bg"
                    : "text-secondary hover:bg-surface-muted hover:text-primary"
                }`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="whitespace-nowrap lg:whitespace-normal">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {footer && <div className="mt-3 border-t border-border pt-3">{footer}</div>}
      </div>
    </aside>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-2 py-1 text-xs text-bg group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}
