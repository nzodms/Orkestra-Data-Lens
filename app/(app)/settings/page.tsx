import Link from "next/link";
import {
  Activity,
  Database,
  Download,
  Globe,
  Plug,
  Radio,
  Store,
  Webhook,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { getDataset } from "@/data/dataset";
import { formatDateTime } from "@/lib/utils";

const SCOPES = [
  { scope: "read_products", label: "Lecture produits" },
  { scope: "read_orders", label: "Lecture commandes" },
  { scope: "read_customers", label: "Lecture clients" },
  { scope: "read_payment_transactions", label: "Lecture transactions" },
  { scope: "read_refunds", label: "Lecture remboursements" },
  { scope: "read_inventory", label: "Lecture stocks" },
  { scope: "read_checkouts", label: "Lecture checkouts (selon plan)" },
  { scope: "write_pixels", label: "Installation Web Pixel" },
];

const WEBHOOKS = [
  { topic: "orders/create", endpoint: "/api/webhooks/orders" },
  { topic: "orders/paid", endpoint: "/api/webhooks/orders" },
  { topic: "refunds/create", endpoint: "/api/webhooks/refunds" },
];

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const { shop, products } = getDataset();
  const lastSync = new Date(Date.now() - 14 * 60 * 1000).toISOString();

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
          <Badge tone="orange">Mode démo</Badge>
          <Link
            href="/onboarding"
            className="rounded-xl bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Connecter ma boutique
          </Link>
        </div>
        <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
          Toutes les données affichées sont simulées. Une fois la boutique connectée via OAuth Shopify
          (<code className="rounded bg-gray-100 px-1 text-[11px]">/api/shopify/auth</code>), les données réelles
          remplaceront le jeu de démonstration et le statut passera à « Boutique connectée ».
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* État API */}
        <Card>
          <CardTitle sub="Permissions demandées lors de la connexion OAuth.">
            <span className="inline-flex items-center gap-1.5">
              <Plug size={15} className="text-ink-soft" /> API Shopify
            </span>
          </CardTitle>
          <div className="space-y-1.5">
            {SCOPES.map((s) => (
              <div key={s.scope} className="flex items-center justify-between rounded-lg bg-gray-50/80 px-3 py-1.5">
                <div>
                  <div className="text-[12px] font-medium">{s.label}</div>
                  <code className="text-[10.5px] text-ink-soft">{s.scope}</code>
                </div>
                <Badge tone="orange">Simulé</Badge>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Pixel */}
          <Card>
            <CardTitle sub="Web Pixel Shopify chargé sur la boutique pour capter chaque événement horodaté.">
              <span className="inline-flex items-center gap-1.5">
                <Radio size={15} className="text-ink-soft" /> Pixel de tracking
              </span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="orange">Pixel en mode démo</Badge>
              <Badge tone="blue">Endpoint : /api/tracking/event</Badge>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-soft">
              <Activity size={13} className="text-positive" />
              Synchronisation active · Dernière synchronisation : {formatDateTime(lastSync)}
            </div>
          </Card>

          {/* Webhooks */}
          <Card>
            <CardTitle sub="Reçoivent les commandes et remboursements en temps réel pour la réconciliation.">
              <span className="inline-flex items-center gap-1.5">
                <Webhook size={15} className="text-ink-soft" /> Webhooks
              </span>
            </CardTitle>
            <div className="space-y-1.5">
              {WEBHOOKS.map((w) => (
                <div key={w.topic} className="flex items-center justify-between rounded-lg bg-gray-50/80 px-3 py-1.5">
                  <code className="text-[11.5px] font-medium">{w.topic}</code>
                  <div className="flex items-center gap-2">
                    <code className="hidden text-[10.5px] text-ink-soft sm:block">{w.endpoint}</code>
                    <Badge tone="orange">Simulé</Badge>
                  </div>
                </div>
              ))}
            </div>
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
            <Row label="Devise" value={`${shop.currency} (€)`} />
            <Row
              label="Coûts produit renseignés"
              value={`${products.filter((p) => p.cost != null).length}/${products.length} produits — marge estimée activée`}
            />
            <Row label="Connectée depuis" value={formatDateTime(shop.connectedAt)} />
          </dl>
        </Card>

        {/* Export */}
        <Card>
          <CardTitle sub="Exportez les données vérifiées pour vos propres analyses.">
            <span className="inline-flex items-center gap-1.5">
              <Database size={15} className="text-ink-soft" /> Export des données
            </span>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/export?type=sessions"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download size={14} /> Sessions (JSON)
            </a>
            <a
              href="/api/export?type=orders"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download size={14} /> Commandes (JSON)
            </a>
            <a
              href="/api/export?type=anomalies"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-gray-50"
            >
              <Download size={14} /> Anomalies (JSON)
            </a>
          </div>
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
