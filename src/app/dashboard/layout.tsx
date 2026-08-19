import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Server,
  Bookmark,
  LifeBuoy,
  Ticket,
  Bell,
  User as UserIcon,
  BookOpen,
  MessageCircle,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar, type SidebarItem } from "@/components/ui/sidebar";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s — Dashboard" },
  robots: { index: false, follow: false },
};

const ITEMS: SidebarItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: <LayoutDashboard className="h-4 w-4" aria-hidden />, exact: true },
  { href: "/dashboard/orders", label: "Pesanan", icon: <ShoppingBag className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/services", label: "Layanan Saya", icon: <Server className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/saved", label: "Konfigurasi Tersimpan", icon: <Bookmark className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/tickets", label: "Tiket", icon: <LifeBuoy className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/coupons", label: "Kupon", icon: <Ticket className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/notifications", label: "Notifikasi", icon: <Bell className="h-4 w-4" aria-hidden /> },
  { href: "/dashboard/profile", label: "Profil", icon: <UserIcon className="h-4 w-4" aria-hidden /> },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const settings = await getSettings();

  const extraItems: SidebarItem[] = [
    { href: "/knowledge-base", label: "Knowledge Base", icon: <BookOpen className="h-4 w-4" aria-hidden /> },
  ];
  if (settings.whatsappNumber) {
    extraItems.push({ href: `https://wa.me/${settings.whatsappNumber}`, label: "WhatsApp", icon: <MessageCircle className="h-4 w-4" aria-hidden /> });
  }
  if (settings.discordUrl) {
    extraItems.push({ href: settings.discordUrl, label: "Discord", icon: <MessageSquare className="h-4 w-4" aria-hidden /> });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      <Sidebar
        title="Menu"
        items={[...ITEMS, ...extraItems]}
        footer={
          <div className="space-y-3 px-3">
            <p className="text-xs text-muted">
              Masuk sebagai <span className="font-medium text-secondary">{user.email}</span>
            </p>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-surface-muted">
                <LogOut className="h-4 w-4" aria-hidden /> Keluar
              </button>
            </form>
            {user.roleSlug !== "customer" && (
              <Link href="/admin" className="block rounded-lg bg-surface-muted px-3 py-2 text-sm font-medium text-secondary hover:text-primary">
                Buka Admin Panel
              </Link>
            )}
          </div>
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
