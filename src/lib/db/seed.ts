import { createHash } from "crypto";
import type { Row } from "@/lib/db/types";

/** UUID deterministik dari seed string — konsisten antara Postgres & JSON. */
export function seedId(seed: string): string {
  const h = createHash("sha256").update(`wangstore:${seed}`).digest("hex").slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export const SEED_IDS = {
  roleOwner: seedId("role-owner"),
  roleAdmin: seedId("role-admin"),
  roleStaff: seedId("role-staff"),
  roleCustomer: seedId("role-customer"),
  tierLow: seedId("tier-low"),
  tierMedium: seedId("tier-medium"),
  tierHigh: seedId("tier-high"),
  pricingLow: seedId("pricing-low"),
} as const;

const now = () => new Date().toISOString();

function perm(key: string, module: string, description: string): Row {
  return { id: seedId(`perm-${key}`), key, module, description, created_at: now() };
}

function rolePerm(roleSeed: string, permKey: string): Row {
  return {
    id: seedId(`roleperm-${roleSeed}-${permKey}`),
    role_id: SEED_IDS[roleSeed as keyof typeof SEED_IDS],
    permission_id: seedId(`perm-${permKey}`),
    created_at: now(),
  };
}

export function getSeedData(): Record<string, Row[]> {
  const t = now();

  const roles: Row[] = [
    { id: SEED_IDS.roleOwner, slug: "owner", name: "Owner", description: "Pemilik platform. Memiliki seluruh akses termasuk kelola role dan paket Medium/High.", is_system: true, created_at: t, updated_at: t },
    { id: SEED_IDS.roleAdmin, slug: "admin", name: "Admin", description: "Operator harian platform: pesanan, pelanggan, layanan, kupon, konten, dan pengaturan.", is_system: true, created_at: t, updated_at: t },
    { id: SEED_IDS.roleStaff, slug: "staff", name: "Staff", description: "Petugas pendukung: melihat pesanan/pelanggan, membalas tiket, melihat konten.", is_system: true, created_at: t, updated_at: t },
    { id: SEED_IDS.roleCustomer, slug: "customer", name: "Pelanggan", description: "Akun pelanggan biasa tanpa akses admin.", is_system: false, created_at: t, updated_at: t },
  ];

  const permissions: Row[] = [
    perm("dashboard.view", "dashboard", "Melihat ringkasan dashboard admin."),
    perm("orders.view", "orders", "Melihat daftar dan detail pesanan."),
    perm("orders.confirm", "orders", "Mengonfirmasi pembayaran dan menyetujui pesanan."),
    perm("orders.update", "orders", "Mengubah status pesanan."),
    perm("orders.cancel", "orders", "Membatalkan pesanan."),
    perm("customers.view", "customers", "Melihat daftar dan detail pelanggan."),
    perm("customers.update", "customers", "Mengubah data pelanggan."),
    perm("services.view", "services", "Melihat daftar dan detail layanan."),
    perm("services.manage", "services", "Mengubah status, waktu aktivasi, dan waktu kedaluwarsa layanan."),
    perm("services.extend", "services", "Melakukan perpanjangan manual layanan."),
    perm("services.reminders", "services", "Menjalankan dan melihat pengingat layanan."),
    perm("vps.view", "vps", "Melihat paket VPS."),
    perm("vps.manage", "vps", "Membuat, mengubah, dan mengarsipkan paket VPS."),
    perm("packages.view", "packages", "Melihat paket Medium/High Server Builder."),
    perm("packages.manage", "packages", "Membuat, mengubah, mengarsipkan, menghapus paket Medium/High (khusus Owner)."),
    perm("pricing.view", "pricing", "Melihat formula dan aturan harga."),
    perm("pricing.manage", "pricing", "Mengubah formula harga dan batas konfigurasi Tier Low."),
    perm("coupons.view", "coupons", "Melihat kupon."),
    perm("coupons.manage", "coupons", "Membuat, mengubah, menonaktifkan kupon."),
    perm("tickets.view", "tickets", "Melihat tiket dan pesan."),
    perm("tickets.reply", "tickets", "Membalas tiket pelanggan."),
    perm("tickets.manage", "tickets", "Mengubah kategori, prioritas, dan status tiket."),
    perm("content.view", "content", "Melihat konten CMS."),
    perm("content.manage", "content", "Mengelola konten CMS: halaman, FAQ, testimoni, blog, knowledge base, legal, pengumuman."),
    perm("status.manage", "status", "Mengelola insiden, jendela maintenance, dan status platform."),
    perm("analytics.view", "analytics", "Melihat laporan analitik."),
    perm("audit.view", "audit", "Melihat audit log."),
    perm("users.manage", "users", "Mengelola akun pengguna (aktif/nonaktif)."),
    perm("roles.manage", "roles", "Mengelola role dan permission (khusus Owner)."),
    perm("settings.manage", "settings", "Mengelola pengaturan platform, branding, sosial, dan maintenance mode."),
    perm("notifications.send", "notifications", "Mengirim notifikasi manual ke pelanggan."),
  ];

  const rolePermissions: Row[] = [
    // Owner: SEMUA permission
    ...permissions.map((p) => rolePerm("roleOwner", p.key as string)),
    // Admin: semua kecuali roles.manage & packages.manage (khusus Owner)
    ...permissions
      .filter((p) => !["roles.manage", "packages.manage"].includes(p.key as string))
      .map((p) => rolePerm("roleAdmin", p.key as string)),
    // Staff: akses pandang + tiket + layanan terbatas
    ...permissions
      .filter((p) =>
        [
          "dashboard.view",
          "orders.view",
          "customers.view",
          "services.view",
          "vps.view",
          "packages.view",
          "pricing.view",
          "tickets.view",
          "tickets.reply",
          "content.view",
          "analytics.view",
        ].includes(p.key as string),
      )
      .map((p) => rolePerm("roleStaff", p.key as string)),
  ];

  const serverTiers: Row[] = [
    {
      id: SEED_IDS.tierLow,
      name: "Low",
      slug: "low",
      mode: "custom",
      description: "Konfigurasi custom: Anda menentukan CPU, RAM, dan penyimpanan sendiri. Cocok untuk server Minecraft kecil hingga menengah.",
      status: "active",
      visible: true,
      orderable: true,
      performance_factor: 1,
      sort: 1,
      created_at: t,
      updated_at: t,
    },
    {
      id: SEED_IDS.tierMedium,
      name: "Medium",
      slug: "medium",
      mode: "package",
      description: "Paket pilihan dengan spesifikasi seimbang untuk server komunitas yang sedang berkembang.",
      status: "active",
      visible: true,
      orderable: true,
      performance_factor: 1.15,
      sort: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: SEED_IDS.tierHigh,
      name: "High",
      slug: "high",
      mode: "package",
      description: "Paket performa tinggi untuk server besar dengan banyak pemain.",
      status: "active",
      visible: true,
      orderable: true,
      performance_factor: 1.3,
      sort: 3,
      created_at: t,
      updated_at: t,
    },
  ];

  const pricingRules: Row[] = [
    {
      id: SEED_IDS.pricingLow,
      tier_id: SEED_IDS.tierLow,
      base: 5000,
      per_core: 4000,
      per_gb_ram: 3000,
      per_gb_storage: 1000,
      min_price: 50000,
      max_price: null,
      rounding: 500,
      cpu_min: 2,
      cpu_max: 16,
      cpu_step: 1,
      ram_min: 4,
      ram_max: 32,
      ram_step: 2,
      storage_min: 20,
      storage_max: 160,
      storage_step: 10,
      version: 1,
      updated_by: null,
      created_at: t,
      updated_at: t,
    },
  ];

  const settings: Row[] = [
    { id: seedId("setting-site-name"), key: "site_name", value: JSON.stringify("WangStore"), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-site-tagline"), key: "site_tagline", value: JSON.stringify("Build Your Own Server."), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-site-description"), key: "site_description", value: JSON.stringify("WangStore adalah platform e-commerce untuk menjual layanan hosting: Minecraft hosting, VPS, dan dedicated server dengan proses pemesanan yang transparan."), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-whatsapp-number"), key: "whatsapp_number", value: JSON.stringify(""), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-discord-url"), key: "discord_url", value: JSON.stringify(""), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-email-public"), key: "email_public", value: JSON.stringify(""), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-contact-note"), key: "contact_note", value: JSON.stringify("Tim WangStore siap membantu Anda sebelum dan sesudah pemesanan."), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-maintenance-enabled"), key: "maintenance_enabled", value: JSON.stringify(false), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-maintenance-title"), key: "maintenance_title", value: JSON.stringify("Pemeliharaan Terjadwal"), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-maintenance-message"), key: "maintenance_message", value: JSON.stringify("WangStore sedang dalam pemeliharaan. Kami akan segera kembali."), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-maintenance-until"), key: "maintenance_until", value: JSON.stringify(""), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-maintenance-allowed-paths"), key: "maintenance_allowed_paths", value: JSON.stringify(["/api/health", "/login", "/api/auth/login", "/api/csrf"]), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-reminders-enabled"), key: "reminders_enabled", value: JSON.stringify(true), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-reminder-intervals"), key: "reminder_intervals", value: JSON.stringify([7, 3, 1]), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-seo-title"), key: "seo_title", value: JSON.stringify("WangStore — Build Your Own Server."), updated_by: null, created_at: t, updated_at: t },
    { id: seedId("setting-seo-description"), key: "seo_description", value: JSON.stringify("Platform pemesanan layanan hosting: Minecraft hosting, VPS, dan dedicated server. Harga transparan, konfigurasi fleksibel, proses pemesanan sederhana."), updated_by: null, created_at: t, updated_at: t },
  ];

  const pages: Row[] = [
    {
      id: seedId("page-home"),
      slug: "home",
      title: "Beranda",
      seo_title: "WangStore — Build Your Own Server.",
      seo_description: "WangStore adalah platform pemesanan dan pengelolaan layanan hosting: Minecraft hosting, VPS, dan dedicated server. Harga transparan, proses sederhana.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "hero", title: "Bangun Server Anda Sendiri.", subtitle: "WangStore adalah platform pemesanan layanan hosting — Minecraft hosting, VPS, dan dedicated server. Pilih spesifikasi, lihat harga real-time, dan buat pesanan dalam hitungan menit.", ctaLabel: "Buat Server", ctaHref: "/server-builder", ctaSecondaryLabel: "Lihat Paket", ctaSecondaryHref: "/server-builder" },
        { type: "paragraph", text: "Kami percaya memesan layanan hosting harus sederhana dan transparan. Tidak perlu memahami istilah teknis yang rumit — pilih kebutuhan Anda, dan sistem akan menghitung harga secara jelas sebelum Anda memesan." },
        { type: "heading", text: "Cara Kerja WangStore" },
        { type: "card", title: "1. Pilih Konfigurasi", description: "Gunakan Server Builder untuk memilih Tier, CPU, RAM, dan penyimpanan. Harga ditampilkan real-time." },
        { type: "card", title: "2. Buat Pesanan", description: "Isi informasi kontak, terapkan kupon bila ada, dan kirim pesanan. Ringkasan otomatis dikirim ke WhatsApp." },
        { type: "card", title: "3. Konfirmasi & Aktif", description: "Tim kami meninjau pesanan, mengonfirmasi pembayaran, lalu layanan diaktifkan sesuai jadwal aktivasi." },
        { type: "heading", text: "Mengapa WangStore" },
        { type: "list", title: "Keunggulan kami", items: ["Harga transparan — total terlihat sebelum pemesanan, tanpa biaya tersembunyi", "Server Builder dengan estimasi performa yang jelas", "Pemesanan sederhana melalui WhatsApp", "Dashboard pelanggan untuk memantau pesanan dan layanan", "Knowledge base dan tiket dukungan", "Kebijakan tertulis: Syarat Layanan, Privasi, Refund, dan SLA"] },
        { type: "cta", title: "Siap membangun server Anda?", description: "Buka Server Builder dan temukan konfigurasi yang sesuai kebutuhan Anda.", label: "Buat Server", href: "/server-builder" },
      ],
    },
    {
      id: seedId("page-about"),
      slug: "about",
      title: "Tentang WangStore",
      seo_title: "Tentang WangStore",
      seo_description: "Cerita, visi, misi, dan prinsip WangStore — platform pemesanan dan pengelolaan layanan hosting.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Tentang WangStore" },
        { type: "paragraph", text: "WangStore adalah platform e-commerce untuk menjual layanan hosting. Kami menghubungkan kebutuhan Anda — server Minecraft, VPS, atau dedicated server — dengan proses pemesanan yang sederhana, transparan, dan dapat dilacak." },
        { type: "paragraph", text: "Platform ini dibangun untuk komunitas Minecraft, developer, creator, pelajar, mahasiswa, pemilik server, dan bisnis kecil yang menginginkan cara yang jelas dalam memesan dan mengelola layanan hosting." },
        { type: "heading", text: "Visi" },
        { type: "paragraph", text: "Menjadi platform pemesanan layanan hosting yang paling mudah digunakan di Indonesia — di mana setiap orang dapat membangun servernya sendiri tanpa kebingungan." },
        { type: "heading", text: "Misi" },
        { type: "list", title: "Misi kami", items: ["Menyederhanakan proses pemesanan layanan hosting", "Menampilkan harga yang jujur dan transparan", "Menyediakan informasi yang lengkap melalui blog dan knowledge base", "Membangun sistem pemesanan dan pengelolaan yang dapat dipercaya", "Terus memperbaiki platform berdasarkan masukan pelanggan"] },
        { type: "heading", text: "Prinsip" },
        { type: "list", title: "Prinsip yang kami pegang", items: ["Kejujuran: tidak ada data palsu, harga tersembunyi, atau janji yang tidak dapat dipenuhi", "Kesederhanaan: antarmuka yang bersih dan mudah dipahami", "Transparansi: kebijakan tertulis dan dapat diakses", "Keamanan: data pelanggan dilindungi dengan praktik keamanan yang baik", "Dukungan: saluran bantuan yang jelas dan dapat dihubungi"] },
        { type: "heading", text: "Teknologi Platform" },
        { type: "paragraph", text: "WangStore dibangun di atas Next.js (App Router) dengan TypeScript, Tailwind CSS, dan PostgreSQL cloud. Aplikasi berjalan di platform serverless modern sehingga fokus kami tetap pada keandalan dan keamanan perangkat lunak." },
      ],
    },
    {
      id: seedId("page-features"),
      slug: "features",
      title: "Fitur",
      seo_title: "Fitur WangStore",
      seo_description: "Fitur-fitur WangStore: Server Builder, harga real-time, pemesanan WhatsApp, dashboard pelanggan, tiket dukungan, dan banyak lagi.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Fitur WangStore" },
        { type: "paragraph", text: "WangStore dirancang agar seluruh proses — dari memilih spesifikasi hingga mengelola layanan — berjalan dalam satu platform." },
        { type: "card", title: "Server Builder", description: "Pilih Tier (Low/Medium/High), atur CPU, RAM, dan penyimpanan, lalu lihat harga dan estimasi performa secara real-time." },
        { type: "card", title: "Harga Transparan", description: "Total harga dihitung oleh server dan ditampilkan sebelum pemesanan. Tidak ada biaya tersembunyi." },
        { type: "card", title: "Pemesanan WhatsApp", description: "Setiap pesanan menghasilkan ringkasan yang dapat dikirim langsung ke WhatsApp untuk konfirmasi." },
        { type: "card", title: "Dashboard Pelanggan", description: "Pantau pesanan, layanan, konfigurasi tersimpan, tiket, kupon, dan notifikasi dalam satu tempat." },
        { type: "card", title: "Layanan & Perpanjangan", description: "Setiap layanan memiliki siklus hidup yang jelas: aktivasi, kedaluwarsa, dan perpanjangan bila diizinkan." },
        { type: "card", title: "Tiket Dukungan", description: "Ajukan pertanyaan atau kendala melalui sistem tiket yang tercatat rapi." },
        { type: "card", title: "Knowledge Base", description: "Artikel panduan untuk memulai, memesan, membayar, dan memecahkan masalah umum." },
        { type: "card", title: "Status Layanan", description: "Halaman status menampilkan kondisi platform, insiden, dan jadwal maintenance secara jujur." },
        { type: "card", title: "Kupon & Promosi", description: "Kupon diskon dengan aturan yang divalidasi server-side: batas pemakaian, kedaluwarsa, dan ketentuan lainnya." },
        { type: "card", title: "Keamanan", description: "Autentikasi dengan sesi aman, verifikasi email, rate limiting, RBAC, audit log, dan header keamanan." },
      ],
    },
    {
      id: seedId("page-why-wangstore"),
      slug: "why-wangstore",
      title: "Mengapa WangStore",
      seo_title: "Mengapa Memilih WangStore",
      seo_description: "Alasan memilih WangStore: harga transparan, konfigurasi fleksibel, proses sederhana, dan dukungan yang jelas.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Mengapa Memilih WangStore" },
        { type: "paragraph", text: "Kami membangun WangStore dengan satu pertanyaan sederhana: mengapa memesan layanan hosting harus rumit? Berikut alasan mengapa pengguna memilih kami." },
        { type: "card", title: "Harga yang Jujur", description: "Harga dihitung dari konfigurasi yang Anda pilih dan ditampilkan sebelum pemesanan. Tidak ada biaya yang muncul belakangan." },
        { type: "card", title: "Konfigurasi Sesuai Kebutuhan", description: "Tier Low memungkinkan Anda menentukan CPU, RAM, dan penyimpanan sendiri. Tier Medium dan High menyediakan paket yang dikelola dengan jelas." },
        { type: "card", title: "Proses Pemesanan Sederhana", description: "Server Builder, formulir singkat, konfirmasi WhatsApp, dan nomor pesanan yang dapat dilacak." },
        { type: "card", title: "Informasi yang Dapat Dipercaya", description: "Estimasi performa diberi label estimasi — bukan janji. Kebijakan refund dan SLA tertulis secara terbuka." },
        { type: "card", title: "Dukungan yang Jelas", description: "Tiket dukungan, knowledge base, dan saluran kontak yang benar-benar dikonfigurasi." },
        { type: "card", title: "Satu Platform untuk Semua", description: "Minecraft hosting, VPS, dan dedicated server dapat dipesan dari satu platform dengan alur yang sama." },
        { type: "paragraph", text: "Kami tidak menjanjikan hal yang tidak dapat kami penuhi. Jika suatu informasi belum tersedia, kami menyatakannya secara terbuka." },
      ],
    },
    {
      id: seedId("page-infrastructure"),
      slug: "infrastructure",
      title: "Infrastruktur",
      seo_title: "Infrastruktur WangStore",
      seo_description: "Penjelasan jujur tentang infrastruktur WangStore: platform penjualan dan pengelolaan layanan hosting.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Infrastruktur" },
        { type: "paragraph", text: "WangStore adalah platform penjualan dan pengelolaan layanan hosting. WangStore tidak menjalankan infrastruktur hosting pelanggan — seperti server Minecraft, VPS, atau dedicated server — di dalam aplikasi ini." },
        { type: "paragraph", text: "Aplikasi ini menangani katalog layanan, Server Builder, kalkulasi harga, akun pelanggan, pemesanan, manajemen pesanan, portal pelanggan, kupon, tiket, panel admin, konten, dan laporan. Infrastruktur hosting pelanggan dikelola oleh penyedia layanan di luar aplikasi." },
        { type: "heading", text: "Perangkat Keras" },
        { type: "paragraph", text: "Informasi infrastruktur sedang diperbarui. Detail perangkat keras, lokasi server, dan kapasitas jaringan akan ditampilkan di halaman ini setelah tersedia dan dapat diverifikasi. Kami tidak menampilkan spesifikasi yang tidak kami miliki." },
        { type: "heading", text: "Perlindungan DDoS" },
        { type: "paragraph", text: "Perlindungan DDoS bergantung pada kapasitas dan kemampuan provider jaringan. WangStore tidak menjanjikan perlindungan DDoS tanpa batas." },
        { type: "heading", text: "Platform Aplikasi" },
        { type: "paragraph", text: "Aplikasi WangStore berjalan di platform serverless modern (Next.js + PostgreSQL cloud) dengan praktik keamanan standar: sesi terenkripsi, validasi server-side, rate limiting, dan audit log." },
      ],
    },
    {
      id: seedId("page-contact"),
      slug: "contact",
      title: "Kontak",
      seo_title: "Kontak WangStore",
      seo_description: "Hubungi WangStore melalui WhatsApp, Discord, email, atau tiket dukungan.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Hubungi Kami" },
        { type: "paragraph", text: "Konsultasi pra-pembelian sangat disarankan, terutama jika Anda ragu dengan spesifikasi atau paket yang tepat. Pilih saluran yang tersedia di bawah." },
      ],
    },
    {
      id: seedId("page-status"),
      slug: "status",
      title: "Status Layanan",
      seo_title: "Status Layanan WangStore",
      seo_description: "Status platform, insiden, dan jadwal maintenance WangStore.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Status Layanan" },
        { type: "paragraph", text: "Halaman ini menampilkan kondisi platform WangStore, insiden yang sedang berlangsung, riwayat insiden, dan jadwal maintenance." },
      ],
    },
    {
      id: seedId("page-server-builder"),
      slug: "server-builder",
      title: "Server Builder",
      seo_title: "Server Builder — WangStore",
      seo_description: "Rancang server Anda: pilih Tier, CPU, RAM, dan penyimpanan dengan harga real-time.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Server Builder" },
        { type: "paragraph", text: "Pilih Tier, sesuaikan spesifikasi, dan lihat harga serta estimasi performa secara real-time. Harga akhir dihitung ulang oleh server saat pemesanan." },
      ],
    },
    {
      id: seedId("page-testimonials"),
      slug: "testimonials",
      title: "Testimoni",
      seo_title: "Testimoni WangStore",
      seo_description: "Testimoni pengguna WangStore.",
      status: "active",
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "Testimoni" },
        { type: "paragraph", text: "Kami hanya menampilkan testimoni nyata dari pelanggan yang telah menggunakan layanan WangStore." },
      ],
    },
  ];

  const legalDocuments: Row[] = [
    {
      id: seedId("legal-terms"),
      slug: "terms",
      title: "Syarat Layanan",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Pendahuluan" },
        { type: "paragraph", text: "Dengan menggunakan WangStore (\"Platform\"), Anda menyetujui Syarat Layanan ini. WangStore adalah platform pemesanan dan pengelolaan layanan hosting. WangStore tidak menjalankan infrastruktur hosting pelanggan di dalam aplikasi; layanan infrastruktur disediakan oleh penyedia yang bekerja sama dengan WangStore." },
        { type: "heading", text: "2. Akun" },
        { type: "paragraph", text: "Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan seluruh aktivitas yang terjadi pada akun Anda. Akun yang belum diverifikasi email tidak dapat mengakses seluruh fitur platform." },
        { type: "heading", text: "3. Pemesanan" },
        { type: "paragraph", text: "Pemesanan dibuat melalui Server Builder atau katalog paket. Harga dihitung dan ditetapkan oleh server pada saat pemesanan. WangStore berhak menolak atau membatalkan pesanan yang melanggar kebijakan, mengandung data palsu, atau tidak dapat dipenuhi." },
        { type: "heading", text: "4. Pembayaran" },
        { type: "paragraph", text: "Layanan diaktifkan setelah pembayaran dikonfirmasi. Metode dan alur pembayaran dijelaskan pada halaman terkait. WangStore tidak akan mengaktifkan layanan sebelum pembayaran terkonfirmasi." },
        { type: "heading", text: "5. Penggunaan Layanan" },
        { type: "paragraph", text: "Anda bertanggung jawab atas penggunaan layanan sesuai dengan Kebijakan Penggunaan yang Dapat Diterima. Penyalahgunaan, aktivitas ilegal, atau pelanggaran kebijakan dapat menyebabkan penangguhan atau penghentian layanan." },
        { type: "heading", text: "6. Penghentian" },
        { type: "paragraph", text: "WangStore dapat menghentikan akses ke platform bila terjadi pelanggaran serius terhadap syarat ini. Layanan yang telah dibeli tetap tunduk pada Kebijakan Refund." },
        { type: "heading", text: "7. Perubahan Syarat" },
        { type: "paragraph", text: "WangStore dapat memperbarui Syarat Layanan ini dari waktu ke waktu. Perubahan yang material akan diumumkan melalui platform." },
      ],
    },
    {
      id: seedId("legal-privacy"),
      slug: "privacy",
      title: "Kebijakan Privasi",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Data yang Kami Kumpulkan" },
        { type: "paragraph", text: "Kami mengumpulkan data yang Anda berikan: nama, email, nomor WhatsApp, dan informasi lain yang diperlukan untuk pemesanan dan dukungan. Kami juga mencatat data teknis seperti alamat IP dan log audit untuk keamanan." },
        { type: "heading", text: "2. Penggunaan Data" },
        { type: "paragraph", text: "Data digunakan untuk: memproses pesanan, mengirim notifikasi transaksional (verifikasi email, reset password), menyediakan dukungan, mencegah penyalahgunaan, dan memenuhi kewajiban hukum." },
        { type: "heading", text: "3. Penyimpanan dan Keamanan" },
        { type: "paragraph", text: "Data disimpan di database cloud dengan akses terbatas. Kata sandi disimpan dalam bentuk hash (bcrypt). Kami tidak pernah menjual data pribadi Anda." },
        { type: "heading", text: "4. Pembagian Data" },
        { type: "paragraph", text: "Data dibagikan hanya kepada pihak yang diperlukan untuk menjalankan layanan (misalnya penyedia infrastruktur) atau bila diwajibkan hukum." },
        { type: "heading", text: "5. Hak Anda" },
        { type: "paragraph", text: "Anda dapat mengakses, memperbaiki, atau meminta penghapusan data pribadi Anda dengan menghubungi kami melalui saluran yang tersedia di halaman Kontak." },
      ],
    },
    {
      id: seedId("legal-refund"),
      slug: "refund",
      title: "Kebijakan Refund",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Sifat Pembelian" },
        { type: "paragraph", text: "Semua pembelian layanan di WangStore bersifat final setelah pesanan dikonfirmasi. Kami tidak menyediakan masa percobaan (trial), jaminan uang kembali (money-back guarantee), atau refund karena berubah pikiran." },
        { type: "heading", text: "2. Konsultasi Pra-Pembelian" },
        { type: "paragraph", text: "Karena pembelian bersifat final, kami sangat menyarankan konsultasi sebelum memesan jika Anda ragu terhadap spesifikasi, paket, atau cara pengelolaan layanan. Konsultasi tersedia melalui saluran kontak yang dikonfigurasi." },
        { type: "heading", text: "3. Yang Tidak Dapat Di-refund" },
        { type: "paragraph", text: "Tidak ada refund untuk: salah spesifikasi, salah paket, salah memilih layanan, berubah pikiran, proyek dibatalkan, kurang memahami pengelolaan server, layanan tidak digunakan, kelalaian pelanggan, atau pelanggaran kebijakan." },
        { type: "heading", text: "4. Kompensasi dari WangStore" },
        { type: "paragraph", text: "Kompensasi hanya diberikan jika kesalahan terbukti berasal dari WangStore. Kompensasi default berbentuk kredit layanan. Refund tunai hanya diberikan jika layanan sama sekali tidak dapat disediakan." },
        { type: "heading", text: "5. Cara Mengajukan" },
        { type: "paragraph", text: "Ajukan melalui tiket dukungan dengan menyertakan nomor pesanan dan penjelasan. Setiap permohonan ditinjau berdasarkan fakta yang dapat diverifikasi." },
      ],
    },
    {
      id: seedId("legal-sla"),
      slug: "sla",
      title: "Service Level Agreement (SLA)",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Target Uptime" },
        { type: "paragraph", text: "Target ketersediaan layanan (uptime) adalah 99,9% per bulan. Target ini berlaku untuk layanan yang disediakan oleh penyedia infrastruktur mitra WangStore." },
        { type: "heading", text: "2. Service Credit" },
        { type: "paragraph", text: "Apabila uptime aktual di bawah target, kompensasi diberikan dalam bentuk kredit layanan: 99,0%–99,89% → kredit 10%; 95,0%–98,99% → kredit 25%; di bawah 95% → kredit 50%." },
        { type: "heading", text: "3. Respons Dukungan" },
        { type: "paragraph", text: "Target respons tiket: prioritas Kritis → 15 menit; Tinggi → 1 jam; Normal → 4 jam; Rendah → 12 jam. Target ini adalah target respons, bukan jaminan penyelesaian." },
        { type: "heading", text: "4. Bentuk Kompensasi" },
        { type: "paragraph", text: "Kompensasi berbentuk kredit layanan dan tidak dapat diuangkan. Pengajuan SLA harus disertai bukti yang dapat diverifikasi melalui tiket dukungan." },
      ],
    },
    {
      id: seedId("legal-acceptable-use"),
      slug: "acceptable-use",
      title: "Kebijakan Penggunaan yang Dapat Diterima",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Penggunaan yang Diizinkan" },
        { type: "paragraph", text: "Layanan harus digunakan untuk tujuan yang sah: menjalankan server game, aplikasi, situs, dan proyek pribadi atau bisnis yang tidak melanggar hukum." },
        { type: "heading", text: "2. Penggunaan yang Dilarang" },
        { type: "paragraph", text: "Dilarang menggunakan layanan untuk: aktivitas ilegal, serangan jaringan (DDoS, intrusi), spam, phishing, malware, konten melanggar hukum, atau aktivitas yang mengganggu layanan pihak lain." },
        { type: "heading", text: "3. Penegakan" },
        { type: "paragraph", text: "Pelanggaran kebijakan ini dapat menyebabkan peringatan, penangguhan, atau penghentian layanan. Keputusan WangStore bersifat final setelah peninjauan." },
      ],
    },
    {
      id: seedId("legal-cookie-policy"),
      slug: "cookie-policy",
      title: "Kebijakan Cookie",
      version: 1,
      created_at: t,
      updated_at: t,
      sections: [
        { type: "heading", text: "1. Apa itu Cookie" },
        { type: "paragraph", text: "Cookie adalah file kecil yang disimpan di perangkat Anda untuk membantu situs berfungsi dan mengingat preferensi." },
        { type: "heading", text: "2. Cookie yang Kami Gunakan" },
        { type: "paragraph", text: "Kami menggunakan cookie sesi untuk autentikasi (menjaga Anda tetap masuk), cookie CSRF untuk keamanan formulir, dan cookie preferensi tema (mode terang/gelap). Kami tidak menggunakan cookie pihak ketiga untuk iklan." },
        { type: "heading", text: "3. Mengelola Cookie" },
        { type: "paragraph", text: "Anda dapat menghapus atau memblokir cookie melalui pengaturan peramban. Perlu diketahui, tanpa cookie sesi Anda tidak dapat masuk ke akun." },
      ],
    },
  ];

  const faqItems: Row[] = [
    { id: seedId("faq-1"), question: "Apa itu WangStore?", answer_md: "WangStore adalah platform e-commerce untuk menjual layanan hosting: Minecraft hosting, VPS, dan dedicated server. Anda memilih spesifikasi melalui Server Builder, membuat pesanan, dan mengelola semuanya dari dashboard.", category: "Layanan", sort: 1, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-2"), question: "Bagaimana cara memesan layanan?", answer_md: "Buka **Server Builder**, pilih Tier (Low/Medium/High), atur spesifikasi atau pilih paket, lalu klik **Pesan Sekarang**. Isi formulir, kirim, dan pesanan Anda akan dikonfirmasi melalui WhatsApp.", category: "Pemesanan", sort: 2, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-3"), question: "Apa perbedaan Tier Low, Medium, dan High?", answer_md: "**Low** menggunakan konfigurasi custom — Anda menentukan CPU, RAM, dan penyimpanan. **Medium** dan **High** adalah katalog paket yang dikelola oleh tim WangStore dengan spesifikasi dan harga tetap.", category: "Pemesanan", sort: 3, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-4"), question: "Apakah harga di Server Builder adalah harga final?", answer_md: "Ya. Harga yang ditampilkan di Server Builder dihitung ulang oleh server saat pemesanan dan menjadi harga final pada pesanan Anda. Kupon diskon dapat mengurangi total bila berlaku.", category: "Pembayaran", sort: 4, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-5"), question: "Bagaimana cara membayar?", answer_md: "Setelah pesanan dibuat, ringkasan pesanan dikirim melalui WhatsApp beserta petunjuk pembayaran. Layanan diaktifkan setelah pembayaran dikonfirmasi oleh tim kami.", category: "Pembayaran", sort: 5, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-6"), question: "Apakah ada uang kembali (refund)?", answer_md: "Semua pembelian bersifat final. Kompensasi hanya diberikan jika kesalahan terbukti berasal dari WangStore, dalam bentuk kredit layanan. Detail lengkap ada di [Kebijakan Refund](/refund).", category: "Kebijakan", sort: 6, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-7"), question: "Apa yang dimaksud dengan estimasi TPS dan pemain?", answer_md: "Server Builder menampilkan **estimasi** TPS, pemain konkuren, beban CPU, dan penggunaan RAM berdasarkan konfigurasi yang Anda pilih. Ini adalah estimasi deterministik untuk membantu perbandingan — bukan SLA atau jaminan performa.", category: "Layanan", sort: 7, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-8"), question: "Bagaimana cara mengubah spesifikasi setelah pesanan?", answer_md: "Pesanan yang sudah dibuat tidak dapat diubah langsung. Anda dapat menghubungi kami melalui tiket dukungan untuk konsultasi, atau membuat pesanan baru dengan konfigurasi yang diinginkan.", category: "Pemesanan", sort: 8, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-9"), question: "Bagaimana cara memperpanjang layanan?", answer_md: "Buka **Dashboard → Layanan Saya**. Jika layanan dapat diperpanjang, klik **Perpanjang Layanan**, pilih durasi, dan ikuti alur pemesanan. Perpanjangan memakai harga yang berlaku saat itu.", category: "Layanan", sort: 9, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-10"), question: "Apakah saya perlu membuat akun untuk memesan?", answer_md: "Tidak wajib. Pesanan dapat dibuat tanpa akun, tetapi dengan akun Anda dapat menyimpan konfigurasi, melihat riwayat pesanan, membuka tiket, dan menerima notifikasi.", category: "Pemesanan", sort: 10, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-11"), question: "Bagaimana cara menghubungi dukungan?", answer_md: "Gunakan halaman [Kontak](/contact) atau buka tiket dari dashboard. Saluran yang tersedia (WhatsApp, Discord, email) ditampilkan sesuai konfigurasi.", category: "Layanan", sort: 11, status: "active", created_at: t, updated_at: t },
    { id: seedId("faq-12"), question: "Apakah WangStore menjalankan server Minecraft saya?", answer_md: "Tidak. WangStore adalah platform pemesanan dan pengelolaan. Infrastruktur hosting dijalankan oleh penyedia di luar aplikasi. WangStore menangani pesanan, akun, dan administrasi layanan.", category: "Layanan", sort: 12, status: "active", created_at: t, updated_at: t },
  ];

  const blogCategories: Row[] = [
    { id: seedId("blogcat-pengumuman"), name: "Pengumuman", slug: "pengumuman", created_at: t },
    { id: seedId("blogcat-panduan"), name: "Panduan", slug: "panduan", created_at: t },
    { id: seedId("blogcat-tips"), name: "Tips", slug: "tips", created_at: t },
    { id: seedId("blogcat-engineering"), name: "Engineering", slug: "engineering", created_at: t },
  ];

  const blogTags: Row[] = [
    { id: seedId("blogtag-hosting"), name: "Hosting", slug: "hosting", created_at: t },
    { id: seedId("blogtag-minecraft"), name: "Minecraft", slug: "minecraft", created_at: t },
    { id: seedId("blogtag-vps"), name: "VPS", slug: "vps", created_at: t },
    { id: seedId("blogtag-tips"), name: "Tips", slug: "tips", created_at: t },
    { id: seedId("blogtag-performa"), name: "Performa", slug: "performa", created_at: t },
    { id: seedId("blogtag-sekuritas"), name: "Sekuritas", slug: "sekuritas", created_at: t },
  ];

  const blogPosts: Row[] = [
    {
      id: seedId("blog-1"),
      title: "Cara Memilih Paket Hosting yang Tepat untuk Server Minecraft",
      slug: "cara-memilih-paket-hosting-minecraft",
      excerpt: "Memilih spesifikasi server Minecraft tidak harus membingungkan. Pelajari cara membaca kebutuhan CPU, RAM, dan penyimpanan berdasarkan jumlah pemain dan plugin.",
      content_md: `Memilih spesifikasi server Minecraft sering kali menjadi sumber kebingungan bagi pemilik server baru. Artikel ini membantu Anda memahami kebutuhan dasar tanpa harus menjadi administrator sistem.

## Mulai dari jumlah pemain

Jumlah pemain yang ingin Anda tampung adalah titik awal terbaik:

- **1–10 pemain**: server kecil cukup dengan 2 vCore dan 4 GB RAM.
- **10–30 pemain**: pertimbangkan 4 vCore dan 8 GB RAM agar tetap nyaman dengan plugin.
- **30+ pemain**: lihat paket dengan 8 vCore atau lebih, serta RAM 16 GB ke atas.

Ingat, RAM bukan satu-satunya faktor. CPU menentukan kecepatan tick server, sedangkan penyimpanan memengaruhi kecepatan loading world dan backup.

## Perhatikan plugin dan mod

Setiap plugin membutuhkan memori dan waktu proses. Sebagai aturan praktis, tambahkan 1–2 GB RAM di atas kebutuhan dasar bila Anda memakai 20+ plugin. Estimasi jumlah plugin yang disarankan juga ditampilkan di Server Builder WangStore berdasarkan konfigurasi Anda.

## Penyimpanan untuk world dan backup

World Minecraft dapat tumbuh dengan cepat, terutama dengan explorasi besar. Pilih penyimpanan dengan ruang cadangan minimal 2–3 kali ukuran world Anda untuk keperluan backup.

## Gunakan Server Builder

Di WangStore, Anda tidak perlu menghafal semua ini. Buka [Server Builder](/server-builder), pilih Tier **Low** untuk konfigurasi custom, dan lihat estimasi TPS, pemain konkuren, serta beban CPU dan RAM secara real-time sebelum memesan.`,
      category_id: seedId("blogcat-panduan"),
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Cara Memilih Paket Hosting untuk Server Minecraft",
      seo_description: "Panduan memilih spesifikasi server Minecraft berdasarkan jumlah pemain, plugin, dan kebutuhan penyimpanan.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("blog-2"),
      title: "Apa Itu TPS dan Mengapa Penting untuk Server Minecraft?",
      slug: "apa-itu-tps",
      excerpt: "TPS adalah singkatan dari ticks per second. Pelajari mengapa angka ini menentukan kelancaran server Minecraft dan bagaimana membacanya.",
      content_md: `TPS (ticks per second) mengukur seberapa cepat server Minecraft memproses tick permainan. Server yang sehat berjalan pada **20 TPS** — angka ini setara dengan kecepatan waktu nyata dalam game.

## Mengapa TPS menurun?

Beberapa penyebab umum:

- **CPU tidak mencukupi**: entitas, redstone, dan kalkulasi pathfinding membebani prosesor.
- **RAM terlalu kecil**: garbage collection menjadi lebih sering dan lama.
- **Plugin yang berat**: beberapa plugin melakukan kalkulasi besar setiap tick.
- **World yang sangat luas**: chunk loading dan simulasi entitas bertambah seiring ukuran world.

## TPS di Server Builder WangStore

Server Builder menampilkan **estimasi TPS** berdasarkan CPU, RAM, dan penyimpanan yang Anda pilih, beserta faktor performa Tier. Angka ini adalah estimasi deterministik untuk membantu Anda membandingkan konfigurasi — bukan jaminan atau SLA.

## Tips menjaga TPS tetap 20

1. Batasi jumlah entitas dan chunk yang dimuat.
2. Audit plugin secara berkala; hapus plugin yang tidak dipakai.
3. Gunakan pre-generation world untuk mengurangi beban loading.
4. Pilih spesifikasi yang sesuai kebutuhan, bukan yang minimal.

Jika server Anda sering mengalami penurunan TPS, pertimbangkan meningkatkan CPU dan RAM melalui paket yang tersedia di WangStore.`,
      category_id: seedId("blogcat-tips"),
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Apa Itu TPS dan Mengapa Penting untuk Server Minecraft?",
      seo_description: "Penjelasan tentang TPS (ticks per second) pada server Minecraft dan cara menjaganya tetap 20.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("blog-3"),
      title: "VPS vs Dedicated Server: Mana yang Sesuai untuk Anda?",
      slug: "vps-vs-dedicated-server",
      excerpt: "VPS membagi satu mesin fisik menjadi beberapa lingkungan virtual; dedicated server menyediakan seluruh mesin untuk Anda. Simak perbandingannya.",
      content_md: `Saat layanan Anda tumbuh, pilihan antara VPS dan dedicated server menjadi penting. Keduanya sah, tetapi melayani kebutuhan yang berbeda.

## VPS: fleksibel dan hemat

VPS (Virtual Private Server) membagi satu mesin fisik menjadi beberapa lingkungan virtual yang terisolasi. Keunggulannya:

- Harga lebih terjangkau untuk kebutuhan menengah.
- Prosesor dan RAM dapat disesuaikan dengan mudah.
- Cocok untuk server Minecraft menengah, aplikasi web, dan proyek developer.

## Dedicated server: performa penuh

Dedicated server menyediakan seluruh perangkat keras untuk satu pelanggan. Keunggulannya:

- Performa konsisten tanpa pengaruh tetangga.
- Kontrol penuh atas perangkat keras dan virtualisasi.
- Cocok untuk komunitas besar, aplikasi berat, dan bisnis.

## Bagaimana WangStore membantu

Di WangStore, paket VPS dan dedicated server ditampilkan dari katalog yang dikelola tim kami — lengkap dengan spesifikasi, lokasi, dan harga. Anda dapat membandingkan langsung, lalu membuat pesanan melalui alur yang sama: pilih paket, isi formulir, konfirmasi via WhatsApp.

## Sebelum memutuskan

Pertimbangkan: berapa banyak pemain atau pengguna? Seberapa kritis aplikasi Anda? Berapa anggaran bulanan? Jawaban atas pertanyaan ini akan mengarahkan Anda pada pilihan yang tepat. Bila ragu, konsultasikan melalui halaman [Kontak](/contact) sebelum memesan.`,
      category_id: seedId("blogcat-panduan"),
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "VPS vs Dedicated Server: Mana yang Sesuai untuk Anda?",
      seo_description: "Perbandingan VPS dan dedicated server: keunggulan, kekurangan, dan cara memilih yang tepat.",
      reading_time: 4,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("blog-4"),
      title: "WangStore: Platform Pemesanan Layanan Hosting yang Transparan",
      slug: "wangstore-platform-pemesanan-transparan",
      excerpt: "WangStore hadir dengan satu tujuan: membuat pemesanan layanan hosting sederhana, jujur, dan dapat dilacak.",
      content_md: `WangStore adalah platform e-commerce untuk menjual layanan hosting. Kami tidak menjalankan server Minecraft atau VPS di dalam aplikasi — kami membangun sistem pemesanan dan pengelolaan yang rapi di atasnya.

## Yang kami bangun

- **Server Builder** dengan tiga Tier: Low (konfigurasi custom), Medium, dan High (katalog paket).
- **Kalkulasi harga server-side** — harga ditentukan oleh server, bukan oleh browser.
- **Alur pesanan via WhatsApp** dengan ringkasan yang lengkap dan dapat dilacak.
- **Customer dashboard** untuk memantau pesanan, layanan, tiket, dan notifikasi.
- **Admin panel** dengan kontrol penuh: paket, harga, kupon, konten, dan audit log.

## Prinsip transparansi

Kami menampilkan estimasi sebagai *estimasi*, kebijakan refund dan SLA secara tertulis, dan status layanan secara jujur. Jika suatu informasi belum tersedia — misalnya detail perangkat keras — kami menyatakannya demikian.

## Mulai

Buka [Server Builder](/server-builder) untuk merancang server pertama Anda, atau pelajari lebih lanjut di [Knowledge Base](/knowledge-base).`,
      category_id: seedId("blogcat-pengumuman"),
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "WangStore: Platform Pemesanan Layanan Hosting yang Transparan",
      seo_description: "Pengumuman tentang WangStore, platform pemesanan layanan hosting dengan prinsip transparansi.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
  ];

  const knowledgeArticles: Row[] = [
    {
      id: seedId("kb-1"),
      title: "Memulai dengan WangStore",
      slug: "memulai-dengan-wangstore",
      excerpt: "Panduan langkah demi langkah untuk menggunakan WangStore: dari membuat akun hingga membuat pesanan pertama.",
      content_md: `Artikel ini memandu Anda menggunakan WangStore dari awal.

## 1. Buat akun (opsional, disarankan)

Buka halaman **Daftar**, isi email dan kata sandi, lalu verifikasi email Anda melalui tautan yang dikirim. Akun memungkinkan Anda menyimpan konfigurasi, melihat riwayat pesanan, dan membuka tiket.

## 2. Rancang server

Buka **Server Builder** dan pilih Tier:

- **Low** — atur CPU, RAM, dan penyimpanan sendiri.
- **Medium / High** — pilih dari katalog paket yang tersedia.

Harga dan estimasi performa ditampilkan real-time.

## 3. Buat pesanan

Isi formulir pesanan (nama, WhatsApp, email, nama server), terapkan kupon bila ada, lalu kirim. Ringkasan pesanan dikirim melalui WhatsApp.

## 4. Pantau di dashboard

Setelah masuk, buka **Dashboard** untuk melihat status pesanan dan layanan Anda.`,
      category: "Memulai",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Memulai dengan WangStore",
      seo_description: "Panduan langkah demi langkah menggunakan WangStore untuk pemula.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-2"),
      title: "Cara Membuat Pesanan",
      slug: "cara-membuat-pesanan",
      excerpt: "Langkah-langkah membuat pesanan layanan di WangStore, termasuk apa yang terjadi setelah pesanan dikirim.",
      content_md: `## Sebelum memesan

1. Tentukan kebutuhan Anda: berapa pemain, plugin apa yang dipakai, dan berapa anggaran.
2. Gunakan **Server Builder** untuk melihat harga dan estimasi performa.
3. Baca [Syarat Layanan](/terms), [Kebijakan Refund](/refund), dan [SLA](/sla).

## Mengisi formulir

- **Nama**, **WhatsApp**, dan **Email** digunakan untuk konfirmasi pesanan.
- **Nama Server** membantu kami mengidentifikasi pesanan Anda.
- **Kupon** bersifat opsional; diskon dihitung oleh server.

## Setelah pesanan dikirim

1. Anda mendapat nomor pesanan dan halaman konfirmasi.
2. Ringkasan otomatis dibuat untuk WhatsApp.
3. Tim meninjau pesanan dan menghubungi Anda untuk pembayaran.
4. Setelah pembayaran dikonfirmasi, layanan diaktifkan sesuai jadwal.`,
      category: "Pemesanan",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Cara Membuat Pesanan di WangStore",
      seo_description: "Langkah-langkah membuat pesanan layanan hosting di WangStore.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-3"),
      title: "Metode Pembayaran",
      slug: "metode-pembayaran",
      excerpt: "Bagaimana pembayaran diproses di WangStore dan apa yang terjadi setelah pembayaran dikonfirmasi.",
      content_md: `Pembayaran di WangStore diproses secara manual dan terarah.

## Alur pembayaran

1. Setelah pesanan dibuat, tim kami mengirimkan petunjuk pembayaran melalui WhatsApp.
2. Lakukan pembayaran sesuai instruksi.
3. Kirim bukti pembayaran untuk dikonfirmasi.
4. Setelah konfirmasi, status pesanan diperbarui menjadi **paid** dan layanan dijadwalkan.

## Status pesanan

- **Menunggu pembayaran** — pesanan diterima, menunggu pembayaran.
- **Dibayar** — pembayaran dikonfirmasi.
- **Diproses** — layanan sedang disiapkan.
- **Selesai** — layanan aktif sesuai jadwal.

> WangStore tidak akan menampilkan pembayaran berhasil palsu. Konfirmasi hanya dilakukan setelah pembayaran benar-benar diterima dan diverifikasi.`,
      category: "Pembayaran",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Metode Pembayaran WangStore",
      seo_description: "Alur pembayaran di WangStore: dari instruksi pembayaran hingga konfirmasi.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-4"),
      title: "Cara Mengubah Kata Sandi Akun",
      slug: "ubah-kata-sandi",
      excerpt: "Ubah kata sandi akun WangStore Anda melalui halaman profil atau melalui tautan reset.",
      content_md: `## Mengubah kata sandi saat masuk

1. Buka **Dashboard → Profil**.
2. Isi kata sandi lama dan kata sandi baru.
3. Simpan. Anda akan tetap masuk pada perangkat saat ini.

## Lupa kata sandi

1. Buka halaman **Lupa Kata Sandi**.
2. Masukkan email terdaftar.
3. Buka tautan reset dari email (berlaku terbatas dan sekali pakai).
4. Tetapkan kata sandi baru.

> Jika email tidak kunjung tiba, periksa folder spam. Pastikan SMTP sudah dikonfigurasi oleh pengelola platform.`,
      category: "Akun",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Cara Mengubah Kata Sandi Akun WangStore",
      seo_description: "Panduan mengubah kata sandi dan reset kata sandi akun WangStore.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-5"),
      title: "Apa Itu Server Builder?",
      slug: "apa-itu-server-builder",
      excerpt: "Server Builder adalah alat untuk merancang konfigurasi server Anda dengan harga dan estimasi performa real-time.",
      content_md: `Server Builder adalah fitur inti WangStore untuk merancang layanan sebelum memesan.

## Tiga Tier

| Tier | Mode | Penjelasan |
|------|------|------------|
| Low | Custom | Anda menentukan CPU, RAM, dan penyimpanan |
| Medium | Paket | Katalog paket dengan spesifikasi tetap |
| High | Paket | Katalog paket performa tinggi |

## Untuk Tier Low

Gunakan penggeser (slider) untuk mengatur:

- **CPU** — jumlah vCore.
- **RAM** — kapasitas memori.
- **Penyimpanan** — ruang disk.

Harga bulanan dan estimasi (TPS, pemain konkuren, beban CPU/RAM, rekomendasi plugin, grade build) diperbarui secara real-time.

## Untuk Tier Medium/High

Pilih dari kartu paket yang tersedia. Jika belum ada paket, akan tampil pesan bahwa belum ada paket yang tersedia — kami tidak menampilkan paket fiktif.`,
      category: "Memulai",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Apa Itu Server Builder?",
      seo_description: "Penjelasan Server Builder WangStore: Tier, konfigurasi custom, dan paket.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-6"),
      title: "Membaca Estimasi Performa di Server Builder",
      slug: "membaca-estimasi-performa",
      excerpt: "Apa arti estimasi TPS, pemain konkuren, beban CPU, dan penggunaan RAM di Server Builder.",
      content_md: `Angka-angka di Server Builder adalah **estimasi** — bukan SLA atau jaminan performa. Estimasi dihitung dengan model deterministik berdasarkan konfigurasi yang Anda pilih.

## Istilah

- **Estimasi TPS** — perkiraan ticks per second (20 = sehat).
- **Estimasi pemain konkuren** — perkiraan jumlah pemain yang dapat bermain bersamaan dengan nyaman.
- **Estimasi beban CPU** — perkiraan persentase beban prosesor.
- **Estimasi penggunaan RAM** — perkiraan persentase memori terpakai.
- **Rekomendasi plugin** — perkiraan jumlah plugin yang wajar.
- **Grade build** — penilaian keseluruhan konfigurasi (Standard / Medium / High).

## Cara membaca

Semakin tinggi beban CPU dan RAM, semakin dekat konfigurasi Anda ke batas nyamannya. Jika estimasi pemain jauh di bawah target Anda, naikkan CPU atau RAM.

> Performa aktual dipengaruhi banyak faktor di luar konfigurasi, seperti jenis beban kerja dan optimasi server.`,
      category: "Server",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Membaca Estimasi Performa di Server Builder",
      seo_description: "Cara membaca estimasi TPS, pemain, beban CPU, dan RAM di Server Builder WangStore.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-7"),
      title: "Menggunakan Kupon Diskon",
      slug: "menggunakan-kupon",
      excerpt: "Cara menerapkan kupon diskon saat pemesanan dan ketentuan yang berlaku.",
      content_md: `## Menerapkan kupon

1. Di formulir pemesanan, masukkan kode kupon pada kolom **Kupon**.
2. Sistem memvalidasi kupon (aktif, belum kedaluwarsa, belum melewati batas pemakaian, dan memenuhi syarat minimum).
3. Diskon dihitung oleh server dan ditampilkan pada ringkasan harga.

## Ketentuan

- Satu kupon per pesanan.
- Kupon dapat berupa diskon persentase atau nominal tetap.
- Kupon memiliki batas pemakaian total dan batas per pelanggan.
- Kupon dapat dibatasi untuk Tier atau jenis produk tertentu.

> Nilai diskon selalu dihitung ulang oleh server. Diskon yang dikirim dari browser tidak dipercaya.`,
      category: "Pemesanan",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Menggunakan Kupon Diskon di WangStore",
      seo_description: "Cara memakai kupon diskon saat pemesanan di WangStore.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-8"),
      title: "Membuka Tiket Dukungan",
      slug: "membuka-tiket-dukungan",
      excerpt: "Cara membuka tiket, membalas, dan menutup tiket dukungan di WangStore.",
      content_md: `## Membuka tiket

1. Masuk ke akun Anda.
2. Buka **Dashboard → Tiket**.
3. Klik **Buat Tiket**, pilih kategori dan prioritas, lalu tulis pertanyaan Anda.

Tanpa akun, Anda dapat menggunakan formulir di halaman [Kontak](/contact).

## Membalas

- Balasan Anda muncul di thread tiket.
- Staf membalas dengan status **Dijawab**.
- Jika Anda membalas lagi, status berubah menjadi **Balasan Pelanggan** sehingga staf tahu perlu menindaklanjuti.

## Menutup tiket

Anda dapat menutup tiket yang sudah selesai. Tiket tertutup tidak dapat dibuka kembali; buat tiket baru untuk pertanyaan lanjutan.`,
      category: "Memulai",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Membuka Tiket Dukungan WangStore",
      seo_description: "Panduan membuat, membalas, dan menutup tiket dukungan di WangStore.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-9"),
      title: "Status Pesanan dan Layanan",
      slug: "status-pesanan-dan-layanan",
      excerpt: "Perbedaan antara status pesanan dan status layanan, serta cara membacanya.",
      content_md: `WangStore membedakan dua status: status **pesanan** dan status **layanan**.

## Status pesanan

Menggambarkan perjalanan transaksi:

- pending — menunggu proses
- awaiting_payment — menunggu pembayaran
- paid — pembayaran diterima
- processing — sedang diproses
- completed — selesai
- cancelled — dibatalkan
- expired — kedaluwarsa
- refunded — dikembalikan

## Status layanan

Menggambarkan siklus hidup layanan setelah pesanan dikonfirmasi:

- pending — menunggu pembuatan
- scheduled — dijadwalkan (aktivasi di masa depan)
- active — aktif
- suspended — ditangguhkan
- expired — masa layanan habis
- cancelled — dibatalkan
- terminated — dihentikan permanen

> Status layanan dihitung dari waktu server/database, bukan waktu perangkat Anda.`,
      category: "Server",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Status Pesanan dan Layanan WangStore",
      seo_description: "Penjelasan status pesanan dan status layanan di WangStore.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-10"),
      title: "Memecahkan Masalah Umum",
      slug: "memecahkan-masalah-umum",
      excerpt: "Solusi untuk masalah umum: email tidak terkirim, halaman lambat, kupon ditolak, dan lainnya.",
      content_md: `## Email verifikasi tidak kunjung tiba

- Periksa folder spam/promosi.
- Pastikan email yang Anda daftarkan benar.
- Gunakan **Kirim Ulang Verifikasi** di halaman masuk.
- Jika tetap tidak tiba, kemungkinan SMTP belum dikonfigurasi pengelola platform — hubungi dukungan.

## Kupon ditolak

Periksa: kode benar, kupon masih aktif, belum kedaluwarsa, belum melewati batas pemakaian, dan nilai pesanan memenuhi minimum.

## Halaman konfirmasi pesanan tidak terbuka

Pastikan tautan nomor pesanan lengkap. Halaman pesanan bersifat noindex tetapi dapat diakses dengan ID pesanan.

## Layanan tidak muncul di dashboard

Layanan dibuat setelah pesanan dikonfirmasi pembayarannya. Jika pesanan masih menunggu pembayaran, layanan belum ada.

## Masih buntu?

Buka tiket dukungan dari **Dashboard → Tiket** dan sertakan nomor pesanan serta tangkapan layar bila perlu.`,
      category: "Troubleshooting",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Memecahkan Masalah Umum WangStore",
      seo_description: "Solusi masalah umum: email verifikasi, kupon ditolak, dan layanan tidak muncul.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-11"),
      title: "Kebijakan Refund dan SLA",
      slug: "kebijakan-refund-dan-sla",
      excerpt: "Ringkasan kebijakan refund dan SLA WangStore, dan bagaimana cara mengajukan kompensasi.",
      content_md: `## Ringkasan Refund

Semua pembelian bersifat final. Kompensasi hanya diberikan jika kesalahan terbukti berasal dari WangStore, dalam bentuk **kredit layanan**. Refund tunai hanya jika layanan sama sekali tidak dapat disediakan.

Tidak ada refund untuk: salah spesifikasi, salah paket, berubah pikiran, proyek dibatalkan, kurang memahami pengelolaan server, layanan tidak digunakan, kelalaian, atau pelanggaran kebijakan.

## Ringkasan SLA

- Target uptime: 99,9%.
- Kredit layanan: 99,0–99,89% → 10%; 95,0–98,99% → 25%; <95% → 50%.
- Target respons: Kritis 15 menit, Tinggi 1 jam, Normal 4 jam, Rendah 12 jam.

Dokumen lengkap: [Kebijakan Refund](/refund) dan [SLA](/sla). Pengajuan melalui tiket dengan nomor pesanan dan bukti yang dapat diverifikasi.`,
      category: "Kebijakan",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Kebijakan Refund dan SLA WangStore",
      seo_description: "Ringkasan kebijakan refund dan SLA WangStore.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-12"),
      title: "Perpanjangan Layanan",
      slug: "perpanjangan-layanan",
      excerpt: "Cara memperpanjang layanan, aturan perpanjangan, dan apa yang terjadi jika layanan kedaluwarsa.",
      content_md: `## Kapan bisa diperpanjang?

Layanan dapat diperpanjang jika:

- layanan masih memenuhi syarat (belum dihentikan permanen);
- produk/layanan memiliki pengaturan **dapat diperpanjang**; dan
- paket yang mendasari masih valid.

## Cara memperpanjang

1. Buka **Dashboard → Layanan Saya**.
2. Pilih layanan, klik **Perpanjang Layanan**.
3. Pilih durasi perpanjangan.
4. Ikuti alur pemesanan dan konfirmasi pembayaran.

## Perhitungan masa aktif

- Layanan **aktif**: masa baru dihitung dari tanggal kedaluwarsa saat ini.
- Layanan **kedaluwarsa**: masa baru dihitung dari waktu server saat perpanjangan disetujui.

Perpanjangan memakai harga yang berlaku pada saat perpanjangan dibuat dan selalu dihitung oleh server.

## Pengingat

Sistem mengirim pengingat otomatis mendekati kedaluwarsa (7, 3, dan 1 hari sebelumnya, serta saat kedaluwarsa) melalui notifikasi dashboard. Email/WhatsApp menyusul bila integrasi dikonfigurasi.`,
      category: "Server",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Perpanjangan Layanan WangStore",
      seo_description: "Cara memperpanjang layanan di WangStore dan aturan perhitungan masa aktif.",
      reading_time: 3,
      created_at: t,
      updated_at: t,
    },
    {
      id: seedId("kb-13"),
      title: "Verifikasi Email Akun",
      slug: "verifikasi-email",
      excerpt: "Mengapa verifikasi email diperlukan dan bagaimana cara memverifikasi akun Anda.",
      content_md: `## Mengapa verifikasi?

Verifikasi email memastikan alamat email yang Anda daftarkan benar-benar milik Anda. Ini melindungi akun dan mencegah penyalahgunaan.

## Cara memverifikasi

1. Setelah mendaftar, tautan verifikasi dikirim ke email Anda.
2. Klik tautan tersebut (berlaku terbatas, sekali pakai).
3. Akun Anda terverifikasi dan akses penuh terbuka.

## Jika tautan kedaluwarsa

Gunakan tombol **Kirim Ulang Verifikasi** di halaman masuk. Tautan baru akan dikirim.

> Akun yang belum terverifikasi tidak dapat mengakses seluruh fitur platform.`,
      category: "Akun",
      author_name: "Tim WangStore",
      status: "published",
      published_at: t,
      seo_title: "Verifikasi Email Akun WangStore",
      seo_description: "Panduan verifikasi email akun WangStore.",
      reading_time: 2,
      created_at: t,
      updated_at: t,
    },
  ];

  const announcements: Row[] = [
    {
      id: seedId("ann-1"),
      title: "Selamat datang di WangStore",
      message_md: "WangStore adalah platform pemesanan dan pengelolaan layanan hosting. Gunakan **Server Builder** untuk merancang server Anda, dan baca [Knowledge Base](/knowledge-base) untuk panduan memulai.",
      status: "active",
      starts_at: t,
      ends_at: null,
      created_at: t,
      updated_at: t,
    },
  ];

  return {
    roles,
    permissions,
    role_permissions: rolePermissions,
    server_tiers: serverTiers,
    pricing_rules: pricingRules,
    settings,
    pages,
    legal_documents: legalDocuments,
    faq_items: faqItems,
    blog_categories: blogCategories,
    blog_tags: blogTags,
    blog_posts: blogPosts,
    knowledge_articles: knowledgeArticles,
    announcements,
    users: [],
    profiles: [],
    sessions: [],
    auth_tokens: [],
    server_packages: [],
    vps_locations: [],
    vps_packages: [],
    products: [],
    orders: [],
    order_items: [],
    service_instances: [],
    service_renewals: [],
    service_reminders: [],
    notifications: [],
    coupons: [],
    coupon_usages: [],
    tickets: [],
    ticket_messages: [],
    saved_configurations: [],
    testimonials: [],
    incidents: [],
    maintenance_windows: [],
    audit_logs: [],
  };
}

/** Daftar nama tabel (digunakan untuk migrasi & validasi seed). */
export const ALL_TABLES = Object.keys(getSeedData());
