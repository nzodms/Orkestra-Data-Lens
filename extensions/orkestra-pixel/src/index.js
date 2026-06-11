// Web Pixel Orkestra Data Lens
// Tourne dans la sandbox Web Pixels de Shopify (runtime_context: strict).
// Capte les événements standards, les normalise au format TrackingEvent
// d'Orkestra et les envoie à /api/tracking/event.

import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, init, settings }) => {
  const ENDPOINT = settings.endpoint;
  const shopDomain = init.data.shop ? init.data.shop.myshopifyDomain : null;

  // ─── Identité visiteur / session ────────────────────────────────────────
  // clientId Web Pixels = visiteur stable ; la session est régénérée après
  // 30 minutes d'inactivité.

  const SESSION_TTL_MS = 30 * 60 * 1000;

  async function getIds() {
    const visitorId = init.data.customer
      ? "cus_" + init.data.customer.id
      : "vis_" + (await browser.cookie.get("_shopify_y").catch(() => "")) || "vis_anonymous";

    const now = Date.now();
    let session = null;
    try {
      session = JSON.parse((await browser.localStorage.getItem("orkestra_session")) || "null");
    } catch (e) {
      session = null;
    }
    if (!session || now - session.lastSeen > SESSION_TTL_MS) {
      session = { id: "ses_" + now.toString(36) + Math.random().toString(36).slice(2, 8), startedAt: now };
    }
    session.lastSeen = now;
    await browser.localStorage.setItem("orkestra_session", JSON.stringify(session)).catch(() => {});
    return { visitorId: String(visitorId), sessionId: session.id, isNewSession: session.startedAt === now };
  }

  function utm(context) {
    try {
      const url = new URL(context.document.location.href);
      return {
        utmSource: url.searchParams.get("utm_source") || undefined,
        utmMedium: url.searchParams.get("utm_medium") || undefined,
        utmCampaign: url.searchParams.get("utm_campaign") || undefined,
        utmContent: url.searchParams.get("utm_content") || undefined,
        utmTerm: url.searchParams.get("utm_term") || undefined,
      };
    } catch (e) {
      return {};
    }
  }

  function device(context) {
    const ua = (context.navigator && context.navigator.userAgent) || "";
    if (/iPad|Tablet/i.test(ua)) return "tablet";
    if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
    return "desktop";
  }

  async function send(eventName, context, fields) {
    if (!ENDPOINT || !shopDomain) return;
    const ids = await getIds();
    const payload = Object.assign(
      {
        shopDomain: shopDomain,
        visitorId: ids.visitorId,
        sessionId: ids.sessionId,
        eventName: eventName,
        timestamp: new Date().toISOString(),
        pageUrl: context && context.document ? context.document.location.pathname : undefined,
        referrer: context && context.document ? context.document.referrer || undefined : undefined,
        device: context ? device(context) : undefined,
      },
      context ? utm(context) : {},
      fields || {}
    );
    // keepalive : l'événement part même si la page se ferme
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});

    if (ids.isNewSession && eventName !== "session_started") {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, payload, { eventName: "session_started" })),
        keepalive: true,
      }).catch(() => {});
    }
  }

  function lineFields(variant, quantity) {
    if (!variant) return {};
    return {
      productId: variant.product ? String(variant.product.id) : undefined,
      variantId: String(variant.id),
      sku: variant.sku || undefined,
      productTitle: variant.product ? variant.product.title : undefined,
      variantTitle: variant.title || undefined,
      quantity: quantity,
      price: variant.price ? Number(variant.price.amount) : undefined,
      currency: variant.price ? variant.price.currencyCode : undefined,
    };
  }

  function checkoutFields(checkout) {
    if (!checkout) return {};
    return {
      checkoutToken: checkout.token || undefined,
      cartToken: undefined, // non exposé sur l'objet checkout
      price: checkout.totalPrice ? Number(checkout.totalPrice.amount) : undefined,
      currency: checkout.currencyCode || undefined,
      orderId: checkout.order ? String(checkout.order.id) : undefined,
    };
  }

  // ─── Abonnements aux événements standards Shopify ───────────────────────

  analytics.subscribe("page_viewed", (event) => send("page_viewed", event.context, {}));

  analytics.subscribe("product_viewed", (event) => {
    const v = event.data.productVariant;
    send("product_viewed", event.context, lineFields(v, undefined));
  });

  analytics.subscribe("collection_viewed", (event) => {
    const c = event.data.collection;
    send("collection_viewed", event.context, { metadata: { collection: c ? c.title : undefined } });
  });

  analytics.subscribe("search_submitted", (event) => {
    const q = event.data.searchResult ? event.data.searchResult.query : undefined;
    send("search_submitted", event.context, { metadata: { query: q } });
  });

  analytics.subscribe("product_added_to_cart", (event) => {
    const line = event.data.cartLine;
    send(
      "product_added_to_cart",
      event.context,
      Object.assign(lineFields(line ? line.merchandise : null, line ? line.quantity : undefined), {
        cartToken: line && line.cart ? line.cart.id : undefined,
      })
    );
  });

  analytics.subscribe("product_removed_from_cart", (event) => {
    const line = event.data.cartLine;
    send("product_removed_from_cart", event.context, lineFields(line ? line.merchandise : null, line ? line.quantity : undefined));
  });

  analytics.subscribe("cart_viewed", (event) => {
    const cart = event.data.cart;
    send("cart_viewed", event.context, {
      cartToken: cart ? cart.id : undefined,
      price: cart && cart.cost && cart.cost.totalAmount ? Number(cart.cost.totalAmount.amount) : undefined,
      currency: cart && cart.cost && cart.cost.totalAmount ? cart.cost.totalAmount.currencyCode : undefined,
      metadata: { totalQuantity: cart ? cart.totalQuantity : undefined },
    });
  });

  analytics.subscribe("checkout_started", (event) =>
    send("checkout_started", event.context, checkoutFields(event.data.checkout))
  );
  analytics.subscribe("checkout_contact_info_submitted", (event) =>
    send("checkout_contact_info_submitted", event.context, checkoutFields(event.data.checkout))
  );
  analytics.subscribe("checkout_address_info_submitted", (event) =>
    send("checkout_shipping_info_submitted", event.context, checkoutFields(event.data.checkout))
  );
  analytics.subscribe("checkout_shipping_info_submitted", (event) =>
    send("checkout_shipping_method_selected", event.context, checkoutFields(event.data.checkout))
  );
  analytics.subscribe("payment_info_submitted", (event) => {
    // Atteindre la saisie de paiement = « paiement atteint » puis « soumis »
    send("payment_step_reached", event.context, checkoutFields(event.data.checkout));
    send("payment_info_submitted", event.context, checkoutFields(event.data.checkout));
  });
  analytics.subscribe("checkout_completed", (event) =>
    send("checkout_completed", event.context, checkoutFields(event.data.checkout))
  );
});
