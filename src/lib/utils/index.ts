/**
 * Utility dasar — EDGE-SAFE (Web Crypto, tanpa node:crypto).
 * Dipakai bersama oleh middleware (edge), API, dan komponen.
 */

function bytesToBase64url(bytes: Uint8Array): string {
  let s = "";
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getRandomBytes(n: number): Uint8Array {
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** Generate a random UUID (primary key untuk semua tabel). */
export function newId(): string {
  const b = getRandomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Token acak aman (sesi, token API). */
export function randomToken(bytes = 32): string {
  return bytesToBase64url(getRandomBytes(bytes));
}

/** Human-friendly identifier seperti WS-8K2F4Q atau SVC-9PL0M1. */
export function shortCode(prefix: string, length = 8): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = getRandomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}-${out}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addDaysIso(base: Date | string, days: number): string {
  const d = base instanceof Date ? new Date(base) : new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function addMinutesIso(base: Date | string, minutes: number): string {
  const d = base instanceof Date ? new Date(base) : new Date(base);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString();
}

export function isIsoAfter(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function isIsoBefore(a: string, b: string): boolean {
  return new Date(a).getTime() < new Date(b).getTime();
}

export function isIsoSameOrBefore(a: string, b: string): boolean {
  return new Date(a).getTime() <= new Date(b).getTime();
}

export function isIsoSameOrAfter(a: string, b: string): boolean {
  return new Date(a).getTime() >= new Date(b).getTime();
}

export function daysBetween(fromIso: string, toIso: string): number {
  const diff = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.floor(diff / 86_400_000);
}
