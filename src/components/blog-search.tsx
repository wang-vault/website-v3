"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function BlogSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/blog${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-xl gap-2" role="search">
      <label htmlFor="blog-search" className="sr-only">
        Cari artikel
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="blog-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari artikel…"
          className="w-full rounded-lg border border-border bg-bg py-2.5 pl-9 pr-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </div>
      <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg hover:opacity-90">
        Cari
      </button>
    </form>
  );
}
