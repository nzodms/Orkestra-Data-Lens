import "server-only";
import { createHmac } from "node:crypto";
import { getDataset } from "@/data/dataset";
import { computeRawFunnel, computeVerifiedFunnel, ordersInPeriod, sessionsInPeriod } from "@/lib/funnel";
import { computeReliability } from "@/lib/scoring";
import type { Dataset } from "@/lib/types";
import { pingDb, query } from "./db";
import { configIssues, env, isDatabaseConfigured } from "./env";
import { getAccessToken, getConnectedShop, getLastSyncRun, getShopStats } from "./repo";
import { verifyWebhookHmac } from "./shopify";
import type { AppStatus } from "./datasource";

/** Diagnostics système — partagés entre la page Santé des données et l'export. */

export type CheckStatus = "ok" | "warn" | "fail" | "skip";
export type Check = { name: string; status: CheckStatus; detail: string };

export const EXPECTED_TABLES = [
  "shops",
  "shopify_tokens",
  "products",
  "product_variants",
  "customers",
  "orders",
  "order_line_items",
  "refunds",
  "visitor_sessions",
  "tracking_events",
  "anomalies",
  "sync_runs",
  "webhook_deliveries",
  "suppliers",
  "product_suppliers",
  "supplier_quotes",
  "supplier_messages",
  "order_supplier_statuses",
  "internal_notes",
  "whatsapp_templates",
  "activity_logs",
  "operational_alerts",
];

export async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const issues = configIssues();

  const oauthIssues = issues.filter((i) => i.key.startsWith("SHOPIFY") || i.key === "ENCRYPTION_SECRET");
  checks.push(
    oauthIssues.length === 0
      ? { name: "Configuration OAuth Shopify", status: "ok", detail: `Scopes demandés : ${env.shopifyScopes}` }
      : {
          name: "Configuration OAuth Shopify",
          status: "fail",
          detail: `Variables manquantes : ${oauthIssues.map((i) => i.key).join(", ")}`,
        }
  );

  if (!isDatabaseConfigured()) {
    checks.push({ name: "Base de données", status: "fail", detail: "DATABASE_URL non configuré" });
  } else if (!(await pingDb())) {
    checks.push({ name: "Base de données", status: "fail", detail: "Connexion impossible (vérifier DATABASE_URL / réseau)" });
  } else {
    checks.push({ name: "Base de données", status: "ok", detail: "Connexion PostgreSQL établie" });

    try {
      const rows = await query<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public'`
      );
      const present = new Set(rows.map((r) => r.table_name));
      const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
      checks.push(
        missing.length === 0
          ? { name: "Migrations", status: "ok", detail: `${EXPECTED_TABLES.length} tables présentes` }
          : { name: "Migrations", status: "fail", detail: `Tables manquantes : ${missing.join(", ")} — lancer npm run db:migrate` }
      );
    } catch (err) {
      checks.push({ name: "Migrations", status: "fail", detail: err instanceof Error ? err.message : "Erreur inconnue" });
    }

    try {
      const shop = await getConnectedShop();
      if (!shop) {
        checks.push({ name: "Boutique connectée", status: "warn", detail: "Aucune boutique live — mode démo actif" });
        checks.push({ name: "Token Shopify", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Scopes", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Synchronisation", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Tracking", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Web Pixel", status: "skip", detail: "Pas de boutique connectée" });
      } else {
        checks.push({ name: "Boutique connectée", status: "ok", detail: shop.shopify_domain });

        const token = await getAccessToken(shop.id);
        checks.push(
          token
            ? { name: "Token Shopify", status: "ok", detail: "Présent et déchiffrable (AES-256-GCM)" }
            : { name: "Token Shopify", status: "fail", detail: "Token manquant ou indéchiffrable — reconnecter la boutique" }
        );

        const requested = env.shopifyScopes.split(",").map((s) => s.trim());
        const installed = (shop.installed_scopes ?? "").split(",").map((s) => s.trim());
        const missingScopes = requested.filter((s) => s && !installed.includes(s));
        checks.push(
          missingScopes.length === 0
            ? { name: "Scopes", status: "ok", detail: installed.join(", ") || "—" }
            : { name: "Scopes", status: "warn", detail: `Non accordés : ${missingScopes.join(", ")}` }
        );

        const [lastSync, stats] = await Promise.all([getLastSyncRun(shop.id), getShopStats(shop.id)]);
        if (!lastSync) {
          checks.push({ name: "Synchronisation", status: "warn", detail: "Jamais lancée — utiliser le bouton dans Paramètres" });
        } else if (lastSync.status === "error") {
          checks.push({ name: "Synchronisation", status: "fail", detail: lastSync.error_message ?? "Dernière sync en erreur" });
        } else {
          checks.push({
            name: "Synchronisation",
            status: "ok",
            detail: `${stats.products} produits, ${stats.orders} commandes, ${stats.refunds} remboursements en base`,
          });
        }

        checks.push(
          stats.events > 0
            ? { name: "Tracking", status: "ok", detail: `${stats.events} événements reçus (${stats.sessions} sessions), dernier : ${stats.lastEventAt ?? "—"}` }
            : { name: "Tracking", status: "warn", detail: "Aucun événement reçu sur /api/tracking/event — déployer/activer le pixel" }
        );

        if (shop.pixel_status === "installed") {
          checks.push({
            name: "Web Pixel",
            status: "ok",
            detail: `Pixel installé${shop.web_pixel_id ? ` (${shop.web_pixel_id})` : ""}`,
          });
        } else if (shop.pixel_status === "installing") {
          checks.push({ name: "Web Pixel", status: "warn", detail: "Installation en cours" });
        } else if (shop.pixel_status === "error") {
          checks.push({
            name: "Web Pixel",
            status: "fail",
            detail: `Erreur d'installation : ${shop.pixel_error ?? "inconnue"} — bouton « Réinstaller le pixel »`,
          });
        } else {
          checks.push({
            name: "Web Pixel",
            status: "warn",
            detail: "Pixel non installé — il sera créé automatiquement à la prochaine connexion OAuth",
          });
        }
      }
    } catch (err) {
      checks.push({ name: "Boutique connectée", status: "fail", detail: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }

  if (env.shopifyApiSecret) {
    const sample = JSON.stringify({ test: true, at: Date.now() });
    const digest = createHmac("sha256", env.shopifyApiSecret).update(sample, "utf8").digest("base64");
    checks.push(
      verifyWebhookHmac(sample, digest) && !verifyWebhookHmac(sample, "invalide")
        ? { name: "Vérification HMAC webhook", status: "ok", detail: "Signature valide acceptée, signature invalide rejetée" }
        : { name: "Vérification HMAC webhook", status: "fail", detail: "L'auto-test HMAC a échoué" }
    );
  } else {
    checks.push({ name: "Vérification HMAC webhook", status: "skip", detail: "SHOPIFY_API_SECRET manquant" });
  }

  try {
    const demo = getDataset();
    const today = sessionsInPeriod(demo.sessions, "today");
    const raw = computeRawFunnel(today);
    const verified = computeVerifiedFunnel(today, demo.orders, "today");
    const ok =
      raw.sessions === 155 &&
      raw.addToCarts === 2 &&
      raw.paymentReached === 5 &&
      verified.outOfCohortPayments === 4 &&
      verified.confirmedOrders === 1 &&
      demo.anomalies.length >= 4;
    checks.push(
      ok
        ? {
            name: "Moteur de réconciliation",
            status: "ok",
            detail: "Scénario de référence vérifié : 155 sessions, 2 ajouts panier, 5 paiements dont 4 hors cohorte, 1 commande",
          }
        : {
            name: "Moteur de réconciliation",
            status: "fail",
            detail: `Valeurs inattendues : sessions=${raw.sessions}, atc=${raw.addToCarts}, paiements=${raw.paymentReached}, horsCohorte=${verified.outOfCohortPayments}`,
          }
    );
  } catch (err) {
    checks.push({ name: "Moteur de réconciliation", status: "fail", detail: err instanceof Error ? err.message : "Erreur inconnue" });
  }

  return checks;
}

// ─── Data Health Score ────────────────────────────────────────────────────────

export type DataHealth = {
  globalScore: number;
  components: { label: string; value: number; detail: string }[];
  duplicates: number;
  incompleteEvents: number;
  lastOrderAt: string | null;
};

export async function computeDataHealth(dataset: Dataset, status: AppStatus): Promise<DataHealth> {
  const live = status.mode === "live";
  const reliability = computeReliability(dataset, "7d");

  const pixelScore = !live
    ? 50
    : status.pixelStatus === "installed"
      ? 100
      : status.pixelStatus === "installing"
        ? 60
        : status.pixelStatus === "error"
          ? 0
          : 30;
  const pixelDetail = !live
    ? "Mode démo"
    : status.pixelStatus === "installed"
      ? "Pixel installé"
      : status.pixelStatus === "error"
        ? `Erreur : ${status.pixelError ?? "inconnue"}`
        : status.pixelStatus ?? "non installé";

  const webhookCount = status.stats?.webhooks ?? 0;
  const webhookScore = !live ? 50 : webhookCount > 0 ? 100 : 60;
  const webhookDetail = !live
    ? "Mode démo"
    : webhookCount > 0
      ? `${webhookCount} livraisons reçues et journalisées`
      : "Enregistrés à l'OAuth — aucune livraison reçue pour l'instant";

  const orders7d = ordersInPeriod(dataset.orders, "7d");
  const lastOrderAt = dataset.orders.length > 0
    ? [...dataset.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt
    : null;
  const ordersScore = orders7d.length > 0 ? 100 : dataset.orders.length > 0 ? 70 : 30;

  const lastEventAgeH = status.lastEventAt
    ? (Date.now() - new Date(status.lastEventAt).getTime()) / 3600000
    : null;
  const sessionsScore = !live
    ? 100
    : lastEventAgeH == null
      ? 20
      : lastEventAgeH < 6
        ? 100
        : lastEventAgeH < 24
          ? 70
          : 35;
  const sessionsDetail = !live
    ? "Sessions de démonstration actives"
    : lastEventAgeH == null
      ? "Aucun événement reçu"
      : `Dernier événement il y a ${Math.round(lastEventAgeH)} h`;

  // Doublons & événements incomplets sur 7 jours
  let duplicates = 0;
  let incompleteEvents = 0;
  for (const s of sessionsInPeriod(dataset.sessions, "7d")) {
    for (const e of s.events) {
      if (e.status === "suspect" && e.metadata?.duplicateOf) duplicates++;
      if (e.status === "incomplete") incompleteEvents++;
    }
  }

  const components = [
    { label: "Pixel", value: pixelScore, detail: pixelDetail },
    { label: "Webhooks", value: webhookScore, detail: webhookDetail },
    { label: "Commandes", value: ordersScore, detail: `${orders7d.length} commandes sur 7 j` },
    { label: "Sessions", value: sessionsScore, detail: sessionsDetail },
    {
      label: "Réconciliation",
      value: reliability.reconciliationRate,
      detail: `${reliability.reconciliationRate}% des checkouts avec origine panier identifiée`,
    },
    {
      label: "UTM",
      value: reliability.sourceTrackingQuality,
      detail: `${reliability.sourceTrackingQuality}% des sessions attribuables`,
    },
    {
      label: "Anomalies",
      value: reliability.anomalyRate,
      detail: `${dataset.anomalies.length} anomalies détectées · ${duplicates} doublon${duplicates > 1 ? "s" : ""} · ${incompleteEvents} événement${incompleteEvents > 1 ? "s" : ""} incomplet${incompleteEvents > 1 ? "s" : ""}`,
    },
  ];

  const globalScore = Math.round(components.reduce((a, c) => a + c.value, 0) / components.length);

  return { globalScore, components, duplicates, incompleteEvents, lastOrderAt };
}

// ─── Diagnostic Shopify (carte Paramètres) ───────────────────────────────────

/**
 * Checklist de connexion, calculée depuis l'état stocké (aucun appel
 * Shopify : le bouton « Tester la connexion » rafraîchit api_error /
 * last_api_check_at avec de vraies requêtes).
 */
export function runConnectionDiagnostic(status: AppStatus): Check[] {
  if (status.mode === "demo" && !status.shopDomain) {
    return [
      {
        name: "Connexion Shopify",
        status: "warn",
        detail: "Aucune boutique connectée — connectez votre boutique par OAuth ou token Admin API ci-dessus.",
      },
    ];
  }

  const checks: Check[] = [];
  const scopes = status.installedScopes ?? [];

  checks.push({
    name: "Domaine valide",
    status: /\.myshopify\.com$/.test(status.shopDomain ?? "") ? "ok" : "fail",
    detail: status.shopDomain ?? "—",
  });
  checks.push(
    status.tokenPresent
      ? { name: "Token présent", status: "ok", detail: `Méthode : ${status.connectionMethod === "manual_token" ? "token Admin API" : "OAuth"} · ${status.tokenHint ?? "—"}` }
      : { name: "Token présent", status: "fail", detail: "Token manquant — reconnectez la boutique." }
  );
  checks.push({
    name: "Token sécurisé",
    status: status.tokenPresent ? "ok" : "skip",
    detail: status.tokenPresent
      ? "Chiffré AES-256-GCM en base, jamais renvoyé au client (affichage masqué uniquement)."
      : "Pas de token enregistré.",
  });
  checks.push(
    scopes.length === 0
      ? { name: "Scopes produits", status: "warn", detail: "Liste de scopes non disponible — relancer « Tester la connexion »." }
      : scopes.includes("read_products")
        ? { name: "Scopes produits", status: "ok", detail: "read_products accordé" }
        : { name: "Scopes produits", status: "fail", detail: "read_products manquant — ajoutez-le dans l'app Shopify." }
  );
  const ordersOk = scopes.includes("read_orders") || scopes.includes("read_all_orders");
  checks.push(
    scopes.length === 0
      ? { name: "Scopes commandes", status: "warn", detail: "Liste de scopes non disponible." }
      : ordersOk
        ? { name: "Scopes commandes", status: "ok", detail: scopes.includes("read_all_orders") ? "read_all_orders accordé" : "read_orders accordé (60 derniers jours)" }
        : { name: "Scopes commandes", status: "fail", detail: "read_orders manquant — ajoutez-le dans l'app Shopify." }
  );
  checks.push(
    scopes.length === 0
      ? { name: "Scopes remboursements", status: "warn", detail: "Liste de scopes non disponible." }
      : ordersOk
        ? { name: "Scopes remboursements", status: "ok", detail: "Couverts par read_orders (refunds inclus dans les commandes)." }
        : { name: "Scopes remboursements", status: "fail", detail: "Nécessite read_orders." }
  );
  checks.push(
    status.apiError
      ? { name: "Test API", status: "fail", detail: `${status.apiError} (dernier test : ${status.lastApiCheckAt ?? "—"})` }
      : status.lastApiCheckAt
        ? { name: "Test API", status: "ok", detail: `Dernier test réussi : ${new Date(status.lastApiCheckAt).toLocaleString("fr-FR")}` }
        : { name: "Test API", status: "warn", detail: "Jamais testé — bouton « Tester la connexion »." }
  );
  checks.push(
    !status.lastSync
      ? { name: "Dernière sync", status: "warn", detail: "Jamais synchronisé — lancez « Resynchroniser 30 jours »." }
      : status.lastSync.status === "error"
        ? { name: "Dernière sync", status: "fail", detail: status.lastSync.error_message ?? "Échec de la dernière synchronisation." }
        : {
            name: "Dernière sync",
            status: "ok",
            detail: `${new Date(status.lastSync.started_at).toLocaleString("fr-FR")} · ${status.lastSync.products_synced} produits, ${status.lastSync.orders_synced} commandes, ${status.lastSync.refunds_synced} remboursements`,
          }
  );
  checks.push(
    status.pixelStatus === "installed"
      ? { name: "Pixel installé", status: "ok", detail: status.webPixelId ?? "installé" }
      : status.pixelStatus === "error"
        ? { name: "Pixel installé", status: "fail", detail: status.pixelError ?? "Erreur d'installation" }
        : { name: "Pixel installé", status: "warn", detail: "Non installé — l'attribution comportementale attend le pixel." }
  );
  checks.push(
    status.lastEventAt
      ? { name: "Dernier event tracking", status: "ok", detail: new Date(status.lastEventAt).toLocaleString("fr-FR") }
      : { name: "Dernier event tracking", status: "warn", detail: "Aucun événement reçu — testez avec « Envoyer un événement test »." }
  );

  return checks;
}
