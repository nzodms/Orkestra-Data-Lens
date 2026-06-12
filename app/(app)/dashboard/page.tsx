import Link from "next/link";
import { ArrowRight, ShoppingBag, Sparkles } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { AnomalyCard } from "@/components/domain/AnomalyCard";
import { FunnelSteps } from "@/components/domain/FunnelSteps";
import { InsightCard } from "@/components/domain/InsightCard";
import { ReliabilityPanel } from "@/components/domain/ReliabilityPanel";
import { Card, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { LiveCommerceDashboard } from "@/components/domain/LiveCommerceDashboard";
import { getCommerceSummary } from "@/lib/server/commerce";
import { getActiveDataset } from "@/lib/server/datasource";
import { getConnectedShop } from "@/lib/server/repo";
import {
  computeRawFunnel,
  computeVerifiedFunnel,
  ordersInPeriod,
  parsePeriod,
  revenueOf,
  sessionsInPeriod,
} from "@/lib/funnel";
import { computeAbandonments } from "@/lib/analytics";
import { generateDailySummary, generateInsights, generatePriorityActions } from "@/lib/insights";
import { computeReliability } from "@/lib/scoring";
import { dayOffsetOf, formatEUR, formatPct, formatTimeShort } from "@/lib/utils";
import { TrendingDown, Zap } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const { dataset, mode, status, liveEmpty } = await getActiveDataset();
  if (mode === "live" && liveEmpty) {
    // Boutique connectée mais aucun événement pixel : dashboard 100 % Shopify
    // (CA, commandes, remboursements réels) — aucune métrique comportementale inventée.
    const shop = await getConnectedShop();
    const summary = shop ? await getCommerceSummary(shop.id) : null;
    if (summary) {
      return <LiveCommerceDashboard summary={summary} pixelInstalled={status.pixelStatus === "installed"} />;
    }
  }
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const orders = ordersInPeriod(dataset.orders, period);
  const raw = computeRawFunnel(sessions);
  const verified = computeVerifiedFunnel(sessions, dataset.orders, period);
  const reliability = computeReliability(dataset, period);
  const summary = generateDailySummary(dataset, period);
  const insights = generateInsights(dataset, period);
  const revenue = revenueOf(orders);
  const conversion = raw.sessions === 0 ? 0 : (verified.confirmedOrders / raw.sessions) * 100;

  // Tendance 7 jours (sessions et CA par jour, du plus ancien au plus récent)
  const trendSessions: number[] = [];
  const trendRevenue: number[] = [];
  for (let offset = 6; offset >= 0; offset--) {
    trendSessions.push(dataset.sessions.filter((s) => dayOffsetOf(s.startedAt) === offset).length);
    trendRevenue.push(
      Math.round(
        dataset.orders
          .filter((o) => dayOffsetOf(o.createdAt) === offset)
          .reduce((a, o) => a + o.totalPrice, 0)
      )
    );
  }

  const lastOrder = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const topAnomalies = dataset.anomalies.slice(0, 2);
  const actions = generatePriorityActions(dataset, period);
  const topAction = actions[0];
  const abandonments = computeAbandonments(dataset, period);
  const recoverableLoss = Math.round(abandonments.reduce((a, b) => a + b.estimatedLoss, 0));
  const topLossCategory = [...abandonments].sort((a, b) => b.estimatedLoss - a.estimatedLoss)[0];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        <Stat label="Sessions" value={raw.sessions} sub={`${raw.productViews} avec produit vu`} />
        <Stat label="Ajouts panier" value={raw.addToCarts} sub={`${formatPct(raw.sessions ? (raw.addToCarts / raw.sessions) * 100 : 0, 2)} des sessions`} tone={raw.sessions > 0 && raw.addToCarts / raw.sessions < 0.03 ? "critical" : "default"} />
        <Stat
          label="Paiements atteints"
          value={raw.paymentReached}
          sub={
            verified.outOfCohortPayments > 0
              ? `dont ${verified.outOfCohortPayments} hors cohorte`
              : "tous dans la cohorte"
          }
          tone={verified.outOfCohortPayments > 0 ? "warn" : "default"}
        />
        <Stat label="Commandes confirmées" value={verified.confirmedOrders} sub="Vérifiées Shopify" tone="positive" />
        <Stat label="CA confirmé" value={formatEUR(revenue)} sub="Source : commandes Shopify" tone="positive" />
        <Stat label="Conversion vérifiée" value={formatPct(conversion, 2)} sub="Commandes / sessions" />
        <Stat
          label="Fiabilité données"
          value={`${reliability.globalScore}/100`}
          tone={reliability.globalScore >= 85 ? "positive" : "warn"}
          sub={`${reliability.anomalyCount} anomalies détectées`}
        />
        <Stat label="Checkouts commencés" value={raw.checkoutsStarted} sub={`${verified.checkoutsStarted} dans la cohorte`} />
      </div>

      {/* Action du jour + pertes récupérables */}
      {topAction && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card card-hover relative overflow-hidden p-4 md:p-5 lg:col-span-2">
            <span className="absolute inset-y-0 left-0 w-1 rounded-l-[1.15rem] bg-gradient-to-b from-brand to-brand-strong" />
            <div className="flex items-start gap-3.5 pl-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                <Zap size={18} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-strong">
                  Action du jour
                </div>
                <h2 className="mt-0.5 text-[15.5px] font-semibold leading-snug tracking-tight">{topAction.title}</h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{topAction.description}</p>
                <p className="mt-2 border-l-2 border-brand/25 pl-2.5 text-[11.5px] italic leading-relaxed text-ink-soft">
                  {topAction.justification}
                </p>
                <Link
                  href={`/truth-funnel${period !== "today" ? `?period=${period}` : ""}`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-ink px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-black"
                >
                  Voir toutes les actions <ArrowRight size={13} />
                </Link>
              </div>
              {topAction.estimatedRevenue != null && (
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="num text-[22px] font-semibold text-positive">
                    +{formatEUR(topAction.estimatedRevenue)}
                  </div>
                  <div className="text-[10.5px] text-ink-soft">impact estimé</div>
                </div>
              )}
            </div>
          </div>
          <Link href={`/abandonments${period !== "today" ? `?period=${period}` : ""}`} className="card card-hover flex flex-col justify-between p-4 md:p-5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                Pertes récupérables
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-critical-soft text-critical">
                <TrendingDown size={13} strokeWidth={2.2} />
              </span>
            </div>
            <div className="num mt-1 text-[26px] font-semibold tracking-tight text-critical">
              {formatEUR(recoverableLoss)}
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">
              {topLossCategory
                ? `Principalement sur « ${topLossCategory.label.toLowerCase()} » (${formatEUR(Math.round(topLossCategory.estimatedLoss))}). Voir le plan de récupération →`
                : "Aucune perte estimée sur la période."}
            </p>
          </Link>
        </div>
      )}

      {/* Résumé + fiabilité */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ai-soft text-ai">
              <Sparkles size={15} />
            </span>
            <h2 className="text-[14.5px] font-semibold tracking-tight">
              Ce qui s&apos;est passé{period === "today" ? " aujourd'hui" : period === "yesterday" ? " hier" : " sur 7 jours"}
            </h2>
          </div>
          <div className="space-y-1.5">
            {summary.map((line, i) => (
              <p
                key={i}
                className="fade-up text-[13.5px] leading-relaxed"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {line}
              </p>
            ))}
          </div>
          <Link
            href={`/truth-funnel${period !== "today" ? `?period=${period}` : ""}`}
            className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-strong"
          >
            Voir la vérité du tunnel <ArrowRight size={14} />
          </Link>
        </Card>
        <ReliabilityPanel score={reliability} anomalyCount={reliability.anomalyCount} compact />
      </div>

      {/* Funnel + tendance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Parcours reconstruits session par session — paiements hors cohorte exclus.">
            Funnel vérifié
          </CardTitle>
          <FunnelSteps
            rows={[
              { label: "Sessions", value: verified.sessions },
              { label: "Vues produit", value: verified.productViews },
              { label: "Ajouts panier", value: verified.addToCarts },
              {
                label: "Checkouts (cohorte)",
                value: verified.checkoutsStarted,
                note: verified.outOfCohortCheckouts > 0 ? `+${verified.outOfCohortCheckouts} repris` : undefined,
              },
              {
                label: "Paiements (cohorte)",
                value: verified.paymentReached,
                note: verified.outOfCohortPayments > 0 ? `+${verified.outOfCohortPayments} hors cohorte` : undefined,
              },
              { label: "Commandes confirmées", value: verified.confirmedOrders, noteTone: "green" },
            ]}
          />
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardTitle>Sessions — 7 derniers jours</CardTitle>
            <Sparkline values={trendSessions} height={56} />
            <div className="mt-2 flex justify-between text-[10.5px] text-ink-soft">
              <span>J-6</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </Card>
          <Card>
            <CardTitle>CA confirmé — 7 derniers jours</CardTitle>
            <Sparkline values={trendRevenue} height={56} color="var(--color-positive)" />
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[10.5px] text-ink-soft">J-6 → aujourd&apos;hui</span>
              <span className="num text-[12.5px] font-semibold text-positive">
                {formatEUR(trendRevenue.reduce((a, b) => a + b, 0))} sur 7 j
              </span>
            </div>
          </Card>
        </div>
      </div>

      {/* Fait marquant */}
      {lastOrder && (
        <Card className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-positive-soft text-positive">
            <ShoppingBag size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold">Événement le plus important de la période</div>
            <p className="text-[12.5px] text-ink-soft">
              Commande {lastOrder.orderNumber} confirmée par Shopify à {formatTimeShort(lastOrder.createdAt)} —{" "}
              {formatEUR(lastOrder.totalPrice)}
              {lastOrder.source ? ` · source ${lastOrder.source}` : " · source inconnue"}
            </p>
          </div>
          <Link
            href={`/sessions${period !== "today" ? `?period=${period}` : ""}`}
            className="hidden shrink-0 text-[12.5px] font-semibold text-brand hover:text-brand-strong sm:block"
          >
            Voir la session
          </Link>
        </Card>
      )}

      {/* Insights */}
      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      {/* Anomalies principales */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14.5px] font-semibold tracking-tight">Principales anomalies</h2>
          <Link href="/anomalies" className="text-[12.5px] font-semibold text-brand hover:text-brand-strong">
            Tout voir ({dataset.anomalies.length})
          </Link>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {topAnomalies.map((a) => (
            <AnomalyCard key={a.id} anomaly={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
