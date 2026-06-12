-- V1.5 Daily Operations Cockpit : journal d'actions + alertes opérationnelles.

create table if not exists activity_logs (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references shops(id) on delete cascade,
  entity_type    text not null check (entity_type in ('order','supplier','product','tracking','anomaly','system')),
  entity_id      text not null,
  action         text not null,
  title          text not null,
  description    text,
  previous_value jsonb,
  new_value      jsonb,
  actor_type     text not null default 'user' check (actor_type in ('user','system')),
  actor_id       text,
  created_at     timestamptz not null default now()
);
create index if not exists activity_logs_shop_time_idx on activity_logs(shop_id, created_at desc);
create index if not exists activity_logs_entity_idx on activity_logs(shop_id, entity_type, entity_id);

create table if not exists operational_alerts (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  alert_key          text not null,
  type               text not null,
  category           text not null check (category in ('orderdesk','tracking','funnel','supplier','product')),
  severity           text not null check (severity in ('low','medium','high','critical')),
  title              text not null,
  description        text not null,
  recommended_action text,
  entity_type        text,
  entity_id          text,
  status             text not null default 'active' check (status in ('active','snoozed','resolved')),
  snoozed_until      timestamptz,
  created_at         timestamptz not null default now(),
  resolved_at        timestamptz,
  updated_at         timestamptz not null default now(),
  unique (shop_id, alert_key)
);
create index if not exists operational_alerts_shop_idx on operational_alerts(shop_id, status);
