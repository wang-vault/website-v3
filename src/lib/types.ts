import type { Row } from "@/lib/db/types";

export type RoleSlug = "owner" | "admin" | "staff" | "customer";

export interface Role extends Row {
  id: string;
  slug: RoleSlug;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface User extends Row {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: string | null;
  role_id: string;
  status: "active" | "disabled";
  last_login_at: string | null;
  last_login_ip: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile extends Row {
  id: string;
  user_id: string;
  full_name: string;
  whatsapp: string;
  discord: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow extends Row {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  ip: string;
  user_agent: string;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface AuthToken extends Row {
  id: string;
  user_id: string;
  purpose: "verify_email" | "reset_password";
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface ServerTier extends Row {
  id: string;
  name: string;
  slug: "low" | "medium" | "high";
  mode: "custom" | "package";
  description: string;
  status: "active" | "inactive";
  visible: boolean;
  orderable: boolean;
  performance_factor: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface LowLimits {
  min: number;
  max: number;
  step: number;
}

export interface LowPricingRules extends Row {
  id: string;
  tier_id: string;
  base: number;
  per_core: number;
  per_gb_ram: number;
  per_gb_storage: number;
  min_price: number;
  max_price: number | null;
  rounding: number;
  cpu_min: number;
  cpu_max: number;
  cpu_step: number;
  ram_min: number;
  ram_max: number;
  ram_step: number;
  storage_min: number;
  storage_max: number;
  storage_step: number;
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ServerPackageStatus = "available" | "maintenance" | "sold_out" | "inactive";

export interface ServerPackage extends Row {
  id: string;
  tier_id: string;
  name: string;
  slug: string;
  cpu: number;
  ram: number;
  storage: number;
  price: number;
  description: string;
  status: ServerPackageStatus;
  visible: boolean;
  orderable: boolean;
  popular: boolean;
  popular_label: string | null;
  performance_factor: number;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VpsPackageStatus = ServerPackageStatus;

export interface VpsLocation extends Row {
  id: string;
  name: string;
  country: string;
  city: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface VpsPackage extends Row {
  id: string;
  name: string;
  slug: string;
  cpu: number;
  ram: number;
  storage: number;
  bandwidth: string;
  ipv4_available: boolean;
  location_id: string | null;
  virtualization: string;
  price: number;
  billing_period: string;
  renewable: boolean;
  description: string;
  features: string[];
  status: VpsPackageStatus;
  visible: boolean;
  stock: number | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductType = "server_builder" | "vps";

export interface Product extends Row {
  id: string;
  type: ProductType;
  name: string;
  slug: string;
  description: string;
  tier_id: string | null;
  server_package_id: string | null;
  vps_package_id: string | null;
  status: string;
  visibility: boolean;
  price: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired"
  | "refunded";

export interface Order extends Row {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  customer_email: string;
  server_name: string;
  notes: string;
  tier_slug: "low" | "medium" | "high";
  tier_name: string;
  package_id: string | null;
  package_name: string | null;
  cpu: number;
  ram: number;
  storage: number;
  price_raw: number;
  discount: number;
  total: number;
  coupon_code: string | null;
  status: OrderStatus;
  payment_provider: "manual";
  currency: "IDR";
  whatsapp_number: string;
  source: "web" | "renewal";
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
}

export interface OrderItem extends Row {
  id: string;
  order_id: string;
  product_id: string | null;
  product_type: ProductType;
  product_name: string;
  tier_slug: string | null;
  package_id: string | null;
  package_name: string | null;
  cpu: number;
  ram: number;
  storage: number;
  unit_price: number;
  quantity: number;
  total_price: number;
  metadata: Record<string, unknown>;
}

export type ServiceStatus =
  | "pending"
  | "scheduled"
  | "active"
  | "suspended"
  | "expired"
  | "cancelled"
  | "terminated";

export interface ServiceInstance extends Row {
  id: string;
  service_number: string;
  customer_id: string;
  order_id: string;
  product_id: string | null;
  package_id: string | null;
  service_type: ProductType;
  name: string;
  status: ServiceStatus;
  activation_at: string;
  expires_at: string;
  renewable: boolean;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceRenewal extends Row {
  id: string;
  service_id: string;
  order_id: string | null;
  duration_days: number;
  old_expires_at: string | null;
  new_expires_at: string;
  price: number;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
  completed_at: string | null;
}

export type ReminderType = "expiry_7d" | "expiry_3d" | "expiry_1d" | "expired";

export interface ServiceReminder extends Row {
  id: string;
  service_id: string;
  customer_id: string;
  reminder_type: ReminderType;
  scheduled_at: string;
  sent_at: string | null;
  status: "scheduled" | "sent" | "skipped" | "failed";
  channel: "dashboard" | "email" | "whatsapp";
  created_at: string;
}

export interface NotificationRow extends Row {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Coupon extends Row {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_order: number;
  max_usage: number | null;
  usage_per_customer: number | null;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  applicable_tiers: string[] | null;
  applicable_product_types: ProductType[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponUsage extends Row {
  id: string;
  coupon_id: string;
  order_id: string;
  user_id: string | null;
  code: string;
  discount: number;
  created_at: string;
}

export interface Ticket extends Row {
  id: string;
  ticket_number: string;
  user_id: string | null;
  name: string;
  email: string;
  whatsapp: string;
  subject: string;
  category: string;
  priority: "rendah" | "normal" | "tinggi" | "kritis";
  status: "open" | "answered" | "customer_reply" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TicketMessage extends Row {
  id: string;
  ticket_id: string;
  sender_type: "customer" | "staff" | "system";
  sender_id: string | null;
  message: string;
  created_at: string;
}

export interface SavedConfiguration extends Row {
  id: string;
  user_id: string | null;
  guest_key: string | null;
  name: string;
  tier_slug: "low" | "medium" | "high";
  package_id: string | null;
  cpu: number;
  ram: number;
  storage: number;
  price: number;
  created_at: string;
  updated_at: string;
}

export type IncidentSeverity = "degraded" | "major";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface Incident extends Row {
  id: string;
  title: string;
  message_md: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceWindow extends Row {
  id: string;
  title: string;
  message: string;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface Announcement extends Row {
  id: string;
  title: string;
  message_md: string;
  status: "draft" | "active";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FaqItem extends Row {
  id: string;
  question: string;
  answer_md: string;
  category: string;
  sort: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Testimonial extends Row {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  status: "pending" | "published";
  created_at: string;
  updated_at: string;
}

export type PageSection =
  | {
      type: "hero";
      title: string;
      subtitle: string;
      ctaLabel?: string;
      ctaHref?: string;
      ctaSecondaryLabel?: string;
      ctaSecondaryHref?: string;
    }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; title: string; items: string[] }
  | { type: "cta"; title: string; description: string; label: string; href: string }
  | { type: "card"; title: string; description: string; icon?: string };

export interface Page extends Row {
  id: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  sections: PageSection[];
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface LegalDocument extends Row {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  version: number;
  updated_at: string;
  created_at: string;
}

export interface BlogCategory extends Row {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogTag extends Row {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogPost extends Row {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_md: string;
  category_id: string | null;
  author_name: string;
  status: "draft" | "published";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  reading_time: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeArticle extends Row {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_md: string;
  category: string;
  author_name: string;
  status: "draft" | "published";
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  reading_time: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLog extends Row {
  id: string;
  actor_type: "user" | "system";
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Setting extends Row {
  id: string;
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface Permission extends Row {
  id: string;
  key: string;
  module: string;
  description: string;
  created_at: string;
}

export interface RolePermission extends Row {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
}

/** Ringkasan identitas user yang sudah terautentikasi. */
export interface AuthedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  roleId: string;
  roleSlug: RoleSlug;
  roleName: string;
  permissions: Set<string>;
  profile: { fullName: string; whatsapp: string; discord: string };
}
