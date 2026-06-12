import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env, SHOPIFY_API_VERSION } from "./env";

/**
 * Client Shopify côté serveur : OAuth, vérifications HMAC, appels Admin API
 * (GraphQL avec pagination par curseur + REST pour les commandes, qui exposent
 * cart_token / checkout_token nécessaires à la réconciliation).
 */

// ─── Validation du domaine boutique ──────────────────────────────────────────

export function normalizeShopDomain(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleaned) ? cleaned : null;
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildAuthorizeUrl(shopDomain: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.shopifyApiKey,
    scope: env.shopifyScopes,
    redirect_uri: `${env.shopifyAppUrl}/api/shopify/callback`,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params}`;
}

/**
 * Vérifie le HMAC d'un callback OAuth : tous les paramètres sauf `hmac`,
 * triés, encodés en query string, signés HMAC-SHA256 avec le secret d'app.
 */
export function verifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac || !env.shopifyApiSecret) return false;
  const entries = [...searchParams.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", env.shopifyApiSecret).update(entries).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function exchangeCodeForToken(
  shopDomain: string,
  code: string
): Promise<{ accessToken: string; scopes: string }> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.shopifyApiKey,
      client_secret: env.shopifyApiSecret,
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Échange du code OAuth refusé par Shopify (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string; scope?: string };
  if (!data.access_token) throw new Error("Réponse OAuth sans access_token");
  return { accessToken: data.access_token, scopes: data.scope ?? "" };
}

// ─── Webhooks : vérification HMAC sur le raw body ────────────────────────────

export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader || !env.shopifyApiSecret) return false;
  const digest = createHmac("sha256", env.shopifyApiSecret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Appels Admin API ─────────────────────────────────────────────────────────

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {},
  apiVersion: string = SHOPIFY_API_VERSION
): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    // Throttling : une seule relance après une courte pause
    await new Promise((r) => setTimeout(r, 1500));
    return shopifyGraphQL(shopDomain, accessToken, query, variables, apiVersion);
  }
  if (!res.ok) throw new ShopifyApiError(`GraphQL Shopify : HTTP ${res.status}`, res.status);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new ShopifyApiError(`GraphQL Shopify : ${body.errors[0].message}`);
  if (!body.data) throw new ShopifyApiError("GraphQL Shopify : réponse vide");
  return body.data;
}

/**
 * GET REST avec pagination par en-tête Link (page_info).
 * Utilisé pour les commandes : l'API REST expose cart_token et
 * checkout_token, indispensables à la réconciliation des parcours, que
 * GraphQL n'expose pas.
 */
export async function shopifyRestPaginated<T>(
  shopDomain: string,
  accessToken: string,
  path: string,
  params: Record<string, string>,
  extract: (body: unknown) => T[],
  maxPages = 20,
  apiVersion: string = SHOPIFY_API_VERSION
): Promise<T[]> {
  const all: T[] = [];
  let url: string | null = `https://${shopDomain}/admin/api/${apiVersion}/${path}?${new URLSearchParams(params)}`;

  for (let page = 0; page < maxPages && url; page++) {
    const res: Response = await fetch(url, { headers: { "X-Shopify-Access-Token": accessToken } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1500));
      page--;
      continue;
    }
    if (!res.ok) throw new ShopifyApiError(`REST Shopify ${path} : HTTP ${res.status}`, res.status);
    all.push(...extract(await res.json()));
    const link = res.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return all;
}

/** Informations de base de la boutique (nom, devise, fuseau). */
export async function fetchShopInfo(shopDomain: string, accessToken: string) {
  const data = await shopifyGraphQL<{
    shop: { name: string; currencyCode: string; ianaTimezone: string };
  }>(
    shopDomain,
    accessToken,
    `query { shop { name currencyCode ianaTimezone } }`
  );
  return data.shop;
}

// ─── Enregistrement des webhooks à l'installation ────────────────────────────

const WEBHOOK_TOPICS: { topic: string; path: string }[] = [
  { topic: "ORDERS_CREATE", path: "/api/webhooks/orders" },
  { topic: "ORDERS_PAID", path: "/api/webhooks/orders" },
  { topic: "ORDERS_UPDATED", path: "/api/webhooks/orders" },
  { topic: "REFUNDS_CREATE", path: "/api/webhooks/refunds" },
  { topic: "APP_UNINSTALLED", path: "/api/webhooks/app-uninstalled" },
];

export async function registerWebhooks(
  shopDomain: string,
  accessToken: string
): Promise<{ registered: string[]; errors: string[] }> {
  const registered: string[] = [];
  const errors: string[] = [];

  for (const { topic, path } of WEBHOOK_TOPICS) {
    try {
      const data = await shopifyGraphQL<{
        webhookSubscriptionCreate: { userErrors: { message: string }[] };
      }>(
        shopDomain,
        accessToken,
        `mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            userErrors { message }
          }
        }`,
        { topic, webhookSubscription: { callbackUrl: `${env.shopifyAppUrl}${path}`, format: "JSON" } }
      );
      const userErrors = data.webhookSubscriptionCreate.userErrors;
      // « address has already been taken » = déjà enregistré : non bloquant
      if (userErrors.length > 0 && !/taken/i.test(userErrors[0].message)) {
        errors.push(`${topic} : ${userErrors[0].message}`);
      } else {
        registered.push(topic);
      }
    } catch (err) {
      errors.push(`${topic} : ${err instanceof Error ? err.message : "erreur inconnue"}`);
    }
  }
  return { registered, errors };
}

/** Supprime le préfixe gid://shopify/Type/ pour ne garder que l'ID numérique. */
export function shopifyIdToNumeric(gid: string | number | null | undefined): string | null {
  if (gid == null) return null;
  const s = String(gid);
  const match = s.match(/\/(\d+)$/);
  return match ? match[1] : s;
}

// ─── Connexion par token Admin API manuel (Option B) ─────────────────────────

export type ConnectionTest = {
  ok: boolean;
  shopName?: string;
  currency?: string;
  timezone?: string;
  scopes: string[];
  missingScopes: string[];
  error?: string;
};

/** Scopes minimum pour produits / commandes / remboursements. */
export const REQUIRED_SCOPES = ["read_products", "read_orders"];

/**
 * Teste un couple domaine + token Admin API avec de vraies requêtes :
 * GET shop.json (validité du token) + GET oauth/access_scopes.json (scopes).
 * Retourne le résultat réel — jamais de faux « connecté ».
 */
export async function testConnection(
  shopDomain: string,
  accessToken: string,
  apiVersion: string = SHOPIFY_API_VERSION
): Promise<ConnectionTest> {
  try {
    const shopRes = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (shopRes.status === 401 || shopRes.status === 403) {
      return { ok: false, scopes: [], missingScopes: REQUIRED_SCOPES, error: "Token invalide ou révoqué (401/403 Shopify)." };
    }
    if (shopRes.status === 404) {
      return { ok: false, scopes: [], missingScopes: REQUIRED_SCOPES, error: "Domaine introuvable — vérifiez l'adresse *.myshopify.com." };
    }
    if (!shopRes.ok) {
      return { ok: false, scopes: [], missingScopes: REQUIRED_SCOPES, error: `Shopify a répondu HTTP ${shopRes.status}.` };
    }
    const shopBody = (await shopRes.json()) as {
      shop?: { name?: string; currency?: string; iana_timezone?: string };
    };

    let scopes: string[] = [];
    try {
      const scopesRes = await fetch(`https://${shopDomain}/admin/oauth/access_scopes.json`, {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (scopesRes.ok) {
        const body = (await scopesRes.json()) as { access_scopes?: { handle: string }[] };
        scopes = (body.access_scopes ?? []).map((s) => s.handle);
      }
    } catch {
      // liste de scopes indisponible : non bloquant, signalé via missingScopes
    }

    const missingScopes = REQUIRED_SCOPES.filter((s) => scopes.length > 0 && !scopes.includes(s));
    if (missingScopes.length > 0) {
      return {
        ok: false,
        shopName: shopBody.shop?.name,
        currency: shopBody.shop?.currency,
        timezone: shopBody.shop?.iana_timezone,
        scopes,
        missingScopes,
        error: `Scopes insuffisants : ${missingScopes.join(", ")} manquant(s). Ajoutez-les dans l'app Shopify (Admin API access scopes).`,
      };
    }

    return {
      ok: true,
      shopName: shopBody.shop?.name,
      currency: shopBody.shop?.currency,
      timezone: shopBody.shop?.iana_timezone,
      scopes,
      missingScopes: [],
    };
  } catch (err) {
    return {
      ok: false,
      scopes: [],
      missingScopes: REQUIRED_SCOPES,
      error: `Connexion impossible : ${err instanceof Error ? err.message : "erreur réseau"}`,
    };
  }
}
