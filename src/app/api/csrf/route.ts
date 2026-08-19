import { CSRF_COOKIE } from "@/lib/security";

/** Kembalikan token CSRF (bagian dari cookie bertanda tangan) untuk header x-csrf-token. */
export async function GET() {
  const cookie = (await import("next/headers")).cookies().get(CSRF_COOKIE)?.value;
  if (!cookie) {
    return Response.json({ success: false, error: { code: "CSRF_MISSING", message: "Cookie keamanan belum tersedia." } }, { status: 400 });
  }
  const dot = cookie.lastIndexOf(".");
  const token = dot > 0 ? cookie.slice(0, dot) : cookie;
  return Response.json({ success: true, data: { token } });
}
