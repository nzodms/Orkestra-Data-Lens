-- État anti-CSRF OAuth stocké en base (robuste sur Vercel serverless :
-- indépendant des cookies et de l'instance qui traite le callback).
-- On ne stocke qu'un HASH SHA-256 du state, jamais le state en clair.

create table if not exists oauth_states (
  id bigint generated always as identity primary key,
  state_hash text not null unique,
  shop_domain text not null,
  return_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz
);

create index if not exists idx_oauth_states_hash on oauth_states (state_hash);
create index if not exists idx_oauth_states_expires on oauth_states (expires_at);
