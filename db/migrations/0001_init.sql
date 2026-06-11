-- Orkestra Data Lens — schéma initial V1
-- Exécuté par scripts/migrate.mjs (idempotent : IF NOT EXISTS partout).

create extension if not exists pgcrypto;

-- ─── Boutiques ────────────────────────────────────────────────────────────────

create table if not exists shops (
  id               uuid primary key default gen_random_uuid(),
  shopify_domain   text not null unique,
  name             text,
  currency         text not null default 'EUR',
  timezone         text not null default 'Europe/Paris',
  is_demo          boolean not null default false,
  api_status       text not null default 'disconnected'
                   check (api_status in ('connected','disconnected','error','demo')),
  pixel_status     text not null default 'not_installed'
                   check (pixel_status in ('installed','not_installed','error','demo')),
  installed_scopes text,
  connected_at     timestamptz,
  uninstalled_at   timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists shopify_tokens (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null unique references shops(id) on delete cascade,
  encrypted_token text not null,
  scopes          text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Catalogue ────────────────────────────────────────────────────────────────

create table if not exists products (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  shopify_product_id text not null,
  title              text not null,
  handle             text,
  vendor             text,
  product_type       text,
  status             text not null default 'active',
  image_url          text,
  price_min          numeric(12,2) not null default 0,
  price_max          numeric(12,2) not null default 0,
  cost               numeric(12,2),
  stock              integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, shopify_product_id)
);
create index if not exists products_shop_idx on products(shop_id);

create table if not exists product_variants (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  product_id         uuid not null references products(id) on delete cascade,
  shopify_variant_id text not null,
  title              text,
  sku                text,
  price              numeric(12,2),
  compare_at_price   numeric(12,2),
  inventory_quantity integer,
  cost               numeric(12,2),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, shopify_variant_id)
);
create index if not exists product_variants_product_idx on product_variants(product_id);

-- ─── Clients (emails masqués : jamais d'email en clair en base) ───────────────

create table if not exists customers (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references shops(id) on delete cascade,
  shopify_customer_id text not null,
  email_masked        text,
  country             text,
  orders_count        integer default 0,
  total_spent         numeric(12,2) default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (shop_id, shopify_customer_id)
);

-- ─── Commandes ────────────────────────────────────────────────────────────────

create table if not exists orders (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  shopify_order_id   text not null,
  order_number       text,
  created_at_shopify timestamptz not null,
  processed_at       timestamptz,
  cancelled_at       timestamptz,
  total_price        numeric(12,2) not null default 0,
  currency           text not null default 'EUR',
  financial_status   text,
  cart_token         text,
  checkout_token     text,
  customer_id        uuid references customers(id) on delete set null,
  source_name        text,
  referring_site     text,
  landing_site       text,
  country            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, shopify_order_id)
);
create index if not exists orders_shop_created_idx on orders(shop_id, created_at_shopify desc);
create index if not exists orders_cart_token_idx on orders(shop_id, cart_token) where cart_token is not null;
create index if not exists orders_checkout_token_idx on orders(shop_id, checkout_token) where checkout_token is not null;

create table if not exists order_line_items (
  id                   uuid primary key default gen_random_uuid(),
  shop_id              uuid not null references shops(id) on delete cascade,
  order_id             uuid not null references orders(id) on delete cascade,
  shopify_line_item_id text not null,
  shopify_product_id   text,
  shopify_variant_id   text,
  title                text,
  sku                  text,
  quantity             integer not null default 1,
  price                numeric(12,2) not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (shop_id, shopify_line_item_id)
);
create index if not exists order_line_items_order_idx on order_line_items(order_id);

create table if not exists refunds (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  order_id           uuid references orders(id) on delete cascade,
  shopify_refund_id  text not null,
  amount             numeric(12,2) not null default 0,
  currency           text not null default 'EUR',
  note               text,
  created_at_shopify timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, shopify_refund_id)
);
create index if not exists refunds_shop_idx on refunds(shop_id, created_at_shopify desc);

-- ─── Tracking ─────────────────────────────────────────────────────────────────

create table if not exists visitor_sessions (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references shops(id) on delete cascade,
  session_key       text not null,
  visitor_key       text not null,
  started_at        timestamptz not null,
  ended_at          timestamptz,
  duration_seconds  integer,
  source            text,
  medium            text,
  campaign          text,
  landing_page      text,
  referrer          text,
  device            text not null default 'desktop',
  browser           text,
  country           text,
  status            text not null default 'active'
                    check (status in ('active','converted','abandoned','incomplete','suspect')),
  reliability_score integer not null default 80,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shop_id, session_key)
);
create index if not exists visitor_sessions_shop_started_idx on visitor_sessions(shop_id, started_at desc);

create table if not exists tracking_events (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shops(id) on delete cascade,
  session_id     uuid references visitor_sessions(id) on delete cascade,
  session_key    text not null,
  visitor_key    text not null,
  event_name     text not null,
  occurred_at    timestamptz not null,
  page_url       text,
  referrer       text,
  source         text,
  medium         text,
  campaign       text,
  content        text,
  term           text,
  device         text,
  browser        text,
  country        text,
  product_id     text,
  variant_id     text,
  sku            text,
  product_title  text,
  variant_title  text,
  quantity       integer,
  price          numeric(12,2),
  currency       text,
  cart_token     text,
  checkout_token text,
  order_id       text,
  customer_id    text,
  status         text not null default 'observed'
                 check (status in ('observed','confirmed','reconciled','incomplete','out_of_period','suspect')),
  metadata       jsonb,
  dedupe_key     text not null,
  created_at     timestamptz not null default now(),
  unique (shop_id, dedupe_key)
);
create index if not exists tracking_events_shop_time_idx on tracking_events(shop_id, occurred_at desc);
create index if not exists tracking_events_session_idx on tracking_events(shop_id, session_key);
create index if not exists tracking_events_cart_idx on tracking_events(shop_id, cart_token) where cart_token is not null;
create index if not exists tracking_events_checkout_idx on tracking_events(shop_id, checkout_token) where checkout_token is not null;

-- ─── Anomalies (instantané de la dernière réconciliation) ────────────────────

create table if not exists anomalies (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  anomaly_key        text not null,
  type               text not null,
  severity           text not null check (severity in ('low','medium','high','critical')),
  title              text not null,
  description        text not null,
  detected_at        timestamptz not null default now(),
  affected_sessions  integer not null default 0,
  affected_revenue   numeric(12,2),
  probable_cause     text,
  recommended_action text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, anomaly_key)
);

-- ─── Synchronisations & webhooks ─────────────────────────────────────────────

create table if not exists sync_runs (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  status             text not null default 'running' check (status in ('running','success','error')),
  range_days         integer not null default 30,
  started_at         timestamptz not null default now(),
  finished_at        timestamptz,
  products_synced    integer not null default 0,
  variants_synced    integer not null default 0,
  orders_synced      integer not null default 0,
  line_items_synced  integer not null default 0,
  refunds_synced     integer not null default 0,
  customers_synced   integer not null default 0,
  error_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists sync_runs_shop_idx on sync_runs(shop_id, started_at desc);

create table if not exists webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid references shops(id) on delete set null,
  delivery_id   text not null unique,
  topic         text not null,
  shop_domain   text,
  status        text not null default 'received'
                check (status in ('received','processed','error','duplicate')),
  error_message text,
  payload       jsonb,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists webhook_deliveries_shop_idx on webhook_deliveries(shop_id, received_at desc);
