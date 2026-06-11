import "server-only";

/**
 * Lecture centralisée des variables d'environnement.
 * Aucune valeur n'est exposée côté client : ce module est server-only.
 */

export const env = {
  shopifyApiKey: process.env.SHOPIFY_API_KEY ?? "",
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET ?? "",
  shopifyScopes:
    process.env.SHOPIFY_SCOPES ??
    "read_products,read_orders,read_customers,read_inventory,read_pixels,write_pixels,read_customer_events",
  shopifyAppUrl: (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  encryptionSecret: process.env.ENCRYPTION_SECRET ?? "",
};

/** Version d'API Shopify Admin utilisée partout. */
export const SHOPIFY_API_VERSION = "2025-01";

export function isOAuthConfigured(): boolean {
  return Boolean(env.shopifyApiKey && env.shopifyApiSecret && env.shopifyAppUrl && env.encryptionSecret);
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}

export type ConfigIssue = { key: string; message: string };

export function configIssues(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  if (!env.shopifyApiKey) issues.push({ key: "SHOPIFY_API_KEY", message: "Clé API Shopify manquante" });
  if (!env.shopifyApiSecret) issues.push({ key: "SHOPIFY_API_SECRET", message: "Secret API Shopify manquant" });
  if (!env.shopifyAppUrl) issues.push({ key: "SHOPIFY_APP_URL", message: "URL publique de l'app manquante" });
  if (!env.databaseUrl) issues.push({ key: "DATABASE_URL", message: "Connexion PostgreSQL/Supabase manquante" });
  if (!env.encryptionSecret) issues.push({ key: "ENCRYPTION_SECRET", message: "Secret de chiffrement manquant" });
  else if (env.encryptionSecret.length < 32)
    issues.push({ key: "ENCRYPTION_SECRET", message: "Secret trop court (32 caractères minimum)" });
  return issues;
}
