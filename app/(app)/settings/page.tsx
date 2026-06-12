import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  CircleSlash,
  Database,
  Download,
  Globe,
  Plug,
  Radio,
  Stethoscope,
  Store,
  TriangleAlert,
  Webhook,
  XCircle,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { PixelButton } from "@/components/domain/PixelButton";
import { ConnectShopify } from "@/components/settings/ConnectShopify";
import {
  DataModeSwitch,
  DisconnectButton,
  SendTestEventButton,
  TestSavedConnectionButton,
} from "@/components/settings/ConnectionControls";
import { SyncPanel } from "@/components/settings/SyncPanel";
import { getActiveDataset } from "@/lib/server/datasource";
import { runConnectionDiagnostic, type CheckStatus } from "@/lib/server/diagnostics";
import { isManualConnectAvailable, isOAuthConfigured } from "@/lib/server/env";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CHECK_UI: Record<CheckStatus, { icon: typeof CheckCircle2; color: string; tone: BadgeTone; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-positive", tone: "green", label: "OK" },
  warn: { icon: TriangleAlert, color: "text-warn", tone: "orange", label: "À vérifier" },
  fail: { icon: XCircle, color: "text-critical", tone: "red", label: "Erreur" },
  skip: { icon: CircleSlash, color: "text-ink-soft", tone: "neutral", label: "—" },
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
  const hasConnection = Boolean(status.shopDomain); // connectée, même si bascule démo forcée
  const lastSync = status.lastSync;
  const diagnostic = runConnectionDiagnostic(status);

  // Badge d'état de connexion le plus précis possible — jamais de faux statut
  const connectionBadge = !hasConnection ? (
    <Badge tone="orange">Mode démo — données simulées</Badge>
  ) : !status.tokenPresent ? (
    <Badge tone="red">Token manquant</Badge>
  ) : status.apiError ? (
    <Badge tone="red">Connexion invalide</Badge>
  ) : (status.missingScopes?.length ?? 0) > 0 ? (
    <Badge tone="orange">Scopes insuffisants</Badge>
  ) : status.syncRunning ? (
    <Badge tone="blue">Synchronisation en cours</Badge>
  ) : live ? (
    <Badge tone="green">Mode live — boutique connectée</Badge>
  ) : (
    <Badge tone="orange">Boutique connectée — affichage démo</Badge>
  );

  return (
    <div className="space-y-4">
      {/* Connexion boutique */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Store size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{hasConnection ? (status.shopName ?? shop.name) : shop.name}</div>
            <div className="text-[12px] text-ink-soft">{hasConnection ? status.shopDomain : shop.shopifyDomain}</div>
          </div>
          {connectionBadge}
        </div>

        {hasConnection ? (
          <div className="mt-3 space-y-3">
            <div className="inset-panel grid grid-cols-2 gap-x-4 gap-y-2 p-3 text-[12px] sm:grid-cols-4">
              <Meta label="Méthode" value={status.connectionMethod === "manual_token" ? "Token Admin API" : "OAuth Shopify"} />
              <Meta label="Token" value={status.tokenPresent ? (status.tokenHint ?? "présent (chiffré)") : "manquant"} />
              <Meta label="Version API" value={status.apiVersion ?? "2025-01"} />
              <Meta label="Dernier test API" value={status.lastApiCheckAt ? formatDateTime(status.lastApiCheckAt) : "jamais"} />
            </div>
            {status.apiError && (
              <p className="rounded-xl bg-critical-soft px-3 py-2 text-[12px] font-medium text-critical">
                {status.apiError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <DataModeSwitch mode={status.dataMode ?? "live"} />
              <TestSavedConnectionButton />
              <DisconnectButton shopDomain={status.shopDomain!} />
            </div>
            {!live && (
              <p className="rounded-xl bg-warn-soft/70 px-3 py-2 text-[11.5px] font-medium text-warn">
                La boutique est connectée mais l&apos;interface affiche les données de démonstration. Basculez en
                « Mode live » pour voir vos vraies données Shopify.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <h3 className="mb-2 text-[13px] font-semibold tracking-tight">Connecter ma boutique Shopify</h3>
            <ConnectShopify oauthConfigured={isOAuthConfigured()} manualAvailable={isManualConnectAvailable()} />
            <p className="mt-3 rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
              Tant qu&apos;aucune boutique n&apos;est connectée, l&apos;application affiche un jeu de données de
              démonstration clairement identifié — jamais mélangé avec des données réelles.
            </p>
          </div>
        )}
      </Card>

      {/* Diagnostic Shopify */}
      {hasConnection && (
        <Card>
          <CardTitle sub="État réel de la connexion — chaque ligne indique le problème exact et l'action recommandée.">
            <span className="inline-flex items-center gap-1.5">
              <Stethoscope size={15} className="text-ink-soft" /> Diagnostic Shopify
            </span>
          </CardTitle>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {diagnostic.map((c) => {
              const ui = CHECK_UI[c.status];
              const Icon = ui.icon;
              return (
                <div key={c.name} className="inset-panel flex items-start gap-2.5 px-3 py-2">
                  <Icon size={14} className={`mt-0.5 shrink-0 ${ui.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-semibold">{c.name}</div>
                    <p className="break-words text-[11px] leading-snug text-ink-soft">{c.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Synchronisation */}
      {hasConnection && (
        <Card>
          <CardTitle sub="Sync initiale 30 jours, puis resynchronisations ciblées. Chaque exécution est journalisée.">
            <span className="inline-flex items-center gap-1.5">
              <Activity size={15} className="text-ink-soft" /> Synchronisation Shopify
            </span>
          </CardTitle>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SyncStat label="Produits" value={status.stats?.products ?? 0} />
            <SyncStat label="Commandes" value={status.stats?.orders ?? 0} />
            <SyncStat label="Remboursements" value={status.stats?.refunds ?? 0} />
            <SyncStat label="Événements tracking" value={status.stats?.events ?? 0} />
          </div>
          <div className="mb-3 space-y-1 text-[12px] text-ink-soft">
            <div>
              Dernière synchronisation :{" "}
              <span className="font-medium text-ink">
                {lastSync
                  ? `${formatDateTime(lastSync.started_at)} · ${lastSync.status === "success" ? "réussie" : lastSync.status === "running" ? "en cours" : "échouée"}`
                  : "jamais"}
              </span>
            </div>
            {lastSync?.error_message && (
              <div className="rounded-lg bg-critical-soft px-2.5 py-1.5 text-[11.5px] font-medium text-critical">
                Dernière erreur : {lastSync.error_message}
              </div>
            )}
          </div>
          <SyncPanel />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scopes */}
        <Card>
          <CardTitle
            sub={
              hasConnection
                ? "Permissions réellement accordées par Shopify (relancer « Tester la connexion » pour rafraîchir)."
                : "Permissions demandées lors de la connexion."
            }
          >
            <span className="inline-flex items-center gap-1.5">
              <Plug size={15} className="text-ink-soft" /> API Shopify
            </span>
          </CardTitle>
          {hasConnection && (status.installedScopes?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {status.installedScopes!.map((s) => (
                <Badge key={s} tone="green">{s}</Badge>
              ))}
              {status.missingScopes?.map((s) => (
                <Badge key={s} tone="red">{s} manquant</Badge>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-ink-soft">
              {hasConnection
                ? "Liste des scopes non disponible — relancez « Tester la connexion »."
                : "read_products, read_orders (minimum) · read_customers, read_inventory, write_pixels (OAuth complet)."}
            </p>
          )}
        </Card>

        {/* Pixel */}
        <Card>
          <CardTitle sub="Web Pixel Shopify — activé automatiquement après l'OAuth, ou via le bouton ci-dessous.">
            <span className="inline-flex items-center gap-1.5">
              <Radio size={15} className="text-ink-soft" /> Pixel de tracking
            </span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {hasConnection ? (
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
            {status.webPixelId && <Badge tone="neutral" className="max-w-52 truncate">{status.webPixelId}</Badge>}
          </div>
          <div className="mt-2.5 space-y-1 text-[11.5px] text-ink-soft">
            {status.pixelInstalledAt && <div>Dernière installation : {formatDateTime(status.pixelInstalledAt)}</div>}
            <div>
              Dernier événement reçu :{" "}
              <span className="font-medium text-ink">
                {status.lastEventAt ? formatDateTime(status.lastEventAt) : hasConnection ? "aucun" : "démo"}
              </span>
            </div>
          </div>
          {status.pixelError && (
            <p className="mt-2 rounded-lg bg-critical-soft px-2.5 py-1.5 text-[11.5px] font-medium text-critical">
              {status.pixelError}
              {/extension|web pixel/i.test(status.pixelError) &&
                " — Extension Web Pixel non déployée. Lancez `shopify app deploy`, puis réinstallez le pixel."}
            </p>
          )}
          {hasConnection && (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <PixelButton installed={status.pixelStatus === "installed"} />
              <SendTestEventButton shopDomain={status.shopDomain!} disabled={!status.tokenPresent} />
            </div>
          )}
          {!hasConnection && (
            <p className="mt-2 text-[11.5px] text-ink-soft">En mode démo, les événements affichés sont simulés.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Webhooks */}
        <Card>
          <CardTitle sub="HMAC vérifié, livraisons dédupliquées et journalisées. Enregistrés automatiquement à l'OAuth (à créer manuellement pour une connexion par token).">
            <span className="inline-flex items-center gap-1.5">
              <Webhook size={15} className="text-ink-soft" /> Webhooks
            </span>
          </CardTitle>
          <div className="space-y-1.5">
            {WEBHOOKS.map((w) => (
              <div key={w.topic} className="inset-panel flex items-center justify-between gap-2 px-3 py-1.5">
                <code className="text-[11px] font-medium">{w.topic}</code>
                <div className="flex items-center gap-2">
                  <code className="hidden text-[10.5px] text-ink-soft sm:block">{w.endpoint}</code>
                  {live && status.connectionMethod === "oauth" ? (
                    <Badge tone="green">Actif</Badge>
                  ) : live ? (
                    <Badge tone="orange">Manuel</Badge>
                  ) : (
                    <Badge tone="orange">Simulé</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          {live && (
            <p className="mt-2 text-[11.5px] text-ink-soft">
              {formatNumber(status.stats?.webhooks ?? 0)} livraison{(status.stats?.webhooks ?? 0) > 1 ? "s" : ""} reçue
              {(status.stats?.webhooks ?? 0) > 1 ? "s" : ""}.
            </p>
          )}
        </Card>

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
              value={`${products.filter((p) => p.cost != null).length}/${products.length} produits`}
            />
            <Row label={hasConnection ? "Connectée depuis" : "Démo générée le"} value={formatDateTime(shop.connectedAt)} />
          </dl>
        </Card>
      </div>

      {/* Export + diagnostic système */}
      <Card>
        <CardTitle sub="Exports CSV/JSON (démo et live) et diagnostic complet de l'installation.">
          <span className="inline-flex items-center gap-1.5">
            <Database size={15} className="text-ink-soft" /> Export & diagnostic
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["orders_todo", "Commandes à traiter"],
              ["suppliers", "Fournisseurs"],
              ["messages", "Messages"],
              ["products_resource", "Produits à re-sourcer"],
              ["anomalies", "Anomalies"],
              ["sessions_suspect", "Sessions suspectes"],
              ["activity", "Activité"],
            ] as const
          ).map(([type, label]) => (
            <a
              key={type}
              href={`/api/export?type=${type}&format=csv`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm transition-colors hover:bg-white"
            >
              <Download size={13} /> {label}
            </a>
          ))}
        </div>
        <Link
          href="/system"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
        >
          <Stethoscope size={14} /> Santé des données
        </Link>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/5 pb-2 last:border-0 last:pb-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="truncate text-[12px] font-medium">{value}</div>
    </div>
  );
}

function SyncStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="inset-panel p-3">
      <div className="text-[11px] text-ink-soft">{label}</div>
      <div className="num text-[18px] font-semibold">{formatNumber(value)}</div>
    </div>
  );
}
