import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  CreditCard,
  Factory,
  HeartPulse,
  MessageCircle,
  Radio,
  Sunrise,
  TrendingDown,
  Truck,
} from "lucide-react";
import { AlertsPanel } from "@/components/cockpit/AlertsPanel";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { computeAlertCandidates } from "@/lib/alerts";
import { mergeAlertStates } from "@/lib/activity";
import { computeAbandonments } from "@/lib/analytics";
import { buildTodoList } from "@/lib/orderdesk/todo";
import { estimatedMarginPct } from "@/lib/orderdesk/types";
import { getAlertStates } from "@/lib/server/activity";
import { getActiveDataset } from "@/lib/server/datasource";
import { getDeskContext } from "@/lib/server/orderdesk";
import { cn, formatDateTime, formatEUR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const [{ dataset, mode, status }, { data: desk }, alertStates] = await Promise.all([
    getActiveDataset(),
    getDeskContext(),
    getAlertStates(),
  ]);

  const alerts = mergeAlertStates(
    computeAlertCandidates(desk, dataset, {
      mode,
      pixelStatus: status.pixelStatus,
      lastEventAt: status.lastEventAt,
    }),
    alertStates
  );
  const activeAlerts = alerts.filter((a) => a.status === "active");
  const criticalAnomalies = dataset.anomalies.filter((a) => a.severity === "high" || a.severity === "critical");

  const todos = buildTodoList(desk);
  const byKey = (id: string) => todos.find((t) => t.id === id)?.count ?? 0;

  const ordersToProcess = desk.orders.filter((o) => ["todo", "sourcing", "price_compare"].includes(o.opsStatus)).length;
  const noSupplier = byKey("no_supplier");
  const followUps = byKey("follow_up");
  const noTracking = byKey("tracking");
  const atRisk = desk.orders.filter((o) => ["problem", "sav", "payment_pending"].includes(o.opsStatus)).length;
  const lowMarginProducts = new Set(
    desk.orders
      .filter((o) => {
        const m = estimatedMarginPct(o, desk.offers);
        return m != null && m < 40;
      })
      .flatMap((o) => o.lineItems.map((li) => li.productId).filter(Boolean))
  ).size;

  const abandonments = computeAbandonments(dataset, "today");
  const recoverableLoss = Math.round(abandonments.reduce((a, b) => a + b.estimatedLoss, 0));

  const decisionsCount = todos.reduce((a, t) => a + t.count, 0) + criticalAnomalies.length;

  // Résumé narratif construit depuis les données réelles
  const parts: string[] = [];
  if (noSupplier > 0) parts.push(`${noSupplier} commande${noSupplier > 1 ? "s n'ont" : " n'a"} pas encore de fournisseur assigné`);
  if (followUps > 0) parts.push(`${followUps} fournisseur${followUps > 1 ? "s doivent" : " doit"} être relancé${followUps > 1 ? "s" : ""}`);
  if (noTracking > 0) parts.push(`${noTracking} commande${noTracking > 1 ? "s sont" : " est"} sans tracking`);
  if (criticalAnomalies.length > 0)
    parts.push(`${criticalAnomalies.length} anomalie${criticalAnomalies.length > 1 ? "s" : ""} data peuvent fausser le funnel`);
  const narrative = `Aujourd'hui, ${decisionsCount} action${decisionsCount > 1 ? "s nécessitent" : " nécessite"} une décision.${
    parts.length > 0 ? ` ${parts.join(", ")}.` : ""
  } Pertes récupérables estimées : ${formatEUR(recoverableLoss)}.`;

  const lastDataLabel = status.lastEventAt
    ? `${Math.max(0, Math.round((Date.now() - new Date(status.lastEventAt).getTime()) / 60000))} min`
    : mode === "demo"
      ? "démo"
      : "jamais";

  const pixelOk = mode === "demo" ? null : status.pixelStatus === "installed";
  const trackingOk = mode === "demo" ? null : status.lastEventAt != null && Date.now() - new Date(status.lastEventAt).getTime() < 6 * 3600 * 1000;

  const recentActivity = (desk.activities ?? []).slice(0, 8);

  const cards: {
    label: string;
    value: number | string;
    icon: typeof ClipboardList;
    tone: "red" | "orange" | "violet" | "blue" | "green" | "neutral";
    href: string;
    sub?: string;
  }[] = [
    { label: "Commandes à traiter", value: ordersToProcess, icon: ClipboardList, tone: ordersToProcess > 0 ? "red" : "green", href: "/orders?status=todo", sub: "Nouvelle commande / à sourcer" },
    { label: "Sans fournisseur", value: noSupplier, icon: Factory, tone: noSupplier > 0 ? "red" : "green", href: "/orders?focus=unassigned" },
    { label: "Relances dues", value: followUps, icon: MessageCircle, tone: followUps > 0 ? "orange" : "green", href: "/orders?focus=message_sent", sub: "Sans réponse depuis 2 j+" },
    { label: "Sans tracking", value: noTracking, icon: Truck, tone: noTracking > 0 ? "orange" : "green", href: "/orders?focus=tracking" },
    { label: "Commandes à risque", value: atRisk, icon: CreditCard, tone: atRisk > 0 ? "violet" : "green", href: "/orders?focus=problem", sub: "Problèmes + paiements en attente" },
    { label: "Marge faible", value: lowMarginProducts, icon: TrendingDown, tone: lowMarginProducts > 0 ? "orange" : "green", href: "/products", sub: "Produits à re-sourcer" },
    { label: "Anomalies critiques", value: criticalAnomalies.length, icon: AlertTriangle, tone: criticalAnomalies.length > 0 ? "red" : "green", href: "/anomalies" },
    { label: "Pertes récupérables", value: formatEUR(recoverableLoss), icon: TrendingDown, tone: recoverableLoss > 0 ? "orange" : "green", href: "/abandonments", sub: "Estimées aujourd'hui" },
  ];

  const toneStyles = {
    red: "bg-critical-soft text-critical",
    orange: "bg-warn-soft text-warn",
    violet: "bg-ai-soft text-ai",
    blue: "bg-brand-soft text-brand-strong",
    green: "bg-positive-soft text-positive",
    neutral: "bg-ink/5 text-ink-soft",
  } as const;

  return (
    <div className="space-y-4">
      {/* Résumé narratif */}
      <Card className="relative overflow-hidden p-4 md:p-5">
        <span className="absolute inset-y-0 left-0 w-1 rounded-l-[1.15rem] bg-gradient-to-b from-brand to-ai" />
        <div className="flex items-start gap-3.5 pl-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
            <Sunrise size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15.5px] font-semibold tracking-tight">
                {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              {mode === "demo" ? <Badge tone="orange">Mode démo</Badge> : <Badge tone="green">Données live</Badge>}
            </div>
            <p className="mt-1.5 max-w-3xl text-[13.5px] leading-relaxed">{narrative}</p>
          </div>
        </div>
      </Card>

      {/* Cartes cliquables */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-hover flex flex-col justify-between p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{c.label}</span>
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", toneStyles[c.tone])}>
                <c.icon size={13} strokeWidth={2.2} />
              </span>
            </div>
            <div className="num mt-1.5 text-[22px] font-semibold leading-tight tracking-tight">{c.value}</div>
            {c.sub && <div className="mt-0.5 text-[10.5px] leading-snug text-ink-soft">{c.sub}</div>}
          </Link>
        ))}
      </div>

      {/* Santé tracking / pixel / dernière donnée */}
      <Link href="/system" className="card card-hover flex flex-wrap items-center gap-x-6 gap-y-2 p-3.5">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold">
          <HeartPulse size={15} className="text-brand" /> Santé des données
        </span>
        <HealthChip label="Pixel" ok={pixelOk} demoLabel="démo" />
        <HealthChip label="Tracking" ok={trackingOk} demoLabel="démo" />
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <Radio size={12} /> Dernière donnée : <span className="num font-semibold text-ink">{lastDataLabel}</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-brand">
          Ouvrir <ArrowRight size={12} />
        </span>
      </Link>

      {/* Alertes + activité récente */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AlertsPanel alerts={alerts} />
        </div>
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink/5 text-ink-soft">
              <Activity size={15} />
            </span>
            <h2 className="text-[14.5px] font-semibold tracking-tight">Activité récente</h2>
            <Link href="/activity" className="ml-auto text-[12px] font-semibold text-brand hover:text-brand-strong">
              Tout voir
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-[12px] text-ink-soft">Aucune action enregistrée pour l&apos;instant.</p>
          ) : (
            <ol className="relative ml-1 space-y-2.5 border-l border-ink/8 pl-4">
              {recentActivity.map((a) => (
                <li key={a.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-2 ring-white",
                      a.actorType === "system" ? "bg-ink/30" : "bg-brand/60"
                    )}
                  />
                  <div className="text-[12px] font-semibold leading-snug">{a.title}</div>
                  <div className="flex items-baseline gap-2 text-[10.5px] text-ink-soft">
                    <span>{a.actorType === "system" ? "Système" : "Vous"}</span>
                    <span className="num">{formatDateTime(a.createdAt)}</span>
                  </div>
                  {a.description && <p className="text-[11px] leading-snug text-ink-soft">{a.description}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Nombre d'alertes actives en pied de page contextuel */}
      <p className="text-center text-[11px] text-ink-soft">
        {activeAlerts.length} alerte{activeAlerts.length > 1 ? "s" : ""} active{activeAlerts.length > 1 ? "s" : ""} ·{" "}
        {decisionsCount} décision{decisionsCount > 1 ? "s" : ""} en attente · données{" "}
        {mode === "demo" ? "de démonstration" : "live"}
      </p>
    </div>
  );
}

function HealthChip({ label, ok, demoLabel }: { label: string; ok: boolean | null; demoLabel: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px]">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          ok == null ? "bg-warn pulse-dot" : ok ? "bg-positive" : "bg-critical pulse-dot"
        )}
      />
      <span className="text-ink-soft">{label} :</span>
      <span className={cn("font-semibold", ok == null ? "text-warn" : ok ? "text-positive" : "text-critical")}>
        {ok == null ? demoLabel : ok ? "OK" : "problème"}
      </span>
    </span>
  );
}
