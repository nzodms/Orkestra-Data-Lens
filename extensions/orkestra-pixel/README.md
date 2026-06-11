# Web Pixel Orkestra Data Lens

Extension Web Pixel Shopify qui capte les événements boutique et les envoie
à `/api/tracking/event`.

## Déploiement

1. Créer (ou réutiliser) une app Shopify CLI :
   `shopify app init` puis copier ce dossier dans `extensions/`.
2. `shopify app deploy`.
3. Activer le pixel pour la boutique via l'Admin GraphQL (avec le token
   obtenu par OAuth — scope `write_pixels`) :

```graphql
mutation {
  webPixelCreate(webPixel: {
    settings: "{\"endpoint\":\"https://VOTRE_APP_URL/api/tracking/event\"}"
  }) {
    webPixel { id }
    userErrors { field message }
  }
}
```

## Événements captés → événements Orkestra

| Shopify (Web Pixels) | Orkestra |
|---|---|
| page_viewed | page_viewed |
| product_viewed | product_viewed |
| collection_viewed | collection_viewed |
| search_submitted | search_submitted |
| product_added_to_cart | product_added_to_cart (+ cart_token) |
| product_removed_from_cart | product_removed_from_cart |
| cart_viewed | cart_viewed |
| checkout_started | checkout_started (+ checkout_token) |
| checkout_contact_info_submitted | checkout_contact_info_submitted |
| checkout_address_info_submitted | checkout_shipping_info_submitted |
| checkout_shipping_info_submitted | checkout_shipping_method_selected |
| payment_info_submitted | payment_step_reached + payment_info_submitted |
| checkout_completed | checkout_completed (+ order_id) |

Le pixel génère un `visitorId` stable et un `sessionId` interne (expiration
30 min d'inactivité), ajoute UTM, referrer, device et page, et envoie le tout
en `keepalive`. Les événements arrivent côté serveur avec le statut
`observed` : ils ne deviennent `confirmed` qu'après réconciliation avec une
commande Shopify réelle (webhook ou sync).
