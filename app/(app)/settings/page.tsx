import Link from "next/link";
import {
  Activity,
  Database,
  Download,
  Globe,
  Plug,
  Radio,
  Stethoscope,
  Store,
  Webhook,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { PixelButton } from "@/components/domain/PixelButton";
import { SyncButton } from "@/components/domain/SyncButton";
import { getActiveDataset } from "@/lib/server/datasource";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  read_products: "Lecture produits",
  read_orders: "Lecture commandes",
  read_all_orders: "Lecture commandes (historique complet)",
  read_customers: "Lecture clients",
  read_inventory: "Lecture stocks",
  read_checkouts: "Lecture checkouts",
  read_pixels: "Lecture Web Pixels",
  write_pixels: "Installation Web Pixel",
  read_customer_events: "Lecture événements clients",
};

const WEBHOOKS = [
  { topic: "orders/create · orders/paid · orders/updated", endpoint: "/api/webhooks/orders" },
  { topic: "refunds/create", endpoint: "/api/webhooks/refunds" },
  { topic: "app/uninstalled", endpoint: "/api/webhooks/app-uninstalled" },
  { topic: "RGPD (data_request, redact ×2)", endpoint: "/api/webhooks/customers-*" },
];

export default async function SettingsPage() {
  const { dataset, mode, status } = await getActiveDataset();
  const { shop, products } = dataset;
  const live = mode === "live";
  const lastSync = status.lastSync;

  const requestedScopes = Object.keys(SCOPE_LABELS);
  const installedScopes = status.installedScopes ?? [];

  return (
    <div className="space-y-4">
      {/* Boutique */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Store size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{shop.name}</div>
            <div className="text-[12px] text-ink-soft">{shop.shopifyDomain}</div>
          </div>
          {live ? <Badge tone="green">Boutique connectée</Badge> : <Badge tone="orange">Mode démo</Badge>}
          {live && status.syncRunning && <Badge tone="blue">Synchronisation en cours</Badge>}
          {!live && (
            <Link
              href="/onboarding"
              className="rounded-xl bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
            >
              Connecter ma boutique
            </Link>
          )}
        </div>
        {!live && (
          <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
            Toutes les données affichées sont simulées
            {status.reason === "oauth_not_configured" &&
              " — les variables d'environnement Shopify (SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL, ENCRYPTION_SECRET) ne sont pas configurées"}
            {status.reason === "database_not_configured" && " — DATABASE_URL n'est pas configuré"}
            {status.reason === "no_shop_connected" && " — aucune boutique n'est encore connectée via OAuth"}
            {status.reason === "database_error" && " — la base de données est injoignable (voir les logs serveur)"}
            . Dès qu'une boutique est connectée, les pages basculent automatiquement sur les données live.
          </p>
        )}
      </Card>

      {/* Synchronisation (live) */}
      {live && (
        <Card>
          <CardTitle sub="Synchronisation initiale sur 30 jours, extensible à 90 jours.">
            <span className="inline-flex items-center gap-1.5">
              <Activity size={15} className="text-ink-soft" /> Synchronisation Shopify
            </span>
          </CardTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SyncStat label="Produits" value={status.stats?.products ?? 0} />
            <SyncStat label="Commandes" value={status.stats?.orders ?? 0} />
            <SyncStat label="Remboursements" value={status.stats?.refunds ?? 0} />
            <SyncStat label="Événements tracking" value={status.stats?.events ?? 0} />
          </div>
          <div className="mt-3 space-y-1.5 text-[12px] text-ink-soft">
            <div>
              Dernière synchronisation :{" "}
              <span className="font-medium text-ink">
                {lastSync ? `${formatDateTime(lastSync.started_at)} · ${lastSync.status === "success" ? "réussie" : lastSync.status === "running" ? "en cours" : "échouée"}` : "jamais"}
              </span>
            </div>
            {lastSync?.error_message && (
              <div className="rounded-lg bg-critical-soft px-2.5 py-1.5 text-[11.5px] font-medium text-critical">
                Dernière erreur : {lastSync.error_message}
              </div>
            )}
          </div>
          <div className="mt-3">
            <SyncButton rangeDays={30} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* État API / scopes */}
        <Card>
          <CardTitle
            sub={
              live
                ? "Permissions accordées lors de la connexion OAuth."
                : "Permissions qui seront demandées lors de la connexion OAuth."
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Plug size={15} className="text-ink-soft" /> API Shopify
            </span>
          </CardTitle>
          <div className="space-y-1.5">
            {requestedScopes.map((scope) => {
              const granted = installedScopes.includes(scope);
              const tone: BadgeTone = live ? (granted ? "green" : "neutral") : "orange";
              const label = live ? (granted ? "Accordé" : "Non accordé") : "Simulé";
              return (
                <div key={scope} className="flex items-center justify-between rounded-lg bg-gray-50/80 px-3 py-1.5">
                  <div>
                    <div className="text-[12px] font-medium">{SCOPE_LABELS[scope]}</div>
                    <code className="text-[10.5px] text-ink-soft">{scope}</code>
                  </div>
                  <Badge tone={tone}>{label}</Badge>
                </div>
              );
            })}
          </div>
          {live && (status.missingScopes?.length ?? 0) > 0 && (
            <p className="mt-2 rounded-lg bg-warn-soft px-2.5 py-1.5 text-[11.5px] font-medium text-warn">
              Scopes incomplets : {status.missingScopes!.join(", ")}. Reconnectez la boutique pour les accorder.
            </p>
          )}
        </Card>

        <div className="space-y-4">
          {/* Pixel */}
          <Card>
            <CardTitle sub="Web Pixel Shopify activé automatiquement après la connexion OAuth (webPixelCreate).">
              <span className="inline-flex items-center gap-1.5">
                <Radio size={15} className="text-ink-soft" /> Pixel de tracking
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {live ? (
                status.pixelStatus === "installed" ? (
                  <Badge tone="green">Pixel installé</Badge>
                ) : status.pixelStatus === "installing" ? (
                  <Badge tone="blue">Installation en cours</Badge>
                ) : status.pixelStatus === "error" ? (
                  <Badge tone="red">Erreur installation pixel</Badge>
                ) : (
                  <Badge tone="orange">Pixel non installé</Badge>
                )
              ) : (
                <Badge tone="orange">Pixel en mode démo</Badge>
              )}
              <Badge tone="blue">Endpoint : /api/tracking/event</Badge>
              {live && status.webPixelId && (
                <Badge tone="neutral" className="max-w-56 truncate">
                  {status.webPixelId}
                </Badge>
              )}
            </div>
            {live && status.pixelError && (
              <p className="mt-2 rounded-lg bg-critical-soft px-2.5 py-1.5 text-[11.5px] font-medium text-critical">
                {status.pixelError}
                {/extension/i.test(status.pixelError) &&
                  " — déployez l'extension web pixel (extensions/orkestra-pixel) avec `shopify app deploy`, puis réinstallez."}
              </p>
            )}
            <div className="mt-3 text-[12px] text-ink-soft">
              {live ? (
                status.lastEventAt ? (
                  <span className="inline-flex items-center gap-2">
                    <Activity size={13} className="text-positive" />
                    Dernier événement reçu : {formatDateTime(status.lastEventAt)}
                  </span>
                ) : (
                  "Aucun événement reçu pour l'instant : le statut passera à « installé » dès le premier événement si l'activation automatique a échoué."
                )
              ) : (
                "En mode démo, les événements affichés sont simulés."
              )}
            </div>
            {live && (
              <div className="mt-3">
                <PixelButton installed={status.pixelStatus === "installed"} />
              </div>
            )}
          </Card>

          {/* Webhooks */}
          <Card>
            <CardTitle sub="Reçoivent commandes et remboursements en temps réel — HMAC vérifié, livraisons dédupliquées et journalisées.">
              <span className="inline-flex items-center gap-1.5">
                <Webhook size={15} className="text-ink-soft" /> Webhooks
              </span>
            </CardTitle>
            <div className="space-y-1.5">
              {WEBHOOKS.map((w) => (
                <div key={w.topic} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50/80 px-3 py-1.5">
                  <code className="text-[11px] font-medium">{w.topic}</code>
                  <div className="flex items-center gap-2">
                    <code className="hidden text-[10.5px] text-ink-soft sm:block">{w.endpoint}</code>
                    {live ? <Badge tone="green">Actif</Badge> : <Badge tone="orange">Simulé</Badge>}
                  </div>
                </div>
              ))}
            </div>
            {live && (
              <p className="mt-2 text-[11.5px] text-ink-soft">
                {formatNumber(status.stats?.webhooks ?? 0)} livraison{(status.stats?.webhooks ?? 0) > 1 ? "s" : ""} reçue
                {(status.stats?.webhooks ?? 0) > 1 ? "s" : ""} et journalisée{(status.stats?.webhooks ?? 0) > 1 ? "s" : ""}.
              </p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Préférences */}
        <Card>
          <CardTitle>
            <span className="inline-flex items-center gap-1.5">
              <Globe size={15} className="text-ink-soft" /> Préférences boutique
            </span>
          </CardTitle>
          <dl className="space-y-2 text-[12.5px]">
            <Row label="Fuseau horaire" value={shop.timezone} />
            <Row label="Devise" value={shop.currency} />
            <Row
              label="Coûts produit renseignés"
              value={`${products.filter((p) => p.cost != null).length}/${products.length} produits — marge estimée ${
                products.some((p) => p.cost != null) ? "activée" : "désactivée"
              }`}
            />
            <Row label={live ? "Connectée depuis" : "Démo générée le"} value={formatDateTime(shop.connectedAt)} />
          </dl>
        </Card>

        {/* Export + diagnostic */}
        <Card>
          <CardTitle sub="Exportez les données vérifiées, ou lancez le diagnostic complet de l'installation.">
            <span className="inline-flex items-center gap-1.5">
              <Database size={15} className="text-ink-soft" /> Export & diagnostic
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {(["sessions", "orders", "anomalies"] as const).map((type) => (
              <a
                key={type}
                href={`/api/export?type=${type}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-gray-50"
              >
                <Download size={14} />
                {type === "sessions" ? "Sessions" : type === "orders" ? "Commandes" : "Anomalies"} (JSON)
              </a>
            ))}
          </div>
          <Link
            href="/system"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
          >
            <Stethoscope size={14} /> Diagnostic système
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-gray-50/60 p-3">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="num text-[18px] font-semibold">{formatNumber(value)}</div>
    </div>
  );
}
