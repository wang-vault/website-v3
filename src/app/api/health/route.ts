import { getDriver, usingJsonFallback } from "@/lib/db";
import { table } from "@/lib/db/types";

/** Health check publik: status aplikasi + datastore (jujur). */
export async function GET() {
  try {
    const driver = getDriver();
    await table("settings", driver).count();
    return Response.json({
      success: true,
      data: {
        status: "ok",
        time: new Date().toISOString(),
        datastore: usingJsonFallback() ? "json-dev-fallback" : "postgres",
      },
    });
  } catch {
    return Response.json(
      { success: false, error: { code: "DB_UNAVAILABLE", message: "Database tidak tersedia." } },
      { status: 503 },
    );
  }
}
