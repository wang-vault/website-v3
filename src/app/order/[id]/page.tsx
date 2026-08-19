import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDriver } from "@/lib/db";
import { table } from "@/lib/db/types";
import { getOrderById, getOrderItems } from "@/lib/store/orders";
import { formatIDR, formatDateTime } from "@/lib/utils/format";
import { buildOrderWhatsAppMessage, waMeUrl } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { OrderStatusBadge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { MessageCircle } from "lucide-react";
import type { OrderItem, ServiceInstance } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pesanan",
  robots: { index: false, follow: false },
};

export default async function OrderPage({ params }: { params: { id: string } }) {
  const order = await getOrderById(params.id);
  if (!order) notFound();
  const [items, services, settings] = await Promise.all([
    getOrderItems(order.id),
    table<ServiceInstance>("service_instances", getDriver()).find({ order_id: order.id }),
    getSettings(),
  ]);
  const item: OrderItem | undefined = items[0];
  const waMessage = buildOrderWhatsAppMessage(order);
  const whatsappUrl = settings.whatsappNumber ? waMeUrl(settings.whatsappNumber, waMessage) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Konfirmasi Pesanan</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.order_number}</h1>
      <div className="mt-3 flex items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <span className="text-xs text-muted">Dibuat {formatDateTime(order.created_at)}</span>
      </div>

      <Alert tone="warning" title="Peringatan Pembelian">
        Pembelian bersifat final sesuai{" "}
        <Link href="/refund" className="underline underline-offset-2">Kebijakan Refund</Link> dan{" "}
        <Link href="/sla" className="underline underline-offset-2">SLA</Link>. Pastikan spesifikasi sudah benar.
      </Alert>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5" aria-label="Detail pelanggan">
          <h2 className="text-sm font-semibold">Pelanggan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Nama</dt><dd className="text-right">{order.customer_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">WhatsApp</dt><dd className="text-right">{order.customer_whatsapp}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="break-all text-right">{order.customer_email}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5" aria-label="Detail layanan">
          <h2 className="text-sm font-semibold">Layanan</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Tier</dt><dd>{order.tier_name}</dd></div>
            {order.package_name && (
              <div className="flex justify-between gap-3"><dt className="text-muted">Paket</dt><dd>{order.package_name}</dd></div>
            )}
            <div className="flex justify-between gap-3"><dt className="text-muted">CPU</dt><dd>{order.cpu} vCore</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">RAM</dt><dd>{order.ram} GB</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Penyimpanan</dt><dd>{order.storage} GB</dd></div>
            {order.server_name && (
              <div className="flex justify-between gap-3"><dt className="text-muted">Nama Server</dt><dd className="text-right">{order.server_name}</dd></div>
            )}
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-label="Rincian harga">
        <h2 className="text-sm font-semibold">Rincian Harga</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Harga</dt><dd className="tabular-nums">{formatIDR(order.price_raw)}</dd></div>
          {order.coupon_code && (
            <div className="flex justify-between"><dt className="text-muted">Kupon {order.coupon_code}</dt><dd className="tabular-nums text-emerald-600">-{formatIDR(order.discount)}</dd></div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatIDR(order.total)}</dd></div>
        </dl>
        {item && (
          <p className="mt-3 text-xs text-muted">
            Produk: {item.product_name} · Sumber: {order.source === "renewal" ? "perpanjangan" : "web"}
          </p>
        )}
      </section>

      {services.length > 0 && (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5" aria-label="Layanan terkait">
          <h2 className="text-sm font-semibold">Layanan</h2>
          <div className="mt-3 space-y-2">
            {services.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted">{s.service_number}</p>
                </div>
                <OrderStatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> Konfirmasi via WhatsApp
        </a>
      ) : (
        <Alert tone="info" title="Nomor WhatsApp belum dikonfigurasi">
          Tim kami akan menghubungi Anda melalui email {order.customer_email} untuk konfirmasi pembayaran.
        </Alert>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Halaman ini bersifat privat (noindex). Simpan nomor pesanan Anda untuk referensi. Lihat{" "}
        <Link href="/terms" className="underline underline-offset-2">Syarat Layanan</Link> ·{" "}
        <Link href="/refund" className="underline underline-offset-2">Refund</Link> ·{" "}
        <Link href="/sla" className="underline underline-offset-2">SLA</Link>
      </p>
    </div>
  );
}
