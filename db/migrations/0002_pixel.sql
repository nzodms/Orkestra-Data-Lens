-- Activation automatique du Web Pixel : ID du pixel créé via webPixelCreate,
-- statut « installing » et message d'erreur en cas d'échec d'installation.

alter table shops add column if not exists web_pixel_id text;
alter table shops add column if not exists pixel_error text;

alter table shops drop constraint if exists shops_pixel_status_check;
alter table shops add constraint shops_pixel_status_check
  check (pixel_status in ('installed','not_installed','installing','error','demo'));
