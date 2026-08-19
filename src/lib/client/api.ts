"use client";

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; retryAfterSec?: number; details?: unknown };
}

let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/csrf", { credentials: "same-origin" });
  const body = (await res.json()) as ApiResult<{ token: string }>;
  if (body.success && body.data) {
    csrfToken = body.data.token;
  }
  return csrfToken ?? "";
}

/**
 * Fetch helper untuk client: CSRF double-submit + error terstruktur.
 * Harga/status dari server tidak pernah dipercaya dari client.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const isMutation = options.method && !["GET", "HEAD"].includes(options.method);
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  if (isMutation) {
    const token = await getCsrfToken();
    headers["x-csrf-token"] = token;
  }
  try {
    const res = await fetch(path, { ...options, headers, credentials: "same-origin" });
    const body = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!body) {
      return { success: false, error: { code: "NETWORK_ERROR", message: "Respons tidak valid dari server." } };
    }
    return body;
  } catch {
    return { success: false, error: { code: "NETWORK_ERROR", message: "Tidak dapat terhubung ke server. Periksa koneksi Anda." } };
  }
}

export function apiErrorMessage(result: ApiResult<unknown>): string {
  return result.error?.message ?? "Terjadi kesalahan. Silakan coba lagi.";
}
