# Changelog — Orkestra Data Lens

## [0.3.0] — Partie 1 : activation automatique du pixel + refonte liquid glass

### Pixel Shopify (activation automatique)
- **Activation automatique du Web Pixel après l'OAuth** via `webPixelCreate`
  (`lib/server/pixel.ts`) : vérification d'un pixel existant avant création
  (pas de doublon), mise à jour de l'endpoint si l'URL d'app a changé
  (`webPixelUpdate`), gestion de la course « TAKEN ».
- Nouveau statut transitoire `installing` + colonnes `web_pixel_id` et
  `pixel_error` sur `shops` (migration `0002_pixel.sql`, idempotente).
- Statut réel affiché — jamais de faux « installé » : Pixel installé /
  Installation en cours / Erreur installation pixel (+ message Shopify) /
  Pixel non installé, dans **Settings** et **/system** (nouvelle vérification
  « Web Pixel »).
- Bouton **« Réinstaller le pixel »** dans Settings → `POST /api/shopify/pixel`.

### Refonte UI liquid glass
- **Fond gris bleuté** (`#eef1f6`) avec halos flous fixes en arrière-plan ;
  plus aucun blanc plat.
- **Cards liquid glass** : dégradé semi-transparent, `backdrop-blur` saturé,
  border 1px semi-transparente, ombre multi-couches + reflet intérieur,
  hover avec élévation (`.card`, `.card-hover`, `.glass`, `.glass-strong`,
  `.inset-panel`).
- **Sidebar flottante** en verre (détachée des bords, arrondie), état actif
  élevé sur fond blanc translucide ; header sticky glass renforcé.
- **KPI cards** retravaillées : label uppercase espacé, chiffres 26px,
  icône optionnelle teintée, hover lift.
- **Transitions de page** (template Framer Motion) + micro-interactions
  sobres (icônes nav, heatmap, lignes de table).
- Skeletons shimmer, scrollbars fines, focus rings propres.

### Pages améliorées
- **Dashboard** : section « **Action du jour** » très visible (action n°1
  justifiée par les données + impact estimé) et carte « **Pertes
  récupérables** » cliquable vers le plan de récupération.
- **Vérité du tunnel** : nouvelle visualisation « D'où viennent les N
  paiements atteints ? » — barre segmentée parcours complet / panier créé
  avant la période / panier inconnu.
- **Parcours visiteurs** : la liste plate devient une **table premium**
  (profondeur de parcours visualisée, pastille incohérence) avec **drawer
  de détail** : chemin source → landing → produit → panier → checkout →
  paiement → commande, badges intelligents et timeline horodatée.
- **Abandons** : bandeau « Perte totale estimée » très visible, cartes par
  type d'abandon, **heatmap horaire premium** (8h→23h) avec tooltip et pic.
- **Produits** : table premium cliquable + **fiche produit en drawer**
  (scores conversion/friction/data, funnel produit, CA/marge, action
  recommandée).
- **Sources** : badges visuels « Rentable » / « Polluée · UTM manquants » /
  « Peu qualifiée ».
- **Anomalies** : statut « À traiter » / « Expliquée » sur chaque anomalie,
  en plus de la sévérité, cause probable, impact CA et action recommandée.

---

## [0.2.0] — V1 : OAuth Shopify réel, PostgreSQL, sync, webhooks, mode live

- OAuth Shopify complet (state anti-CSRF signé, HMAC, token AES-256-GCM).
- 13 tables PostgreSQL + migrations idempotentes + seed démo.
- Sync produits (GraphQL paginé) et commandes/remboursements (REST,
  cart_token/checkout_token), fenêtre 30 j extensible 90 j, `sync_runs`.
- Webhooks sécurisés (HMAC raw body, déduplication, journal) : orders,
  refunds, app/uninstalled, RGPD ×3 ; emails clients masqués.
- Ingestion pixel `/api/tracking/event` (zod, anti-spam, déduplication).
- Datasource live : même moteur de réconciliation que la démo, sur la base.
- Indicateurs Mode démo / Données live, page `/system` (diagnostic complet).

## [0.1.0] — V0 : SaaS d'analyse Shopify avec funnel vérifié

- Dataset démo déterministe (155 sessions / 2 ajouts panier / 5 paiements
  atteints dont 4 hors cohorte / 1 commande confirmée).
- Moteur de réconciliation (6 règles), funnel brut vs cohorte, score de
  fiabilité, insights basés sur les données.
- Pages : dashboard, vérité du tunnel, parcours visiteurs, abandons,
  produits, sources, anomalies, paramètres, onboarding.
