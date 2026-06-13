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

/**
 * URL publique de l'application déployée. Utilisée pour pré-remplir les
 * valeurs à copier dans le Shopify Dev Dashboard (URL d'app + redirection)
 * quand SHOPIFY_APP_URL n'est pas défini côté serveur.
 */
export const DEFAULT_APP_URL =
  env.shopifyAppUrl || "https://orkestra-data-lens-dkeyooi0-enzodms.vercel.app";

/**
 * Scopes recommandés pour une app du nouveau Dev Dashboard (lecture seule des
 * données nécessaires à la réconciliation produits / commandes / clients).
 */
export const DEV_DASHBOARD_SCOPES =
  "read_products,read_orders,read_customers,read_inventory,read_fulfillments";

export function isOAuthConfigured(): boolean {
  return Boolean(env.shopifyApiKey && env.shopifyApiSecret && env.shopifyAppUrl && env.encryptionSecret);
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.databaseUrl);
}

/**
 * La connexion par token Admin API manuel ne nécessite NI app Shopify
 * publiée NI OAuth : seulement la base et le secret de chiffrement.
 */
export function isManualConnectAvailable(): boolean {
  return Boolean(env.databaseUrl && env.encryptionSecret && env.encryptionSecret.length >= 32);
}

/** Variables manquantes pour activer la connexion live (affichées telles quelles). */
export function manualConnectIssues(): string[] {
  const missing: string[] = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.encryptionSecret) missing.push("ENCRYPTION_SECRET");
  else if (env.encryptionSecret.length < 32) missing.push("ENCRYPTION_SECRET (32 caractères minimum)");
  return missing;
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
