# Changelog — Orkestra Data Lens

## [0.4.0] — Partie 2 : module Order Desk (commandes, fournisseurs, WhatsApp V1)

### Nouveau module Order Desk (sidebar : Commandes · Fournisseurs · Messages)
- **Page Commandes** branchée sur les commandes Shopify déjà synchronisées en
  base (mode live) ou sur les commandes du dataset démo : numéro, date, client
  masqué, pays, produits/variantes/quantités, prix client, statut paiement et
  fulfillment Shopify, **marge estimée** (vs meilleure offre fournisseur),
  fournisseur choisi, tracking et **prochaine action**.
- **11 statuts opérationnels** (À traiter → Recherche fournisseur → Prix à
  comparer → Fournisseur choisi → Message envoyé → Paiement fournisseur en
  attente → Commandé → Tracking en attente → Expédiée / Problème / SAV).
- **Vue Kanban** (8 colonnes) avec cartes commande (produit, prix, marge,
  fournisseur, retard, prochaine action) + **vue Table** filtrable (statut,
  fournisseur, pays, produit, non assigné, recherche).
- **Drawer commande premium** : résumé Shopify, line items, statut + actions
  rapides (paiement en attente, commandé, tracking, expédié, problème),
  comparaison fournisseurs, messages, tracking, notes internes.
- **Section « À faire maintenant »** : commandes sans fournisseur,
  fournisseurs à relancer (2 j+ sans réponse), paiements fournisseur en
  attente, commandes sans tracking, produits à re-sourcer (marge < 40 %),
  problèmes — chaque carte filtre la vue.

### Fournisseurs
- **Page Fournisseurs** : contact WhatsApp/email/site, pays, devise, délai
  moyen, fiabilité (score visuel), commandes, taux de problème, dernier
  contact, tags (rapide, fiable, cher, bon prix, fragile, à éviter).
- **Fiche fournisseur en drawer** : infos, produits associés (offres), 
  commandes liées, prix proposés, messages envoyés, notes internes,
  formulaire d'ajout/édition complet.
- **Association produit → fournisseurs** : prix produit, livraison, délai,
  MOQ, stock, lien produit, fournisseur préféré.

### Comparaison fournisseurs
- Depuis chaque commande : tableau fournisseur / prix produit / livraison /
  total / délai / stock / MOQ / fiabilité / **marge estimée** / **score
  recommandé** (prix 45 %, délai 25 %, fiabilité 30 %).
- Badges Meilleur prix / Plus rapide / **Recommandé** / À éviter (fiabilité
  < 65) + recommandation en clair : « Fournisseur recommandé : X — prix
  total …, délai …, marge estimée …, fiabilité …/100 » + bouton « Choisir ».

### WhatsApp V1 (sans API — architecture prête pour la Cloud API V2)
- **7 templates** (prix/dispo, délai, confirmation commande, tracking,
  relance, problème produit, prix volume) avec variables `{{product_name}}`,
  `{{quantity}}`, `{{country}}`… pré-remplies depuis la commande.
- Ouverture **WhatsApp Web / wa.me** avec message pré-rempli — aucun envoi
  automatique ; statut suivi dans Orkestra : préparé → envoyé manuellement →
  réponse reçue → prix renseigné → fournisseur retenu.
- **Multi-fournisseurs** : sélection de plusieurs fournisseurs, un message
  généré par fournisseur, ouverture WhatsApp individuelle, suivi par statut.
- **Page Messages** : historique filtrable, relance, saisie des prix/délais
  reçus (crée un devis + met à jour l'offre produit), « retenir ce
  fournisseur » (assigne aussi la commande).

### Technique
- Migration `0003_order_desk.sql` (idempotente) : `suppliers`,
  `product_suppliers`, `supplier_quotes`, `supplier_messages`,
  `order_supplier_statuses`, `internal_notes`, `whatsapp_templates` +
  colonne `fulfillment_status` sur `orders` (alimentée par sync/webhooks).
- API `POST /api/orderdesk/action` (10 actions validées zod) — même contrat
  en démo (store mémoire mutable, non persisté) et en live (PostgreSQL).
- Données démo réalistes : 6 fournisseurs (Chine/HK/UE), 19 offres produit,
  devis, messages, statuts répartis sur tout le cycle.
- `/system` vérifie désormais les 20 tables. Aucune page Data Lens modifiée.

---

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
