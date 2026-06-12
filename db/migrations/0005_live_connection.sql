-- Connexion live : token Admin API manuel, version d'API, bascule démo/live,
-- diagnostic connexion + champs financiers commandes et tags produits.

alter table shops add column if not exists connection_method text not null default 'oauth'
  check (connection_method in ('oauth','manual_token'));
alter table shops add column if not exists api_version text;
alter table shops add column if not exists token_hint text;
alter table shops add column if not exists api_error text;
alter table shops add column if not exists last_api_check_at timestamptz;
alter table shops add column if not exists data_mode text not null default 'live'
  check (data_mode in ('live','demo'));
alter table shops add column if not exists pixel_installed_at timestamptz;

alter table products add column if not exists tags text;

alter table orders add column if not exists subtotal_price numeric(12,2);
alter table orders add column if not exists total_discounts numeric(12,2);
alter table orders add column if not exists total_tax numeric(12,2);
alter table orders add column if not exists total_shipping numeric(12,2);
