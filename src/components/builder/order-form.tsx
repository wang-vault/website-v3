"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import { formatIDR } from "@/lib/utils/format";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

interface OrderFormProps {
  tierSlug: "low" | "medium" | "high" | "vps";
  config?: { cpu: number; ram: number; storage: number };
  serverPackage?: { id: string; name: string; price: number } | null;
  vpsPackage?: { id: string; name: string; price: number } | null;
  price: number;
  user: { id: string; email: string; fullName: string; whatsapp: string } | null;
  onClose: () => void;
}

export function OrderFormModal({ tierSlug, config, serverPackage, vpsPackage, price, user, onClose }: OrderFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.fullName ?? "",
    whatsapp: user?.whatsapp ?? "",
    email: user?.email ?? "",
    serverName: "",
    notes: "",
    couponCode: "",
    accepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [couponState, setCouponState] = useState<{ code: string; discount: number; total: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [result, setResult] = useState<{ orderNumber: string; orderId: string; whatsappUrl: string | null; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: user.fullName || f.name, whatsapp: user.whatsapp || f.whatsapp, email: user.email || f.email }));
    }
  }, [user]);

  const label = useMemo(() => {
    if (tierSlug === "low") return "Tier Low (Custom)";
    if (tierSlug === "vps") return vpsPackage?.name ?? "Paket VPS";
    return serverPackage?.name ?? "Paket";
  }, [tierSlug, serverPackage, vpsPackage]);

  const validateCoupon = async () => {
    setCouponError(null);
    if (!form.couponCode.trim()) {
      setCouponState(null);
      return;
    }
    const res = await apiFetch<{ discount: number; totalAfterDiscount: number }>("/api/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code: form.couponCode.trim(), tierSlug, price }),
    });
    if (res.success && res.data) {
      setCouponState({ code: form.couponCode.trim().toUpperCase(), discount: res.data.discount, total: res.data.totalAfterDiscount });
    } else {
      setCouponState(null);
      setCouponError(apiErrorMessage(res));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      tierSlug,
      cpu: config?.cpu,
      ram: config?.ram,
      storage: config?.storage,
      packageId: serverPackage?.id ?? null,
      vpsPackageId: vpsPackage?.id ?? null,
      name: form.name,
      whatsapp: form.whatsapp,
      email: form.email,
      serverName: form.serverName,
      notes: form.notes,
      couponCode: form.couponCode,
      accepted: form.accepted,
    };
    const res = await apiFetch<{ orderId: string; orderNumber: string; whatsappUrl: string | null; message: string }>(
      "/api/orders",
      { method: "POST", body: JSON.stringify(payload) },
    );
    setLoading(false);
    if (res.success && res.data) {
      setResult({ orderNumber: res.data.orderNumber, orderId: res.data.orderId, whatsappUrl: res.data.whatsappUrl, message: res.data.message });
      toast.push("success", "Pesanan berhasil dibuat.");
    } else {
      toast.push("error", apiErrorMessage(res));
    }
  };

  return (
    <Modal open onClose={onClose} title={result ? "Pesanan Dibuat" : "Buat Pesanan"} wide>
      {result ? (
        <div className="space-y-4">
          <Alert tone="success" title={`Pesanan ${result.orderNumber} berhasil dibuat`}>
            {result.message}
          </Alert>
          {result.whatsappUrl && (
            <a
              href={result.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Lanjutkan Konfirmasi via WhatsApp
            </a>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink onClick={() => router.push(`/order/${result.orderId}`)} className="flex-1">
              Lihat Halaman Pesanan
            </ButtonLink>
            <ButtonLink onClick={() => router.push("/dashboard")} variant="secondary" className="flex-1">
              Buka Dashboard
            </ButtonLink>
          </div>
          <p className="text-center text-xs text-muted">
            Simpan nomor pesanan <strong>{result.orderNumber}</strong> Anda untuk referensi.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="mt-0.5 text-xs text-secondary">
                  {tierSlug === "low" && config
                    ? `${config.cpu} vCore · ${config.ram} GB RAM · ${config.storage} GB Penyimpanan`
                    : tierSlug === "vps"
                      ? vpsPackage?.name
                      : serverPackage
                        ? `${serverPackage.name} — ${formatIDR(serverPackage.price)}/bln`
                        : ""}
                </p>
              </div>
              <p className="text-lg font-semibold tabular-nums">{formatIDR(price)}<span className="text-xs font-normal text-muted">/bln</span></p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
            <Input label="WhatsApp" required value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="08xxxxxxxxxx" hint="Untuk konfirmasi pesanan" />
            <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
            <Input label="Nama Server" required value={form.serverName} onChange={(e) => setForm({ ...form, serverName: e.target.value })} placeholder="Contoh: SMP WangStore" />
          </div>
          <Textarea label="Catatan" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan (opsional)" />

          <div className="rounded-xl border border-border p-4">
            <div className="flex gap-3">
              <Input
                label="Kupon"
                value={form.couponCode}
                onChange={(e) => {
                  setForm({ ...form, couponCode: e.target.value });
                  setCouponState(null);
                  setCouponError(null);
                }}
                placeholder="Kode kupon (opsional)"
                className="flex-1"
              />
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={validateCoupon} disabled={!form.couponCode.trim()}>
                  Terapkan
                </Button>
              </div>
            </div>
            {couponState && (
              <p className="mt-2 text-xs font-medium text-emerald-600">
                Kupon {couponState.code}: diskon {formatIDR(couponState.discount)} — total {formatIDR(couponState.total)}
              </p>
            )}
            {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <div className="flex justify-between text-secondary">
              <span>Harga</span>
              <span className="tabular-nums">{formatIDR(price)}</span>
            </div>
            {couponState && (
              <div className="mt-1 flex justify-between text-secondary">
                <span>Diskon kupon</span>
                <span className="tabular-nums text-emerald-600">-{formatIDR(couponState.discount)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatIDR(couponState?.total ?? price)}</span>
            </div>
          </div>

          <Alert tone="warning">
            Pastikan konfigurasi Anda sudah benar sebelum melakukan pembayaran. Pembelian bersifat final sesuai{" "}
            <Link href="/refund" className="underline underline-offset-2">Kebijakan Refund</Link> dan{" "}
            <Link href="/sla" className="underline underline-offset-2">SLA</Link>.
          </Alert>

          <Checkbox
            label="Saya telah membaca dan menyetujui Syarat Layanan, Kebijakan Privasi, Kebijakan Refund, dan SLA WangStore."
            required
            checked={form.accepted}
            onChange={(e) => setForm({ ...form, accepted: e.target.checked })}
          />

          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Batal
            </Button>
            <Button type="submit" disabled={loading || !form.accepted} className="flex-1">
              {loading ? "Membuat pesanan…" : "Buat Pesanan"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ButtonLink({ children, onClick, variant, className }: { children: React.ReactNode; onClick: () => void; variant?: "secondary"; className?: string }) {
  return (
    <Button type="button" variant={variant === "secondary" ? "secondary" : "primary"} onClick={onClick} className={className}>
      {children}
    </Button>
  );
}
