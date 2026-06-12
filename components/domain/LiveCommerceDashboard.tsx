import Link from "next/link";
import { ArrowRight, PackageX, Radio, ShoppingBag } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import type { CommerceSummary } from "@/lib/server/commerce";
import { formatDateTime, formatEUR, formatNumber } from "@/lib/utils";

/**
 * Dashboard live « commerce » : 100 % données Shopify réelles
 * (commandes, remboursements, produits vendus). Affiché tant que le pixel
 * comportemental n'a pas envoyé d'événements — aucune vue produit, ajout
 * panier ou étape checkout n'est inventée.
 */
export function LiveCommerceDashboard({
  summary,
  pixelInstalled,
}: {
  summary: CommerceSummary;
  pixelInstalled: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Bannière tracking en attente — honnête */}
      <Card className="flex items-start gap-3.5 border-brand/15 bg-brand-soft/30">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Radio size={18} />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[14px] font-semibold tracking-tight">Données Shopify live connectées</h2>
            <Badge tone="green">CA et commandes réels</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-ink-soft">
            Le tracking comportemental n&apos;est pas encore actif : les vues produit, ajouts panier et étapes
            checkout restent indisponibles tant que le pixel n&apos;a pas envoyé d&apos;événements.{" "}
            {pixelInstalled
              ? "Le pixel est installé — les premières sessions apparaîtront dès les prochaines visites."
              : "Installez le pixel (Paramètres) ou envoyez un événement test pour vérifier le pipeline."}
          </p>
          <Link
            href="/settings"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-brand-strong"
          >
            Ouvrir les paramètres tracking <ArrowRight size={13} />
          </Link>
        </div>
      </Card>

      {/* KPIs commerce réels (30 jours) */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <Stat label="CA confirmé (30 j)" value={formatEUR(summary.revenue30d)} tone="positive" sub={`${formatEUR(summary.revenue7d)} sur 7 j`} />
        <Stat label="Commandes (30 j)" value={summary.orders30d} sub={`${summary.orders7d} sur 7 j`} />
        <Stat label="Panier moyen" value={summary.aov > 0 ? formatEUR(summary.aov) : "—"} />
        <Stat
          label="Remboursements"
          value={formatEUR(summary.refundsTotal)}
          tone={summary.refundsTotal > 0 ? "warn" : "default"}
          sub={`${summary.refundsCount} remboursement${summary.refundsCount > 1 ? "s" : ""}`}
        />
        <Stat label="Produits vendus" value={formatNumber(summary.itemsSold)} sub="Unités sur 30 j" />
        <Stat
          label="Non expédiées"
          value={summary.unfulfilled}
          tone={summary.unfulfilled > 0 ? "warn" : "positive"}
          icon={PackageX}
          sub="Fulfillment en attente"
        />
        <Stat label="Vues produit" value="—" sub="En attente du pixel" />
        <Stat label="Ajouts panier" value="—" sub="En attente du pixel" />
      </div>

      {/* CA quotidien + top produits */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Source : commandes Shopify synchronisées.">CA quotidien — 30 derniers jours</CardTitle>
          <Sparkline values={summary.dailyRevenue} height={64} color="var(--color-positive)" />
          <div className="mt-2 flex justify-between text-[10.5px] text-ink-soft">
            <span>J-30</span>
            <span>Aujourd&apos;hui</span>
          </div>
        </Card>
        <Card>
          <CardTitle sub="Par chiffre d'affaires sur 30 jours.">Top produits vendus</CardTitle>
          {summary.topProducts.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft">Aucune vente sur la période synchronisée.</p>
          ) : (
            <div className="space-y-2">
              {summary.topProducts.map((p, i) => (
                <div key={p.title} className="inset-panel flex items-baseline gap-2.5 px-3 py-2">
                  <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-ink text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{p.title}</span>
                  <span className="num whitespace-nowrap text-[11.5px] text-ink-soft">×{p.quantity}</span>
                  <span className="num whitespace-nowrap text-[12.5px] font-semibold">{formatEUR(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Dernière commande */}
      {summary.lastOrder && (
        <Card className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-positive-soft text-positive">
            <ShoppingBag size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Dernière commande reçue</div>
            <p className="text-[12.5px] text-ink-soft">
              {summary.lastOrder.orderNumber} · {formatDateTime(summary.lastOrder.createdAt)} ·{" "}
              {formatEUR(summary.lastOrder.totalPrice)}
            </p>
          </div>
          <Link href="/orders" className="shrink-0 text-[12.5px] font-semibold text-brand hover:text-brand-strong">
            Ouvrir l&apos;Order Desk
          </Link>
        </Card>
      )}
    </div>
  );
}
