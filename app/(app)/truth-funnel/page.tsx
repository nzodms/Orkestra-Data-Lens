import Link from "next/link";
import { ArrowRight, GitCompareArrows, ShieldCheck } from "lucide-react";
import { ComparisonTable } from "@/components/domain/ComparisonTable";
import { FunnelSteps } from "@/components/domain/FunnelSteps";
import { PriorityActions } from "@/components/domain/PriorityActions";
import { ReliabilityPanel } from "@/components/domain/ReliabilityPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { LiveEmptyState } from "@/components/domain/LiveEmptyState";
import { getActiveDataset } from "@/lib/server/datasource";
import { computeDiscrepancies } from "@/lib/discrepancies";
import {
  computeRawFunnel,
  computeVerifiedFunnel,
  ordersInPeriod,
  parsePeriod,
  PERIOD_LABELS,
  sessionsInPeriod,
} from "@/lib/funnel";
import { generatePriorityActions } from "@/lib/insights";
import { computeReliability } from "@/lib/scoring";

export default async function TruthFunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const { dataset, mode, status, liveEmpty } = await getActiveDataset();
  if (mode === "live" && liveEmpty) {
    // Mode live sans événements pixel : on montre la structure du funnel et
    // les commandes Shopify réelles, sans simuler de comportement.
    const confirmedOrders = ordersInPeriod(dataset.orders, "7d").length;
    return (
      <div className="space-y-4">
        <Card className="border-brand/15 bg-brand-soft/30">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <GitCompareArrows size={18} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">
                Le funnel comportemental attend les premiers événements
              </h2>
              <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-soft">
                Votre boutique est connectée : {confirmedOrders} commande{confirmedOrders > 1 ? "s" : ""} Shopify
                confirmée{confirmedOrders > 1 ? "s" : ""} sur 7 jours. Les étapes vues produit → ajout panier →
                checkout → paiement seront reconstruites session par session dès que le pixel enverra des événements
                — rien n&apos;est simulé en mode live.
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle sub="Structure du funnel vérifié — alimentée dès les premiers événements pixel.">
            Funnel en attente de données
          </CardTitle>
          <FunnelSteps
            color="rgba(20,24,31,0.25)"
            rows={[
              { label: "Sessions trackées", value: 0 },
              { label: "Vues produit", value: 0 },
              { label: "Ajouts panier", value: 0 },
              { label: "Checkouts", value: 0 },
              { label: "Paiements atteints", value: 0 },
              { label: "Commandes confirmées Shopify (7 j)", value: confirmedOrders },
            ]}
          />
          <p className="mt-3 rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
            Installez le pixel ou envoyez un événement test depuis Paramètres pour vérifier le pipeline
            (`POST /api/tracking/event`).
          </p>
        </Card>
        <LiveEmptyState pixelInstalled={status.pixelStatus === "installed"} />
      </div>
    );
  }
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const raw = computeRawFunnel(sessions);
  const verified = computeVerifiedFunnel(sessions, dataset.orders, period);
  const reliability = computeReliability(dataset, period);
  const discrepancies = computeDiscrepancies(dataset, period);
  const actions = generatePriorityActions(dataset, period);

  const explanation =
    verified.outOfCohortPayments > 0
      ? `Shopify affiche ${raw.paymentReached} paiements atteints pour ${raw.addToCarts} ajouts panier sur la période. Notre analyse session par session montre que ${verified.outOfCohortPayments} paiement${verified.outOfCohortPayments > 1 ? "s" : ""} proviennent de paniers créés avant la période, de checkouts repris (emails de relance, retargeting) ou de sessions non réconciliées. Le funnel cohorte ne compte que les parcours dont chaque étape a eu lieu dans la période, dans le bon ordre.`
      : `Sur cette période, le funnel brut et le funnel cohorte sont alignés : chaque étape observée correspond à un parcours commencé dans la période.`;

  return (
    <div className="space-y-4">
      {/* En-tête de la page la plus importante */}
      <Card className="border-brand/10 bg-gradient-to-br from-white to-brand-soft/40">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
            <GitCompareArrows size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold tracking-tight">
              Ce que Shopify affiche vs ce qui s&apos;est vraiment passé
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{explanation}</p>
          </div>
          <Badge tone="blue" className="shrink-0">
            {PERIOD_LABELS[period]}
          </Badge>
        </div>
      </Card>

      {/* Funnel brut vs vérifié */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle sub="Tous les événements captés sur la période, sans vérification d'ordre ni d'origine — la lecture « Shopify Analytics ».">
            Funnel brut
          </CardTitle>
          <FunnelSteps
            color="rgba(20,24,31,0.55)"
            rows={[
              { label: "Sessions", value: raw.sessions },
              { label: "Vues produit", value: raw.productViews },
              { label: "Ajouts panier", value: raw.addToCarts },
              { label: "Checkouts commencés", value: raw.checkoutsStarted },
              { label: "Paiements atteints", value: raw.paymentReached },
              { label: "Commandes", value: raw.ordersCompleted },
            ]}
          />
          {verified.outOfCohortPayments > 0 && (
            <p className="mt-3 rounded-xl bg-warn-soft/70 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
              Incohérence apparente : {raw.paymentReached} paiements atteints pour seulement {raw.addToCarts} ajouts
              panier. Ce funnel mélange des parcours commencés avant la période.
            </p>
          )}
        </Card>

        <Card className="border-positive/15">
          <CardTitle sub="Parcours logiques reconstruits session par session, dans l'ordre, vérifiés avec les commandes Shopify.">
            <span className="inline-flex items-center gap-1.5">
              Funnel vérifié — cohorte
              <ShieldCheck size={15} className="text-positive" />
            </span>
          </CardTitle>
          <FunnelSteps
            color="var(--color-positive)"
            rows={[
              { label: "Sessions trackées", value: verified.sessions },
              { label: "Sessions avec produit vu", value: verified.productViews },
              { label: "Sessions avec ajout panier", value: verified.addToCarts },
              {
                label: "Checkout après ajout panier",
                value: verified.checkoutsStarted,
                note: verified.outOfCohortCheckouts > 0 ? `+${verified.outOfCohortCheckouts} repris` : undefined,
              },
              {
                label: "Paiement atteint (cohorte)",
                value: verified.paymentReached,
                note: verified.outOfCohortPayments > 0 ? `+${verified.outOfCohortPayments} hors cohorte` : undefined,
              },
              { label: "Commandes confirmées Shopify", value: verified.confirmedOrders },
            ]}
          />
          <p className="mt-3 rounded-xl bg-positive-soft/70 px-3 py-2 text-[11.5px] leading-relaxed text-positive">
            Taux de réconciliation : {verified.reconciliationRate}% des checkouts ont une origine panier identifiée.
          </p>
        </Card>
      </div>

      {/* Décomposition visuelle de l'écart */}
      {raw.paymentReached > 0 && (
        <Card>
          <CardTitle sub="Shopify compte ces paiements dans la même période. Data Lens identifie l'origine réelle de chacun.">
            D&apos;où viennent les {raw.paymentReached} paiements atteints ?
          </CardTitle>
          {(() => {
            const paymentSessions = sessions.filter((s) =>
              s.events.some((e) => e.eventName === "payment_step_reached")
            );
            const cohort = paymentSessions.filter((s) =>
              s.events.some(
                (e) => e.eventName === "payment_step_reached" && e.status !== "out_of_period" && e.status !== "incomplete"
              )
            ).length;
            const outOfPeriod = paymentSessions.filter((s) =>
              s.events.some((e) => e.eventName === "payment_step_reached" && e.status === "out_of_period")
            ).length;
            const unknownCart = paymentSessions.length - cohort - outOfPeriod;
            const total = Math.max(1, paymentSessions.length);
            const segments = [
              { label: "Parcours complet dans la période", count: cohort, color: "var(--color-positive)", soft: "bg-positive-soft text-positive" },
              { label: "Panier créé avant la période (checkout repris)", count: outOfPeriod, color: "var(--color-warn)", soft: "bg-warn-soft text-warn" },
              { label: "Panier d'origine inconnue (autre appareil / tracking bloqué)", count: unknownCart, color: "var(--color-critical)", soft: "bg-critical-soft text-critical" },
            ].filter((s) => s.count > 0);
            return (
              <div>
                <div className="flex h-9 w-full gap-1 overflow-hidden rounded-xl">
                  {segments.map((seg) => (
                    <div
                      key={seg.label}
                      className="grow-bar flex items-center justify-center rounded-lg text-[12px] font-bold text-white"
                      style={{ width: `${(seg.count / total) * 100}%`, background: seg.color, minWidth: 34 }}
                    >
                      {seg.count}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {segments.map((seg) => (
                    <span key={seg.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
                      <span className={`num rounded-md px-1.5 py-0.5 font-bold ${seg.soft}`}>{seg.count}</span>
                      {seg.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {/* Écarts détectés */}
      <Card>
        <CardTitle sub="Chaque écart entre les deux funnels, identifié et expliqué — au lieu d'être caché.">
          Écarts détectés
        </CardTitle>
        {discrepancies.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">Aucun écart détecté sur cette période.</p>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {discrepancies.map((d, i) => (
              <div
                key={d.id}
                className="fade-up flex items-start gap-3 rounded-xl border border-gray-200/70 bg-gray-50/60 p-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span
                  className={`num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${
                    d.tone === "critical"
                      ? "bg-critical-soft text-critical"
                      : d.tone === "warning"
                        ? "bg-warn-soft text-warn"
                        : "bg-brand-soft text-brand-strong"
                  }`}
                >
                  {d.count}
                </span>
                <div>
                  <div className="text-[12.5px] font-semibold leading-snug">{d.label}</div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{d.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <Link
          href={`/anomalies${period !== "today" ? `?period=${period}` : ""}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-strong"
        >
          Voir le détail des anomalies <ArrowRight size={14} />
        </Link>
      </Card>

      {/* Comparaison + fiabilité */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ComparisonTable raw={raw} verified={verified} />
        </div>
        <div className="lg:col-span-2">
          <ReliabilityPanel score={reliability} anomalyCount={reliability.anomalyCount} />
        </div>
      </div>

      {/* Actions recommandées */}
      <PriorityActions actions={actions} />
    </div>
  );
}
