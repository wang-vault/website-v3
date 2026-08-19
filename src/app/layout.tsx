import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { getSettings } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth/session";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: {
      default: settings.seoTitle || settings.siteName,
      template: `%s — ${settings.siteName}`,
    },
    description: settings.seoDescription,
    openGraph: {
      type: "website",
      siteName: settings.siteName,
      title: settings.seoTitle,
      description: settings.seoDescription,
      url: base,
    },
    twitter: {
      card: "summary",
      title: settings.seoTitle,
      description: settings.seoDescription,
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, user] = await Promise.all([getSettings(), getSessionUser()]);

  // Maintenance mode untuk halaman (API ditangani terpisah di helper).
  let maintenanceActive = false;
  if (settings.maintenanceEnabled) {
    const isStaff = user && ["owner", "admin", "staff"].includes(user.roleSlug);
    if (!isStaff) maintenanceActive = true;
  }

  return (
    <html lang="id" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-primary antialiased">
        <a
          href="#konten-utama"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
        >
          Lewati ke konten utama
        </a>
        {maintenanceActive ? (
          <main id="konten-utama" className="flex flex-1 items-center justify-center px-4">
            <MaintenanceNotice settings={settings} />
          </main>
        ) : (
          <>
            <Navbar />
            <main id="konten-utama" className="flex-1">
              {children}
            </main>
            <Footer />
          </>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: settings.siteName,
              slogan: settings.siteTagline,
              description: settings.siteDescription,
              url: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000",
            }),
          }}
        />
      </body>
    </html>
  );
}

function MaintenanceNotice({ settings }: { settings: Awaited<ReturnType<typeof getSettings>> }) {
  return (
    <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6 text-secondary" aria-hidden>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </span>
      <h1 className="mt-4 text-xl font-semibold">{settings.maintenanceTitle || "Pemeliharaan Terjadwal"}</h1>
      <p className="mt-2 text-sm text-secondary">{settings.maintenanceMessage || "Kami akan segera kembali."}</p>
      {settings.maintenanceUntil && (
        <p className="mt-4 text-xs text-muted">
          Perkiraan selesai: {new Date(String(settings.maintenanceUntil)).toLocaleString("id-ID")}
        </p>
      )}
    </div>
  );
}
