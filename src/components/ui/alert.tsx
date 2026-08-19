import type { ReactNode } from "react";

/** Alert presentasional — aman untuk Server Component. */
export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
    warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
