/** Format angka Rupiah. Seluruh harga internal disimpan sebagai integer IDR. */
export function formatIDR(value: number): string {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

/** Format tanggal Indonesia (lokal server). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Durasi relatif dalam Bahasa Indonesia. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso);
}

/** Sisa masa layanan dalam format "X hari" / "X jam". */
export function remainingDuration(expiresAtIso: string, now = new Date()): string {
  const ms = new Date(expiresAtIso).getTime() - now.getTime();
  if (ms <= 0) return "Telah berakhir";
  const days = Math.floor(ms / 86_400_000);
  if (days > 0) return `${days} hari`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours > 0) return `${hours} jam`;
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return `${minutes} menit`;
}

export function readingTime(markdown: string): number {
  const words = markdown
    .replace(/[#>*`_\-\[\]()!]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Snap ke grid step (floor), dimulai dari minimum. */
export function snapToStep(value: number, min: number, step: number, max: number): number {
  if (step <= 0) return clamp(value, min, max);
  const snapped = min + Math.floor((value - min) / step) * step;
  return clamp(snapped, min, max);
}

export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}
