import { formatIDR } from "@/lib/utils/format";
import type { Order } from "@/lib/types";

/** Bersihkan nomor WhatsApp menjadi format internasional tanpa '+'/' '/'-'. */
export function normalizeWhatsAppNumber(raw: string): string {
  let n = raw.replace(/[^0-9]/g, "");
  if (n.startsWith("0")) n = `62${n.slice(1)}`;
  if (n.startsWith("62") && n.length < 12) n = `62${n}`;
  if (n.startsWith("+")) n = n.slice(1);
  return n;
}

export function waMeUrl(number: string, text: string): string {
  return `https://wa.me/${encodeURIComponent(number)}?text=${encodeURIComponent(text)}`;
}

const PURCHASE_STATEMENT =
  "Saya telah membaca dan menyetujui Syarat Layanan, Kebijakan Privasi, Kebijakan Refund, dan SLA WangStore.";

/**
 * Pesan ringkasan pesanan untuk WhatsApp (server-side).
 * Berisi: nama, WhatsApp, email, ID pesanan, tier, paket, CPU, RAM,
 * penyimpanan, harga, kupon, total, dan pernyataan persetujuan.
 */
export function buildOrderWhatsAppMessage(order: Order): string {
  const lines = [
    `Halo WangStore, saya ingin memesan layanan hosting.`,
    ``,
    `Nama: ${order.customer_name}`,
    `WhatsApp: ${order.customer_whatsapp}`,
    `Email: ${order.customer_email}`,
    ``,
    `ID Pesanan: ${order.order_number}`,
    `Layanan: ${order.tier_name}${order.package_name ? ` — ${order.package_name}` : ""}`,
    `CPU: ${order.cpu} vCore`,
    `RAM: ${order.ram} GB`,
    `Penyimpanan: ${order.storage} GB`,
    `Nama Server: ${order.server_name}`,
  ];
  if (order.notes) lines.push(`Catatan: ${order.notes}`);
  lines.push(``);
  lines.push(`Harga: ${formatIDR(order.price_raw)}`);
  if (order.coupon_code) {
    lines.push(`Kupon: ${order.coupon_code} (-${formatIDR(order.discount)})`);
  }
  lines.push(`Total: ${formatIDR(order.total)}`);
  lines.push(``);
  lines.push(PURCHASE_STATEMENT);
  return lines.join("\n");
}

export { PURCHASE_STATEMENT };
