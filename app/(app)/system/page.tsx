import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleSlash, Download, HeartPulse, Stethoscope, TriangleAlert, XCircle } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { PixelButton } from "@/components/domain/PixelButton";
import { SyncButton } from "@/components/domain/SyncButton";
import { TestTrackingButton } from "@/components/domain/TestTrackingButton";
import { getActiveDataset } from "@/lib/server/datasource";
import { computeDataHealth, runChecks, type CheckStatus } from "@/lib/server/diagnostics";
import { isOAuthConfigured } from "@/lib/server/env";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_UI: Record<CheckStatus, { icon: typeof CheckCircle2; tone: "green" | "orange" | "red" | "neutral"; label: string; color: string }> = {
  ok: { icon: CheckCircle2, tone: "green", label: "OK", color: "text-positive" },
  warn: { icon: TriangleAlert, tone: "orange", label: "À vérifier", color: "text-warn" },
  fail: { icon: XCircle, tone: "red", label: "Échec", color: "text-critical" },
  skip: { icon: CircleSlash, tone: "neutral", label: "Ignoré", color: "text-ink-soft" },
};

export default async function SystemPage() {
  const [{ dataset, mode, status }, checks] = await Promise.all([getActiveDataset(), runChecks()]);
  const health = await computeDataHealth(dataset, status);
  const failures = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;
  const oauthReady = isOAuthConfigured();
  const live = mode === "live";

  const colorFor = (v: number) =>
    v >= 85 ? "var(--color-positive)" : v >= 60 ? "var(--color-warn)" : "var(--color-critical)";

  return (
    <div className="space-y-4">
      {/* Data Health Score */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <HeartPulse size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight">Data Health Score</h2>
              {live ? <Badge tone="green">Données live</Badge> : <Badge tone="orange">Mode démo</Badge>}
            </div>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-soft">
              Fiabilité globale du pipeline : pixel, webhooks, commandes, sessions, réconciliation, UTM et anomalies.
              {health.lastOrderAt && ` Dernière commande reçue : ${formatDateTime(health.lastOrderAt)}.`}
            </p>
          </div>
          <ScoreRing value={health.globalScore} size={84} label="/100" />
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {health.components.map((c) => (
            <div key={c.label}>
              <div className="mb-0.5 flex items-baseline justify-between">
                <span className="text-[11.5px] font-medium">{c.label}</span>
                <span className="num text-[11.5px] font-semibold">{c.value}%</span>
              </div>
              <ProgressBar value={c.value} color={colorFor(c.value)} height={5} />
              <div className="mt-0.5 truncate text-[10.5px] text-ink-soft" title={c.detail}>
                {c.detail}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-ink/5 pt-3.5">
          <TestTrackingButton />
          {live && <PixelButton installed={status.pixelStatus === "installed"} />}
          {live && <SyncButton rangeDays={30} />}
          <a
            href="/api/export?type=diagnostic&format=json"
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-white"
          >
            <Download size={14} /> Exporter diagnostic
          </a>
        </div>
      </Card>

      {/* Vérifications détaillées */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink/5 text-ink-soft">
            <Stethoscope size={15} />
          </span>
          <h2 className="text-[14.5px] font-semibold tracking-tight">Vérifications ({checks.length})</h2>
          <span className="ml-auto">
            <Badge tone={failures > 0 ? "red" : warnings > 0 ? "orange" : "green"}>
              {failures > 0
                ? `${failures} échec${failures > 1 ? "s" : ""}`
                : warnings > 0
                  ? `${warnings} avertissement${warnings > 1 ? "s" : ""}`
                  : "Tout est opérationnel"}
            </Badge>
          </span>
        </div>
        <div className="space-y-2">
          {checks.map((check) => {
            const ui = STATUS_UI[check.status];
            const Icon = ui.icon;
            return (
              <div key={check.name} className="inset-panel flex items-start gap-3 px-3.5 py-2.5">
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
          <p className="mt-3 rounded-xl bg-ink/[0.03] px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
            Pour passer en mode live : copier <code className="rounded bg-ink/5 px-1 text-[11px]">.env.example</code> vers{" "}
            <code className="rounded bg-ink/5 px-1 text-[11px]">.env</code>, renseigner les variables, lancer{" "}
            <code className="rounded bg-ink/5 px-1 text-[11px]">npm run db:migrate</code>, puis connecter la boutique
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
