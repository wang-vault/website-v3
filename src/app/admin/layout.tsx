import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Server,
  Boxes,
  Calculator,
  TicketPercent,
  LifeBuoy,
  FileText,
  BarChart3,
  ScrollText,
  Settings,
  UserCog,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { Sidebar, type SidebarItem } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — Admin" },
  robots: { index: false, follow: false },
};

const ITEMS: SidebarItem[] = [
  { href: "/admin", label: "Ringkasan", icon: <LayoutDashboard className="h-4 w-4" aria-hidden />, exact: true },
  { href: "/admin/orders", label: "Pesanan", icon: <ShoppingBag className="h-4 w-4" aria-hidden /> },
  { href: "/admin/customers", label: "Pelanggan", icon: <Users className="h-4 w-4" aria-hidden /> },
  { href: "/admin/services", label: "Layanan", icon: <Server className="h-4 w-4" aria-hidden /> },
  { href: "/admin/vps", label: "VPS Packages", icon: <Boxes className="h-4 w-4" aria-hidden /> },
  { href: "/admin/packages", label: "Paket Medium/High", icon: <Boxes className="h-4 w-4" aria-hidden /> },
  { href: "/admin/pricing", label: "Formula Harga", icon: <Calculator className="h-4 w-4" aria-hidden /> },
  { href: "/admin/coupons", label: "Kupon & Promosi", icon: <TicketPercent className="h-4 w-4" aria-hidden /> },
  { href: "/admin/tickets", label: "Tiket & Kontak", icon: <LifeBuoy className="h-4 w-4" aria-hidden /> },
  { href: "/admin/cms", label: "CMS & Konten", icon: <FileText className="h-4 w-4" aria-hidden /> },
  { href: "/admin/analytics", label: "Analitik", icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
  { href: "/admin/audit", label: "Audit Log", icon: <ScrollText className="h-4 w-4" aria-hidden /> },
  { href: "/admin/users", label: "Pengguna & Role", icon: <UserCog className="h-4 w-4" aria-hidden /> },
  { href: "/admin/settings", label: "Pengaturan", icon: <Settings className="h-4 w-4" aria-hidden /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!["owner", "admin", "staff"].includes(user.roleSlug)) redirect("/dashboard");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row">
      <Sidebar
        title="Admin Panel"
        items={ITEMS}
        footer={
          <div className="space-y-2 px-3">
            <p className="text-xs text-muted">
              <span className="font-medium capitalize text-secondary">{user.roleName}</span> · {user.email}
            </p>
            <Link href="/dashboard" className="block text-xs font-medium underline underline-offset-2">
              Buka Dashboard Pelanggan
            </Link>
          </div>
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
