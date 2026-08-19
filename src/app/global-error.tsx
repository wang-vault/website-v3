"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Terjadi kesalahan</h1>
            <p style={{ color: "#666", marginTop: "0.5rem" }}>Terjadi kesalahan yang tidak terduga. Silakan muat ulang halaman.</p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: "1.5rem", padding: "0.6rem 1.2rem", borderRadius: "8px", border: "1px solid #ccc", background: "#111", color: "#fff", cursor: "pointer" }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
