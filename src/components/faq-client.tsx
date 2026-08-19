"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Markdown } from "@/components/markdown";

export function FaqClient({ items }: { items: { id: string; question: string; answer: string }[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mt-4 divide-y divide-border rounded-2xl border border-border bg-bg">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium hover:bg-surface"
            >
              {item.question}
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open && (
              <div className="px-5 pb-5">
                <Markdown content={item.answer} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
