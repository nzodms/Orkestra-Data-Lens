-- Order Desk : fournisseurs, offres produit→fournisseur, devis, messages
-- WhatsApp, statuts opérationnels des commandes, notes internes, templates.
-- Idempotent — ne touche pas aux 13 tables existantes.

-- Statut de fulfillment Shopify sur les commandes (sync + webhooks)
alter table orders add column if not exists fulfillment_status text;

create table if not exists suppliers (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  name               text not null,
  whatsapp           text,
  email              text,
  website            text,
  country            text,
  currency           text not null default 'USD',
  avg_lead_time_days integer,
  reliability_score  integer not null default 80 check (reliability_score between 0 and 100),
  orders_count       integer not null default 0,
  problem_rate       numeric(5,2) not null default 0,
  last_contact_at    timestamptz,
  notes              text,
  tags               text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, name)
);
create index if not exists suppliers_shop_idx on suppliers(shop_id);

-- Association produit Shopify → fournisseur (offre de référence)
create table if not exists product_suppliers (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  supplier_id        uuid not null references suppliers(id) on delete cascade,
  shopify_product_id text not null,
  product_price      numeric(12,2) not null default 0,
  shipping_price     numeric(12,2) not null default 0,
  lead_time_days     integer,
  moq                integer not null default 1,
  stock              integer,
  product_url        text,
  note               text,
  preferred          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (shop_id, supplier_id, shopify_product_id)
);
create index if not exists product_suppliers_product_idx on product_suppliers(shop_id, shopify_product_id);

-- Devis reçus (suite à une demande de prix, liés à une commande si pertinent)
create table if not exists supplier_quotes (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  supplier_id        uuid not null references suppliers(id) on delete cascade,
  order_id           uuid references orders(id) on delete set null,
  shopify_product_id text,
  product_price      numeric(12,2) not null default 0,
  shipping_price     numeric(12,2) not null default 0,
  lead_time_days     integer,
  status             text not null default 'received'
                     check (status in ('requested','received','selected','rejected')),
  note               text,
  received_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists supplier_quotes_order_idx on supplier_quotes(shop_id, order_id);

-- Messages fournisseurs (V1 : préparés puis envoyés manuellement via wa.me)
create table if not exists supplier_messages (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops(id) on delete cascade,
  supplier_id  uuid not null references suppliers(id) on delete cascade,
  order_id     uuid references orders(id) on delete set null,
  template_key text not null,
  channel      text not null default 'whatsapp',
  body         text not null,
  status       text not null default 'prepared'
               check (status in ('prepared','sent_manual','reply_received','price_filled','supplier_selected')),
  prepared_at  timestamptz not null default now(),
  sent_at      timestamptz,
  reply_at     timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists supplier_messages_shop_idx on supplier_messages(shop_id, prepared_at desc);
create index if not exists supplier_messages_order_idx on supplier_messages(shop_id, order_id);

-- Statut opérationnel par commande (workflow Order Desk)
create table if not exists order_supplier_statuses (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops(id) on delete cascade,
  order_id         uuid not null references orders(id) on delete cascade,
  ops_status       text not null default 'todo'
                   check (ops_status in (
                     'todo','sourcing','price_compare','supplier_chosen','message_sent',
                     'payment_pending','ordered','tracking_pending','shipped','problem','sav'
                   )),
  supplier_id      uuid references suppliers(id) on delete set null,
  supplier_cost    numeric(12,2),
  tracking_number  text,
  tracking_carrier text,
  problem_note     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (shop_id, order_id)
);
create index if not exists order_supplier_statuses_status_idx on order_supplier_statuses(shop_id, ops_status);

-- Notes internes (commande, fournisseur ou produit)
create table if not exists internal_notes (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  entity_type text not null check (entity_type in ('order','supplier','product')),
  entity_id   text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists internal_notes_entity_idx on internal_notes(shop_id, entity_type, entity_id);

-- Templates WhatsApp personnalisés (les 7 templates par défaut vivent dans le
-- code ; cette table permet de les surcharger plus tard)
create table if not exists whatsapp_templates (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid references shops(id) on delete cascade,
  template_key text not null,
  name         text not null,
  body         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (shop_id, template_key)
);
