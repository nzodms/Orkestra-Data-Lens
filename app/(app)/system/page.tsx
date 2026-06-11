import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleSlash, Stethoscope, TriangleAlert, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getDataset } from "@/data/dataset";
import { computeRawFunnel, computeVerifiedFunnel, sessionsInPeriod } from "@/lib/funnel";
import { pingDb, query } from "@/lib/server/db";
import { configIssues, env, isDatabaseConfigured, isOAuthConfigured } from "@/lib/server/env";
import { getAccessToken, getConnectedShop, getLastSyncRun, getShopStats } from "@/lib/server/repo";
import { verifyWebhookHmac } from "@/lib/server/shopify";
import { createHmac } from "node:crypto";

export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "warn" | "fail" | "skip";
type Check = { name: string; status: CheckStatus; detail: string };

const EXPECTED_TABLES = [
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
];

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];
  const issues = configIssues();

  // 1. Configuration OAuth
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

  // 2-3. Base de données
  if (!isDatabaseConfigured()) {
    checks.push({ name: "Base de données", status: "fail", detail: "DATABASE_URL non configuré" });
  } else if (!(await pingDb())) {
    checks.push({ name: "Base de données", status: "fail", detail: "Connexion impossible (vérifier DATABASE_URL / réseau)" });
  } else {
    checks.push({ name: "Base de données", status: "ok", detail: "Connexion PostgreSQL établie" });

    // 4. Migrations
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

    // 5-8. Boutique, token, scopes, sync
    try {
      const shop = await getConnectedShop();
      if (!shop) {
        checks.push({ name: "Boutique connectée", status: "warn", detail: "Aucune boutique live — mode démo actif" });
        checks.push({ name: "Token Shopify", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Scopes", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Synchronisation", status: "skip", detail: "Pas de boutique connectée" });
        checks.push({ name: "Tracking", status: "skip", detail: "Pas de boutique connectée" });
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
      }
    } catch (err) {
      checks.push({ name: "Boutique connectée", status: "fail", detail: err instanceof Error ? err.message : "Erreur inconnue" });
    }
  }

  // 9. Auto-test HMAC webhook
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

  // 10. Auto-test du moteur de réconciliation (sur le jeu de démo)
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

const STATUS_UI: Record<CheckStatus, { icon: typeof CheckCircle2; tone: "green" | "orange" | "red" | "neutral"; label: string; color: string }> = {
  ok: { icon: CheckCircle2, tone: "green", label: "OK", color: "text-positive" },
  warn: { icon: TriangleAlert, tone: "orange", label: "À vérifier", color: "text-warn" },
  fail: { icon: XCircle, tone: "red", label: "Échec", color: "text-critical" },
  skip: { icon: CircleSlash, tone: "neutral", label: "Ignoré", color: "text-ink-soft" },
};

export default async function SystemPage() {
  const checks = await runChecks();
  const failures = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const oauthReady = isOAuthConfigured();

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Stethoscope size={18} />
        </span>
        <div className="flex-1">
          <h2 className="text-[14.5px] font-semibold tracking-tight">Diagnostic système</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            Vérification complète de l&apos;installation : OAuth, base de données, boutique, token, scopes,
            synchronisation, tracking, webhooks et moteur de réconciliation.
          </p>
        </div>
        <Badge tone={failures > 0 ? "red" : warnings > 0 ? "orange" : "green"}>
          {failures > 0 ? `${failures} échec${failures > 1 ? "s" : ""}` : warnings > 0 ? `${warnings} avertissement${warnings > 1 ? "s" : ""}` : "Tout est opérationnel"}
        </Badge>
      </Card>

      <Card>
        <CardTitle>Résultats ({checks.length} vérifications)</CardTitle>
        <div className="space-y-2">
          {checks.map((check) => {
            const ui = STATUS_UI[check.status];
            const Icon = ui.icon;
            return (
              <div key={check.name} className="flex items-start gap-3 rounded-xl border border-gray-200/70 bg-gray-50/60 px-3.5 py-2.5">
                <Icon size={16} className={`mt-0.5 shrink-0 ${ui.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold">{check.name}</div>
                  <p className="break-words text-[11.5px] leading-relaxed text-ink-soft">{check.detail}</p>
                </div>
                <Badge tone={ui.tone}>{ui.label}</Badge>
              </div>
            );
          })}
        </div>
        {!oauthReady && (
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
            Pour passer en mode live : copier <code className="rounded bg-gray-100 px-1 text-[11px]">.env.example</code> vers{" "}
            <code className="rounded bg-gray-100 px-1 text-[11px]">.env</code>, renseigner les variables, lancer{" "}
            <code className="rounded bg-gray-100 px-1 text-[11px]">npm run db:migrate</code>, puis connecter la boutique
            depuis l&apos;onboarding.
          </p>
        )}
      </Card>

      <Link href="/settings" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-strong">
        <ArrowLeft size={14} /> Retour aux paramètres
      </Link>
    </div>
  );
}
