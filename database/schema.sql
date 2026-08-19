-- ============================================================
-- WangStore — Database Schema (PostgreSQL)
-- Source of truth produksi. Konsisten dengan domain model di
-- src/lib (types.ts, db/seed.ts, pricing, services).
--
-- Cara menjalankan:
--   npm run db:migrate        (membaca file ini)
--   npm run db:seed           (mengisi data awal idempotent)
--
-- Provider target: PostgreSQL cloud/serverless
-- (Supabase, Neon, Vercel Postgres, Railway, dll).
-- ============================================================

-- ------------------------------------------------------------
-- RBAC: roles, permissions, role_permissions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          UUID PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  module      TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id            UUID PRIMARY KEY,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

-- ------------------------------------------------------------
-- Akun: users, profiles, sessions, auth_tokens
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  role_id           UUID NOT NULL REFERENCES roles(id),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at     TIMESTAMPTZ,
  last_login_ip     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL DEFAULT '',
  whatsapp   TEXT NOT NULL DEFAULT '',
  discord    TEXT NOT NULL DEFAULT '',
  bio        TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (purpose, token_hash)
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);

-- ------------------------------------------------------------
-- Katalog & harga: server_tiers, pricing_rules, server_packages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS server_tiers (
  id                UUID PRIMARY KEY,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  mode              TEXT NOT NULL CHECK (mode IN ('custom', 'package')),
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  visible           BOOLEAN NOT NULL DEFAULT true,
  orderable         BOOLEAN NOT NULL DEFAULT true,
  performance_factor NUMERIC(6,3) NOT NULL DEFAULT 1,
  sort              INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id            UUID PRIMARY KEY,
  tier_id       UUID NOT NULL UNIQUE REFERENCES server_tiers(id) ON DELETE CASCADE,
  base          INTEGER NOT NULL,
  per_core      INTEGER NOT NULL,
  per_gb_ram    INTEGER NOT NULL,
  per_gb_storage INTEGER NOT NULL,
  min_price     INTEGER NOT NULL,
  max_price     INTEGER,
  rounding      INTEGER NOT NULL DEFAULT 500,
  cpu_min       INTEGER NOT NULL,
  cpu_max       INTEGER NOT NULL,
  cpu_step      INTEGER NOT NULL DEFAULT 1,
  ram_min       INTEGER NOT NULL,
  ram_max       INTEGER NOT NULL,
  ram_step      INTEGER NOT NULL DEFAULT 2,
  storage_min   INTEGER NOT NULL,
  storage_max   INTEGER NOT NULL,
  storage_step  INTEGER NOT NULL DEFAULT 10,
  version       INTEGER NOT NULL DEFAULT 1,
  updated_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS server_packages (
  id                UUID PRIMARY KEY,
  tier_id           UUID NOT NULL REFERENCES server_tiers(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  cpu               INTEGER NOT NULL,
  ram               INTEGER NOT NULL,
  storage           INTEGER NOT NULL,
  price             INTEGER NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'maintenance', 'sold_out', 'inactive')),
  visible           BOOLEAN NOT NULL DEFAULT true,
  orderable         BOOLEAN NOT NULL DEFAULT true,
  popular           BOOLEAN NOT NULL DEFAULT false,
  popular_label     TEXT,
  performance_factor NUMERIC(6,3) NOT NULL DEFAULT 1,
  created_by        UUID REFERENCES users(id),
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_server_packages_tier ON server_packages(tier_id);
CREATE INDEX IF NOT EXISTS idx_server_packages_status ON server_packages(status);

-- ------------------------------------------------------------
-- Katalog VPS: vps_locations, vps_packages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vps_locations (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  country    TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vps_packages (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  cpu           INTEGER NOT NULL,
  ram           INTEGER NOT NULL,
  storage       INTEGER NOT NULL,
  bandwidth     TEXT NOT NULL DEFAULT '',
  ipv4_available BOOLEAN NOT NULL DEFAULT true,
  location_id   UUID REFERENCES vps_locations(id) ON DELETE SET NULL,
  virtualization TEXT NOT NULL DEFAULT 'KVM',
  price         INTEGER NOT NULL,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  renewable     BOOLEAN NOT NULL DEFAULT true,
  description   TEXT NOT NULL DEFAULT '',
  features      JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'maintenance', 'sold_out', 'inactive')),
  visible       BOOLEAN NOT NULL DEFAULT true,
  stock         INTEGER,
  created_by    UUID REFERENCES users(id),
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vps_packages_status ON vps_packages(status);
CREATE INDEX IF NOT EXISTS idx_vps_packages_location ON vps_packages(location_id);

-- ------------------------------------------------------------
-- Produk terpadu (satu katalog untuk order)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                 UUID PRIMARY KEY,
  type               TEXT NOT NULL CHECK (type IN ('server_builder', 'vps')),
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  description        TEXT NOT NULL DEFAULT '',
  tier_id            UUID REFERENCES server_tiers(id) ON DELETE SET NULL,
  server_package_id  UUID REFERENCES server_packages(id) ON DELETE SET NULL,
  vps_package_id     UUID REFERENCES vps_packages(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'active',
  visibility         BOOLEAN NOT NULL DEFAULT true,
  price              INTEGER NOT NULL DEFAULT 0,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_package_id),
  UNIQUE (vps_package_id)
);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ------------------------------------------------------------
-- Pesanan: orders, order_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY,
  order_number      TEXT NOT NULL UNIQUE,
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  server_name       TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  tier_slug         TEXT NOT NULL CHECK (tier_slug IN ('low', 'medium', 'high')),
  tier_name         TEXT NOT NULL,
  package_id        UUID REFERENCES server_packages(id) ON DELETE SET NULL,
  package_name      TEXT,
  cpu               INTEGER NOT NULL,
  ram               INTEGER NOT NULL,
  storage           INTEGER NOT NULL,
  price_raw         INTEGER NOT NULL,
  discount          INTEGER NOT NULL DEFAULT 0,
  total             INTEGER NOT NULL,
  coupon_code       TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                    ('pending', 'awaiting_payment', 'paid', 'processing', 'completed',
                     'cancelled', 'expired', 'refunded')),
  payment_provider  TEXT NOT NULL DEFAULT 'manual',
  currency          TEXT NOT NULL DEFAULT 'IDR',
  whatsapp_number   TEXT NOT NULL DEFAULT '',
  source            TEXT NOT NULL DEFAULT 'web',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id            UUID PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_type  TEXT NOT NULL CHECK (product_type IN ('server_builder', 'vps')),
  product_name  TEXT NOT NULL,
  tier_slug     TEXT,
  package_id    UUID,
  package_name  TEXT,
  cpu           INTEGER NOT NULL DEFAULT 0,
  ram           INTEGER NOT NULL DEFAULT 0,
  storage       INTEGER NOT NULL DEFAULT 0,
  unit_price    INTEGER NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  total_price   INTEGER NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ------------------------------------------------------------
-- Kupon: coupons, coupon_usages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id                      UUID PRIMARY KEY,
  code                    TEXT NOT NULL UNIQUE,
  type                    TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value                   INTEGER NOT NULL,
  min_order               INTEGER NOT NULL DEFAULT 0,
  max_usage               INTEGER,
  usage_per_customer      INTEGER,
  starts_at               TIMESTAMPTZ,
  expires_at              TIMESTAMPTZ,
  active                  BOOLEAN NOT NULL DEFAULT true,
  applicable_tiers        JSONB,
  applicable_product_types JSONB,
  created_by              UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id         UUID PRIMARY KEY,
  coupon_id  UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  code       TEXT NOT NULL,
  discount   INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user ON coupon_usages(user_id);

-- ------------------------------------------------------------
-- Siklus hidup layanan: service_instances, renewals, reminders
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_instances (
  id            UUID PRIMARY KEY,
  service_number TEXT NOT NULL UNIQUE,
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  package_id    UUID,
  service_type  TEXT NOT NULL CHECK (service_type IN ('server_builder', 'vps')),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                ('pending', 'scheduled', 'active', 'suspended', 'expired',
                 'cancelled', 'terminated')),
  activation_at TIMESTAMPTZ NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  renewable     BOOLEAN NOT NULL DEFAULT true,
  price         INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_customer ON service_instances(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON service_instances(status);
CREATE INDEX IF NOT EXISTS idx_services_expires ON service_instances(expires_at);

CREATE TABLE IF NOT EXISTS service_renewals (
  id             UUID PRIMARY KEY,
  service_id     UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
  duration_days  INTEGER NOT NULL,
  old_expires_at TIMESTAMPTZ,
  new_expires_at TIMESTAMPTZ NOT NULL,
  price          INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_renewals_service ON service_renewals(service_id);

CREATE TABLE IF NOT EXISTS service_reminders (
  id            UUID PRIMARY KEY,
  service_id    UUID NOT NULL REFERENCES service_instances(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('expiry_7d', 'expiry_3d', 'expiry_1d', 'expired')),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'skipped', 'failed')),
  channel       TEXT NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard', 'email', 'whatsapp')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotensi: satu reminder per layanan per tipe
  UNIQUE (service_id, reminder_type)
);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON service_reminders(status);

-- ------------------------------------------------------------
-- Notifikasi & tiket
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tickets (
  id            UUID PRIMARY KEY,
  ticket_number TEXT NOT NULL UNIQUE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  whatsapp      TEXT NOT NULL DEFAULT '',
  subject       TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'Umum',
  priority      TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('rendah', 'normal', 'tinggi', 'kritis')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'customer_reply', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id          UUID PRIMARY KEY,
  ticket_id   UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'staff', 'system')),
  sender_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);

-- ------------------------------------------------------------
-- Konfigurasi tersimpan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_configurations (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_key  TEXT,
  name       TEXT NOT NULL DEFAULT 'Konfigurasi Saya',
  tier_slug  TEXT NOT NULL CHECK (tier_slug IN ('low', 'medium', 'high')),
  package_id UUID,
  cpu        INTEGER NOT NULL DEFAULT 0,
  ram        INTEGER NOT NULL DEFAULT 0,
  storage    INTEGER NOT NULL DEFAULT 0,
  price      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_configs_user ON saved_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_configs_guest ON saved_configurations(guest_key);

-- ------------------------------------------------------------
-- CMS: pages, legal_documents, faq_items, testimonials,
--      blog_categories, blog_tags, blog_posts, knowledge_articles,
--      announcements, incidents, maintenance_windows
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
  id             UUID PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  seo_title      TEXT,
  seo_description TEXT,
  sections       JSONB NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_documents (
  id         UUID PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  sections   JSONB NOT NULL DEFAULT '[]',
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faq_items (
  id          UUID PRIMARY KEY,
  question    TEXT NOT NULL,
  answer_md   TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Umum',
  sort        INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS testimonials (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id         UUID PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  excerpt         TEXT NOT NULL DEFAULT '',
  content_md      TEXT NOT NULL,
  category_id     UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_name     TEXT NOT NULL DEFAULT 'Tim WangStore',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at    TIMESTAMPTZ,
  seo_title       TEXT,
  seo_description TEXT,
  reading_time    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category_id);

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id              UUID PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  excerpt         TEXT NOT NULL DEFAULT '',
  content_md      TEXT NOT NULL,
  category        TEXT NOT NULL,
  author_name     TEXT NOT NULL DEFAULT 'Tim WangStore',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at    TIMESTAMPTZ,
  seo_title       TEXT,
  seo_description TEXT,
  reading_time    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kb_status ON knowledge_articles(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_articles(category);

CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY,
  title      TEXT NOT NULL,
  message_md TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active')),
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id          UUID PRIMARY KEY,
  title       TEXT NOT NULL,
  message_md  TEXT NOT NULL DEFAULT '',
  severity    TEXT NOT NULL DEFAULT 'major' CHECK (severity IN ('degraded', 'major')),
  status      TEXT NOT NULL DEFAULT 'investigating'
              CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id         UUID PRIMARY KEY,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL DEFAULT '',
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Audit & pengaturan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY,
  actor_type  TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  actor_id    UUID,
  actor_email TEXT,
  action      TEXT NOT NULL,
  resource    TEXT NOT NULL,
  resource_id TEXT,
  ip          TEXT,
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);

CREATE TABLE IF NOT EXISTS settings (
  id         UUID PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
