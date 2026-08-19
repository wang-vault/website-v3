"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bookmark, Check, RotateCcw, Server, ShoppingCart } from "lucide-react";
import { apiFetch, apiErrorMessage } from "@/lib/client/api";
import {
  ABSOLUTE_SAFETY_LIMITS,
  calculateLowPrice,
  estimatePerformance,
  gradeLabel,
  normalizeLowConfig,
  type PricingRuleSet,
  type LowConfig,
} from "@/lib/pricing";
import { formatIDR } from "@/lib/utils/format";
import { Slider } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge, PackageStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { EmptyState, LoadingState } from "@/components/ui/state";
import { OrderFormModal } from "@/components/builder/order-form";

type TierSlug = "low" | "medium" | "high" | "vps";

interface TierInfo {
  id: string;
  name: string;
  slug: string;
  mode: string;
  description: string;
  orderable: boolean;
  performanceFactor: number;
}

interface ServerPackageDto {
  id: string;
  name: string;
  slug: string;
  cpu: number;
  ram: number;
  storage: number;
  price: number;
  description: string;
  status: string;
  orderable: boolean;
  popular: boolean;
  popularLabel: string | null;
  performanceFactor: number;
}

interface VpsPackageDto {
  id: string;
  name: string;
  cpu: number;
  ram: number;
  storage: number;
  bandwidth: string;
  ipv4Available: boolean;
  location: { id: string; name: string; country: string; city: string } | null;
  virtualization: string;
  price: number;
  billingPeriod: string;
  renewable: boolean;
  description: string;
  features: string[];
  status: string;
}

interface PricingDto {
  tiers: TierInfo[];
  low: {
    limits: { cpu: { min: number; max: number; step: number }; ram: { min: number; max: number; step: number }; storage: { min: number; max: number; step: number } };
    prices: { base: number; perCore: number; perGbRam: number; perGbStorage: number; minPrice: number; maxPrice: number | null; rounding: number };
    defaultConfig: LowConfig;
    defaultPrice: { total: number };
  } | null;
}

const GUEST_KEY = "ws_saved_configs";

type GuestConfig = { name: string; tierSlug: string; cpu: number; ram: number; storage: number; price: number; id?: string; savedAt?: string };

export function ServerBuilder() {
  const [pricing, setPricing] = useState<PricingDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tier, setTier] = useState<TierSlug>("low");
  const [config, setConfig] = useState<LowConfig>({ cpu: 2, ram: 4, storage: 20 });
  const [mediumPackages, setMediumPackages] = useState<ServerPackageDto[] | null>(null);
  const [highPackages, setHighPackages] = useState<ServerPackageDto[] | null>(null);
  const [vpsPackages, setVpsPackages] = useState<VpsPackageDto[] | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServerPackageDto | null>(null);
  const [selectedVps, setSelectedVps] = useState<VpsPackageDto | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [user, setUser] = useState<{ id: string; email: string; fullName: string; whatsapp: string } | null>(null);
  const toast = useToast();

  const rules: PricingRuleSet | null = useMemo(() => {
    if (!pricing?.low) return null;
    return {
      base: pricing.low.prices.base,
      perCore: pricing.low.prices.perCore,
      perGbRam: pricing.low.prices.perGbRam,
      perGbStorage: pricing.low.prices.perGbStorage,
      minPrice: pricing.low.prices.minPrice,
      maxPrice: pricing.low.prices.maxPrice,
      rounding: pricing.low.prices.rounding,
      cpu: pricing.low.limits.cpu,
      ram: pricing.low.limits.ram,
      storage: pricing.low.limits.storage,
    };
  }, [pricing]);

  // Muat data awal: pricing + paket + user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pricingRes, mediumRes, highRes, vpsRes, meRes] = await Promise.all([
        apiFetch<PricingDto>("/api/pricing"),
        apiFetch<{ packages: ServerPackageDto[] }>("/api/packages?tier=medium"),
        apiFetch<{ packages: ServerPackageDto[] }>("/api/packages?tier=high"),
        apiFetch<{ packages: VpsPackageDto[] }>("/api/vps"),
        apiFetch<{ user: { id: string; email: string; profile: { fullName: string; whatsapp: string } } | null }>("/api/auth/me"),
      ]);
      if (cancelled) return;
      if (pricingRes.success && pricingRes.data) {
        setPricing(pricingRes.data);
        const low = pricingRes.data.low;
        if (low) {
          setConfig({ cpu: low.limits.cpu.min, ram: low.limits.ram.min, storage: low.limits.storage.min });
        }
      } else {
        setError(apiErrorMessage(pricingRes));
      }
      if (mediumRes.success && mediumRes.data) setMediumPackages(mediumRes.data.packages);
      if (highRes.success && highRes.data) setHighPackages(highRes.data.packages);
      if (vpsRes.success && vpsRes.data) setVpsPackages(vpsRes.data.packages);
      const me = meRes.success ? meRes.data?.user : null;
      setUser(me ? { id: me.id, email: me.email, fullName: me.profile?.fullName ?? "", whatsapp: me.profile?.whatsapp ?? "" } : null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Normalisasi konfigurasi (shared module — sama dengan server)
  const normalized = useMemo(() => {
    if (!rules) return null;
    return normalizeLowConfig(config, rules);
  }, [config, rules]);

  const price = useMemo(() => {
    if (!rules || !normalized) return null;
    return calculateLowPrice(normalized, rules);
  }, [rules, normalized]);

  const estimate = useMemo(() => {
    if (!normalized) return null;
    const tierInfo = pricing?.tiers.find((t) => t.slug === "low");
    return estimatePerformance(normalized, tierInfo?.performanceFactor ?? 1);
  }, [normalized, pricing]);

  // Konfigurasi tersimpan (guest → localStorage)
  const saveConfig = useCallback(async () => {
    const name = window.prompt("Nama konfigurasi:", `Server ${normalized?.cpu ?? 2} vCore / ${normalized?.ram ?? 4} GB`);
    if (!name) return;
    const current: { name: string; tierSlug: string; cpu: number; ram: number; storage: number; price: number; id?: string; savedAt?: string } = {
      name: name.slice(0, 100),
      tierSlug: "low",
      cpu: normalized?.cpu ?? 0,
      ram: normalized?.ram ?? 0,
      storage: normalized?.storage ?? 0,
      price: price?.total ?? 0,
    };
    if (user) {
      const res = await apiFetch("/api/account/saved-configs", {
        method: "POST",
        body: JSON.stringify(current),
      });
      if (res.success) toast.push("success", "Konfigurasi tersimpan ke akun Anda.");
      else toast.push("error", apiErrorMessage(res));
    } else {
      const existing = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]") as GuestConfig[];
      existing.push({ ...current, id: crypto.randomUUID(), savedAt: new Date().toISOString() });
      localStorage.setItem(GUEST_KEY, JSON.stringify(existing.slice(-20)));
      toast.push("success", "Konfigurasi tersimpan di perangkat ini (guest).");
    }
  }, [normalized, price, user, toast]);

  const reset = useCallback(() => {
    if (rules) setConfig({ cpu: rules.cpu.min, ram: rules.ram.min, storage: rules.storage.min });
    setSelectedPackage(null);
    setSelectedVps(null);
    toast.push("info", "Konfigurasi direset.");
  }, [rules, toast]);

  const currentPrice = tier === "low" ? price?.total ?? 0 : tier === "medium" || tier === "high" ? (selectedPackage?.price ?? 0) : (selectedVps?.price ?? 0);
  const canOrder =
    tier === "low"
      ? !!price
      : tier === "medium" || tier === "high"
        ? !!selectedPackage
        : !!selectedVps;

  if (error) {
    return (
      <div className="mt-8">
        <Alert tone="error" title="Gagal memuat Server Builder">{error}</Alert>
      </div>
    );
  }
  if (!pricing || mediumPackages === null || highPackages === null || vpsPackages === null) {
    return <div className="mt-8"><LoadingState label="Memuat Server Builder…" /></div>;
  }

  return (
    <div className="mt-10">
      {/* Peringatan pembelian (wajib) */}
      <Alert tone="warning" title="Peringatan Pembelian">
        Pastikan konfigurasi Anda sudah benar sebelum melakukan pembayaran. Pembelian bersifat final sesuai{" "}
        <Link href="/refund" className="underline underline-offset-2">kebijakan WangStore</Link>. Jika ragu, konsultasikan terlebih dahulu.
      </Alert>

      {/* Step 1: Pilih Tier */}
      <section className="mt-8" aria-label="Langkah 1: pilih tier">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">1. Pilih Tier</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Pilih tier">
          {pricing.tiers.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tier === t.slug}
              onClick={() => {
                setTier(t.slug as TierSlug);
              }}
              className={`rounded-2xl border p-5 text-left transition-colors ${
                tier === t.slug ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-bg hover:bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{t.name}</span>
                <Badge tone={t.mode === "custom" ? "accent" : "neutral"}>{t.mode === "custom" ? "Custom" : "Paket"}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-secondary">{t.description}</p>
            </button>
          ))}
          <button
            role="radio"
            aria-checked={tier === "vps"}
            onClick={() => setTier("vps")}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              tier === "vps" ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-bg hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">VPS</span>
              <Badge tone="neutral">Katalog</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-secondary">
              Paket VPS dari katalog: pilih spesifikasi, lokasi, dan harga yang tersedia.
            </p>
          </button>
        </div>
      </section>

      {/* Step 2: Konfigurasi Low */}
      {tier === "low" && rules && normalized && (
        <section className="mt-8" aria-label="Langkah 2: konfigurasi">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2. Konfigurasi</h2>
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <Card className="space-y-8">
              <Slider
                label="CPU"
                value={normalized.cpu}
                min={rules.cpu.min}
                max={Math.min(rules.cpu.max, ABSOLUTE_SAFETY_LIMITS.cpu.max)}
                step={rules.cpu.step}
                unit="vCore"
                onChange={(v) => setConfig({ ...config, cpu: v })}
              />
              <Slider
                label="RAM"
                value={normalized.ram}
                min={rules.ram.min}
                max={Math.min(rules.ram.max, ABSOLUTE_SAFETY_LIMITS.ram.max)}
                step={rules.ram.step}
                unit="GB"
                onChange={(v) => setConfig({ ...config, ram: v })}
              />
              <Slider
                label="Penyimpanan"
                value={normalized.storage}
                min={rules.storage.min}
                max={Math.min(rules.storage.max, ABSOLUTE_SAFETY_LIMITS.storage.max)}
                step={rules.storage.step}
                unit="GB"
                onChange={(v) => setConfig({ ...config, storage: v })}
              />
              {normalized.original.cpu !== normalized.cpu ||
              normalized.original.ram !== normalized.ram ||
              normalized.original.storage !== normalized.storage ? (
                <p className="text-xs text-amber-600">
                  Konfigurasi disesuaikan ke batas yang tersedia: {normalized.cpu} vCore / {normalized.ram} GB /{" "}
                  {normalized.storage} GB.
                </p>
              ) : null}
            </Card>

            {price && estimate && (
              <div className="space-y-4">
                <Card>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Harga Bulanan</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{formatIDR(price.total)}</p>
                  <p className="mt-1 text-xs text-muted">
                    /bulan · estimasi — harga final dihitung ulang oleh server saat pemesanan.
                  </p>
                  <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-xs text-secondary">
                    <p className="flex justify-between"><span>Harga dasar</span><span className="tabular-nums">{formatIDR(price.base)}</span></p>
                    <p className="flex justify-between"><span>CPU ({normalized.cpu} × {formatIDR(rules.perCore)})</span><span className="tabular-nums">{formatIDR(price.cpuCost)}</span></p>
                    <p className="flex justify-between"><span>RAM ({normalized.ram} × {formatIDR(rules.perGbRam)})</span><span className="tabular-nums">{formatIDR(price.ramCost)}</span></p>
                    <p className="flex justify-between"><span>Penyimpanan ({normalized.storage} × {formatIDR(rules.perGbStorage)})</span><span className="tabular-nums">{formatIDR(price.storageCost)}</span></p>
                    {price.total > price.rounded && (
                      <p className="flex justify-between"><span>Minimum harga</span><span className="tabular-nums">{formatIDR(price.minPrice)}</span></p>
                    )}
                  </div>
                </Card>
                <Card>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Estimasi Performa</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-secondary">Estimasi TPS</dt><dd className="font-medium tabular-nums">{estimate.estTps}</dd></div>
                    <div className="flex justify-between"><dt className="text-secondary">Estimasi pemain konkuren</dt><dd className="font-medium tabular-nums">{estimate.estPlayers}</dd></div>
                    <div className="flex justify-between"><dt className="text-secondary">Estimasi beban CPU</dt><dd className="font-medium tabular-nums">{estimate.estCpuLoad}%</dd></div>
                    <div className="flex justify-between"><dt className="text-secondary">Estimasi penggunaan RAM</dt><dd className="font-medium tabular-nums">{estimate.estRamUsage}%</dd></div>
                    <div className="flex justify-between"><dt className="text-secondary">Rekomendasi plugin</dt><dd className="font-medium tabular-nums">{estimate.recommendedPlugins}</dd></div>
                    <div className="flex justify-between"><dt className="text-secondary">Grade build</dt><dd className="font-medium">{gradeLabel(estimate.grade)}</dd></div>
                  </dl>
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                    Semua angka adalah <strong>estimasi</strong> — bukan SLA atau jaminan performa.
                  </p>
                </Card>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 3/4: Paket Medium/High */}
      {(tier === "medium" || tier === "high") && (
        <section className="mt-8" aria-label="Langkah 2: pilih paket">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2. Pilih Paket</h2>
          <p className="mt-1 text-xs text-muted">
            Paket dikelola oleh tim WangStore dan dibaca langsung dari database.
          </p>
          <PackageGrid
            packages={tier === "medium" ? (mediumPackages ?? []) : (highPackages ?? [])}
            selectedId={selectedPackage?.id}
            onSelect={(p) => setSelectedPackage(p)}
            emptyTitle={tier === "medium" ? "Belum ada paket Medium yang tersedia." : "Belum ada paket High yang tersedia."}
            emptyDescription="Owner belum membuat paket melalui Admin Panel. Silakan cek kembali nanti."
          />
        </section>
      )}

      {/* VPS */}
      {tier === "vps" && (
        <section className="mt-8" aria-label="Langkah 2: pilih paket VPS">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">2. Pilih Paket VPS</h2>
          <p className="mt-1 text-xs text-muted">Katalog VPS dibaca langsung dari database.</p>
          <VpsGrid packages={vpsPackages ?? []} selectedId={selectedVps?.id} onSelect={setSelectedVps} />
        </section>
      )}

      {/* Aksi */}
      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button size="lg" disabled={!canOrder} onClick={() => setOrderOpen(true)}>
          <ShoppingCart className="h-4 w-4" aria-hidden /> Pesan Sekarang
        </Button>
        <Button size="lg" variant="secondary" onClick={saveConfig} disabled={tier === "low" ? !price : tier === "vps" ? !selectedVps : !selectedPackage}>
          <Bookmark className="h-4 w-4" aria-hidden /> Simpan Konfigurasi
        </Button>
        <Button size="lg" variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </Button>
        <span className="ml-auto text-sm text-muted">
          Total saat ini: <strong className="text-primary tabular-nums">{formatIDR(currentPrice)}</strong>/bulan
        </span>
      </div>

      {/* Ringkasan keamanan */}
      <p className="mt-6 flex items-start gap-2 text-xs text-muted">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Harga akhir dihitung ulang oleh server saat pemesanan. Estimasi performa bersifat informatif dan tidak
        menjamin hasil aktual.
      </p>

      {orderOpen && canOrder && (
        <OrderFormModal
          tierSlug={tier}
          config={tier === "low" && normalized ? { cpu: normalized.cpu, ram: normalized.ram, storage: normalized.storage } : undefined}
          serverPackage={tier === "medium" || tier === "high" ? selectedPackage : null}
          vpsPackage={tier === "vps" ? selectedVps : null}
          price={currentPrice}
          user={user}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}

function PackageGrid({
  packages,
  selectedId,
  onSelect,
  emptyTitle,
  emptyDescription,
}: {
  packages: ServerPackageDto[];
  selectedId?: string;
  onSelect: (p: ServerPackageDto) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (packages.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={<Server className="h-6 w-6" aria-hidden />} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => {
        const orderable = p.status === "available" && p.orderable;
        return (
          <button
            key={p.id}
            type="button"
            disabled={!orderable}
            onClick={() => onSelect(p)}
            aria-pressed={selectedId === p.id}
            className={`rounded-2xl border p-5 text-left transition-colors ${
              selectedId === p.id
                ? "border-accent bg-surface ring-1 ring-accent"
                : orderable
                  ? "border-border bg-bg hover:bg-surface"
                  : "cursor-not-allowed border-border bg-surface-muted opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.name}</p>
                {p.popularLabel && <Badge tone="accent" className="mt-1">{p.popularLabel}</Badge>}
              </div>
              <PackageStatusBadge status={p.status} />
            </div>
            <p className="mt-3 text-sm text-secondary">
              {p.cpu} vCore · {p.ram} GB RAM · {p.storage} GB Penyimpanan
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">{p.description}</p>
            <p className="mt-3 text-lg font-semibold tabular-nums">
              {formatIDR(p.price)}<span className="text-xs font-normal text-muted">/bln</span>
            </p>
            {!orderable && <p className="mt-2 text-xs text-amber-600">Paket sedang tidak dapat dipesan.</p>}
            {selectedId === p.id && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check className="h-3.5 w-3.5" aria-hidden /> Dipilih
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function VpsGrid({
  packages,
  selectedId,
  onSelect,
}: {
  packages: VpsPackageDto[];
  selectedId?: string;
  onSelect: (p: VpsPackageDto) => void;
}) {
  if (packages.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={<Server className="h-6 w-6" aria-hidden />} title="Belum ada paket VPS yang tersedia." description="Owner belum membuat paket VPS melalui Admin Panel." />
      </div>
    );
  }
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          aria-pressed={selectedId === p.id}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            selectedId === p.id ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-bg hover:bg-surface"
          }`}
        >
          <p className="font-semibold">{p.name}</p>
          <p className="mt-2 text-sm text-secondary">
            {p.cpu} vCore · {p.ram} GB · {p.storage} GB
          </p>
          <p className="mt-1 text-xs text-muted">
            {p.location ? `${p.location.name} (${p.location.city}, ${p.location.country})` : "Lokasi: belum diatur"} · {p.virtualization || "KVM"}
          </p>
          {p.bandwidth && <p className="mt-1 text-xs text-muted">Bandwidth: {p.bandwidth}</p>}
          {p.ipv4Available && <p className="mt-1 text-xs text-muted">IPv4 tersedia</p>}
          <p className="mt-3 text-lg font-semibold tabular-nums">
            {formatIDR(p.price)}<span className="text-xs font-normal text-muted">/bln</span>
          </p>
          {p.features.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-muted">
              {p.features.slice(0, 4).map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
          )}
          {selectedId === p.id && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" aria-hidden /> Dipilih
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
