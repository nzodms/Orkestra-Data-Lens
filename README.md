# Orkestra Data Lens

**La couche de vérité data pour Shopify.**

Plus clair que Shopify Analytics. Plus simple que GA4. Plus exploitable qu'un dashboard BI.

Orkestra Data Lens reconstruit chaque parcours visiteur session par session — avec l'heure exacte, la source, le produit, le panier et la vérification Shopify — et **explique les écarts au lieu de les cacher**.

## Le problème résolu

Shopify Analytics peut afficher, sur une même journée :

> 155 visites · 2 ajouts panier · **5 paiements atteints** · 1 paiement finalisé

5 paiements pour 2 ajouts panier : incohérent en lecture cohorte. Data Lens montre que 4 de ces paiements proviennent de **paniers créés avant la période**, de **checkouts repris** (email de relance, retargeting) ou de **sessions non réconciliées** — et transforme un chiffre douteux en donnée vérifiée.

## Démarrage

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000). L'app démarre en **mode démo** avec un jeu de données déterministe (boutique de luminaires, 7 jours d'historique, ~1 000 sessions) qui reproduit exactement le scénario ci-dessus pour « aujourd'hui ».

## Passer en mode live (V1)

1. Copier `.env.example` vers `.env` et renseigner :
   - `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` (app du Partner Dashboard) ;
   - `SHOPIFY_APP_URL` (URL publique, callback `…/api/shopify/callback`) ;
   - `DATABASE_URL` (PostgreSQL — Supabase ou autre) ;
   - `ENCRYPTION_SECRET` (32+ caractères, `openssl rand -hex 32`).
2. `npm run db:migrate` — crée les 13 tables (shops, tokens, products, variants, customers, orders, line items, refunds, sessions, events, anomalies, sync_runs, webhook_deliveries).
3. Aller dans `/onboarding`, saisir le domaine `*.myshopify.com` → OAuth réel (state anti-CSRF signé, HMAC vérifié, token chiffré AES-256-GCM, webhooks enregistrés automatiquement).
4. La synchronisation initiale (30 jours, extensible à 90) importe produits, variantes, commandes, lignes et remboursements — relançable depuis Paramètres.
5. Déployer le Web Pixel (`extensions/orkestra-pixel`, voir son README) : les événements arrivent sur `/api/tracking/event` (validation zod, anti-spam, déduplication) avec le statut `observed` et ne deviennent `confirmed` qu'une fois réconciliés avec une commande Shopify réelle.

L'interface affiche en permanence le mode actif (« Mode démo » / « Données live » / « Synchronisation en cours » / « Pixel non installé ») — jamais de mélange silencieux entre données simulées et réelles. La page `/system` (liée depuis Paramètres) vérifie toute l'installation : env, base, migrations, boutique, token, scopes, sync, tracking, HMAC webhook et moteur de réconciliation.

`npm run db:seed-demo` injecte le jeu de démonstration dans PostgreSQL (boutique `is_demo`) pour tester le pipeline base → réconciliation sans boutique réelle.

## Pages

| Route | Rôle |
|---|---|
| `/onboarding` | Connexion Shopify (OAuth simulé), installation pixel, synchronisation |
| `/dashboard` | KPIs vérifiés, résumé « ce qui s'est passé », tendance 7 jours, insights |
| `/truth-funnel` | **Page centrale** : funnel brut vs funnel cohorte, écarts détectés, comparaison Shopify vs Data Lens, score de fiabilité, actions prioritaires |
| `/sessions` | Timelines visiteurs à la seconde, filtres (source, appareil, produit, abandon, incohérence) |
| `/abandonments` | Abandon produit / panier / checkout / paiement, pertes estimées, causes, recommandations |
| `/products` | Scores par produit (conversion, friction, fiabilité data), catégories automatiques |
| `/sources` | Qualité réelle du trafic par canal, anomalies UTM |
| `/anomalies` | Chaque incohérence avec cause probable et action recommandée |
| `/settings` | État API/pixel/webhooks, préférences, export JSON |

## Architecture

```
app/            Pages (App Router) + routes API
  api/          shopify/auth · shopify/callback · shopify/sync (réels) ·
                webhooks/{orders,refunds,app-uninstalled,RGPD ×3} (HMAC + dédup) ·
                tracking/event (ingestion pixel) · export
components/     layout/ (sidebar, topbar, bottom nav) · ui/ · domain/ · charts/ · onboarding/
lib/            types.ts · funnel.ts (brut vs cohorte) · reconciliation.ts (règles 1-6)
                scoring.ts (fiabilité) · analytics.ts (produits/sources/abandons)
                insights.ts (commentaires basés sur les données) · discrepancies.ts
  server/       env · db (pool pg) · crypto (AES-256-GCM, state signé, masquage email)
                shopify (OAuth, HMAC, GraphQL paginé + REST commandes, webhooks)
                repo (upserts SQL) · sync (30/90 j) · datasource (bascule démo/live)
                webhooks (pipeline HMAC → dédup → traitement)
data/           shop · products · heroSessions (13 sessions écrites à la main)
                dataset.ts (générateur déterministe 7 jours + assemblage)
db/migrations/  schéma SQL (idempotent) — scripts/migrate.mjs · scripts/seed-demo.ts
extensions/     orkestra-pixel (Web Pixel Shopify → /api/tracking/event)
```

En mode live, `lib/server/datasource.ts` reconstruit le même `Dataset` que la démo
depuis PostgreSQL (sessions 7 j, commandes 30 j, enrichissement `cartCreatedAt`
par cart_token, rattachement commande→session par order_id / checkout_token /
cart_token), puis fait tourner **le même moteur de réconciliation** : funnel brut,
funnel cohorte, anomalies, score de fiabilité et insights fonctionnent à
l'identique sur données réelles.

### Logique de réconciliation (lib/reconciliation.ts)

1. `checkout_completed` avec `orderId` correspondant à une commande Shopify → **confirmed**
2. Paiement atteint dont le panier date d'un jour précédent → **out_of_period**
3. Checkout sans ajout panier dans la session → **reconciled** (cartToken connu) ou **incomplete**
4. Commande Shopify sans session pixel → anomalie `order_without_session`
5. Événements identiques < 5 s d'intervalle → doublon **suspect**
6. Référent publicitaire sans UTM → anomalie `missing_utm`

### Brancher la vraie connexion Shopify

Les routes API contiennent des `TODO(prod)` détaillés : OAuth (HMAC, state, échange de token), webhooks (vérification HMAC, déduplication), ingestion Web Pixel et synchronisation paginée. La structure `TrackingEvent` / `ShopifyOrder` / `VisitorSession` est prête pour la persistance (Supabase/Prisma).

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS 4 · lucide-react · graphiques SVG maison. Interface en français, blanc/liquid glass, responsive complet (sidebar desktop, bottom nav mobile).
