-- Configuration OAuth « Dev Dashboard » saisie depuis l'interface.
-- Permet de connecter une boutique via Client ID + Client Secret du nouveau
-- Shopify Dev Dashboard, sans variables d'environnement SHOPIFY_API_KEY/SECRET.
-- Singleton (V1 mono-app) : le secret est chiffré AES-256-GCM, jamais en clair.

create table if not exists shopify_oauth_config (
  id text primary key default 'singleton' check (id = 'singleton'),
  client_id text not null,
  encrypted_client_secret text not null,
  scopes text not null,
  app_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
