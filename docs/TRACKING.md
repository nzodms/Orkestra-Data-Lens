# Tracking — tester l'ingestion d'événements

L'endpoint `POST /api/tracking/event` reçoit les événements du Web Pixel
Shopify, mais accepte aussi des POST manuels pour tester le pipeline avant le
déploiement de l'extension (`extensions/orkestra-pixel`).

Conditions : une boutique **live** doit être connectée (le `shopDomain` doit
correspondre à la boutique enregistrée), sinon l'endpoint répond
`404 Boutique inconnue` — aucun événement n'est accepté en mode démo.

## Exemple de payload test

```bash
curl -X POST https://VOTRE_APP/api/tracking/event \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "ma-boutique.myshopify.com",
    "visitorId": "visitor_test_123",
    "sessionId": "session_test_123",
    "eventName": "product_added_to_cart",
    "timestamp": "2026-06-12T12:00:00.000Z",
    "pageUrl": "https://ma-boutique.com/products/test",
    "utmSource": "google",
    "utmMedium": "cpc",
    "utmCampaign": "test",
    "productId": "1234567890",
    "variantId": "9876543210",
    "price": 99.99,
    "currency": "EUR",
    "device": "desktop"
  }'
```

Réponse : `{ "accepted": true, "duplicate": false, "status": "observed" }`.

## Comportement de l'endpoint

1. **Validation** zod (eventName dans la liste autorisée, types stricts) ;
2. **Boutique** : `shopDomain` doit être une boutique connectée ;
3. **Session** : créée au premier événement (`visitor_sessions`), prolongée
   ensuite (durée, source/UTM conservés du premier hit) ;
4. **Déduplication** : même session + même événement + même produit dans une
   fenêtre de 5 s → `{ "duplicate": true }`, une seule insertion ;
5. **Anti-spam** : 240 événements/min par couple boutique + IP ;
6. **Statut** : tout événement entre en `observed` — il ne devient
   `confirmed` qu'une fois réconcilié avec une commande Shopify réelle
   (webhook ou sync), jamais avant.

Après envoi, l'événement apparaît dans **Parcours visiteurs** (la session
`session_test_123`) et alimente la **Vérité du tunnel**.

Le bouton « Envoyer un événement test » de Paramètres fait exactement ce POST
avec un identifiant `session_manual_test_*`.
