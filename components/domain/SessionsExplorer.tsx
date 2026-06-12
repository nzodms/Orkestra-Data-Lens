"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Minus, Monitor, Search, Smartphone, Tablet } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SessionTimeline } from "@/components/domain/SessionTimeline";
import { classifySource, formatSourceLabel, SOURCE_LABELS, type SourceKey } from "@/lib/events";
import type { VisitorSession } from "@/lib/types";
import { cn, formatDuration, formatDate, formatTimeShort } from "@/lib/utils";

type StageFilter =
  | "all"
  | "purchase"
  | "cart_abandon"
  | "checkout_abandon"
  | "payment_abandon"
  | "anomaly"
  | "missing_utm";

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  { value: "purchase", label: "Avec achat" },
  { value: "cart_abandon", label: "Abandon panier" },
  { value: "checkout_abandon", label: "Abandon checkout" },
  { value: "payment_abandon", label: "Abandon paiement" },
  { value: "anomaly", label: "Avec incohérence" },
  { value: "missing_utm", label: "UTM manquants" },
];

const has = (s: VisitorSession, name: string) => s.events.some((e) => e.eventName === name);

function stageOf(s: VisitorSession): { label: string; tone: BadgeTone } {
  if (s.status === "converted") return { label: "Achat confirmé", tone: "green" };
  if (s.status === "incomplete") return { label: "Session incomplète", tone: "orange" };
  if (s.status === "suspect") return { label: "Données suspectes", tone: "red" };
  if (has(s, "payment_step_reached")) return { label: "Abandon paiement", tone: "red" };
  if (has(s, "checkout_started")) return { label: "Abandon checkout", tone: "orange" };
  if (has(s, "product_added_to_cart")) return { label: "Abandon panier", tone: "orange" };
  if (has(s, "product_viewed")) return { label: "Abandon produit", tone: "blue" };
  return { label: "Visite simple", tone: "neutral" };
}

function hasAnomaly(s: VisitorSession): boolean {
  return s.events.some((e) => e.status === "out_of_period" || e.status === "incomplete" || e.status === "suspect");
}

function missingUtm(s: VisitorSession): boolean {
  const start = s.events.find((e) => e.eventName === "session_started");
  return !s.medium && !!start?.referrer && ["facebook", "instagram", "tiktok"].some((h) => start.referrer!.includes(h));
}

const DEVICE_ICONS = { mobile: Smartphone, desktop: Monitor, tablet: Tablet } as const;

/** Chemin de la session : source → landing → produit → panier → checkout → paiement → commande. */
function SessionPath({ session }: { session: VisitorSession }) {
  const steps = [
    { label: formatSourceLabel(session.source, session.medium), done: true },
    { label: "Landing", done: true },
    { label: "Produit", done: has(session, "product_viewed") },
    { label: "Panier", done: has(session, "product_added_to_cart") || has(session, "cart_viewed") },
    { label: "Checkout", done: has(session, "checkout_started") },
    { label: "Paiement", done: has(session, "payment_step_reached") },
    { label: "Commande", done: session.events.some((e) => e.eventName === "checkout_completed" && e.status === "confirmed") },
  ];
  let reachedEnd = false;
  return (
    <div className="flex flex-wrap items-center gap-y-1.5">
      {steps.map((step, i) => {
        if (!step.done && !reachedEnd) reachedEnd = true;
        const missed = !step.done;
        return (
          <span key={i} className="flex items-center">
            {i > 0 && <ChevronRight size={12} className="mx-0.5 text-ink-soft/50" />}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                step.done
                  ? i === steps.length - 1
                    ? "bg-positive-soft text-positive"
                    : "bg-white/80 text-ink shadow-sm ring-1 ring-ink/5"
                  : "bg-ink/5 text-ink-soft/60"
              )}
            >
              {step.done ? <Check size={10} strokeWidth={3} /> : <Minus size={10} />}
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

export function SessionsExplorer({
  sessions,
  productOptions,
}: {
  sessions: VisitorSession[];
  productOptions: { id: string; title: string }[];
}) {
  const [stage, setStage] = useState<StageFilter>("all");
  const [source, setSource] = useState<string>("all");
  const [device, setDevice] = useState<string>("all");
  const [product, setProduct] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<VisitorSession | null>(null);
  const [limit, setLimit] = useState(50);

  const sourceKeys = useMemo(() => {
    const keys = new Set<SourceKey>();
    sessions.forEach((s) => keys.add(classifySource(s.source, s.medium)));
    return [...keys];
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (stage === "purchase" && s.status !== "converted") return false;
      if (stage === "cart_abandon" && !(has(s, "product_added_to_cart") && !has(s, "checkout_started"))) return false;
      if (stage === "checkout_abandon" && !(has(s, "checkout_started") && !has(s, "payment_step_reached"))) return false;
      if (stage === "payment_abandon" && !(has(s, "payment_step_reached") && !has(s, "checkout_completed"))) return false;
      if (stage === "anomaly" && !hasAnomaly(s)) return false;
      if (stage === "missing_utm" && !missingUtm(s)) return false;
      if (source !== "all" && classifySource(s.source, s.medium) !== source) return false;
      if (device !== "all" && s.device !== device) return false;
      if (product !== "all" && !s.events.some((e) => e.productId === product)) return false;
      if (query && !s.id.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [sessions, stage, source, device, product, query]);

  const selectCls =
    "rounded-xl border border-ink/10 bg-white/70 px-2.5 py-1.5 text-[12px] font-medium text-ink shadow-sm outline-none transition-colors focus:border-brand/40 hover:bg-white";

  const selectedStage = selected ? stageOf(selected) : null;

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="card space-y-2.5 p-3.5">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStage(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all duration-200",
                stage === f.value
                  ? "border-ink bg-ink text-white shadow-md"
                  : "border-ink/10 bg-white/60 text-ink-soft hover:bg-white hover:text-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls} aria-label="Source">
            <option value="all">Toutes les sources</option>
            {sourceKeys.map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
          <select value={device} onChange={(e) => setDevice(e.target.value)} className={selectCls} aria-label="Appareil">
            <option value="all">Tous les appareils</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablette</option>
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)} className={selectCls} aria-label="Produit">
            <option value="all">Tous les produits</option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <div className="relative ml-auto">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ID session…"
              className={cn(selectCls, "w-36 pl-7")}
            />
          </div>
        </div>
        <div className="text-[11.5px] text-ink-soft">
          <span className="num font-semibold text-ink">{filtered.length}</span> session
          {filtered.length > 1 ? "s" : ""} correspondante{filtered.length > 1 ? "s" : ""}
        </div>
      </div>

      {/* Table premium */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/5 text-ink-soft">
            <Search size={20} />
          </span>
          <p className="text-[13px] font-medium">Aucune session ne correspond à ces filtres</p>
          <p className="text-[12px] text-ink-soft">Élargissez la période ou réinitialisez les filtres.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead>
                <tr className="border-b border-ink/5 text-left text-[10.5px] uppercase tracking-[0.08em] text-ink-soft">
                  <th className="px-4 py-3 font-semibold">Session</th>
                  <th className="px-3 py-3 font-semibold">Heure</th>
                  <th className="px-3 py-3 font-semibold">Source</th>
                  <th className="px-3 py-3 font-semibold">Appareil</th>
                  <th className="px-3 py-3 font-semibold">Durée</th>
                  <th className="px-3 py-3 font-semibold">Parcours</th>
                  <th className="px-4 py-3 text-right font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((session) => {
                  const stageInfo = stageOf(session);
                  const DeviceIcon = DEVICE_ICONS[session.device];
                  const shortId = session.id.replace("ses_", "").slice(0, 4).toUpperCase();
                  const lastStep = ["checkout_completed", "payment_step_reached", "checkout_started", "product_added_to_cart", "product_viewed"]
                    .findIndex((n) => has(session, n));
                  const pathDepth = lastStep === -1 ? 0 : 5 - lastStep;
                  return (
                    <tr
                      key={session.id}
                      onClick={() => setSelected(session)}
                      className="cursor-pointer border-b border-ink/[0.04] transition-colors last:border-0 hover:bg-white/70"
                    >
                      <td className="px-4 py-3">
                        <span className="num rounded-lg bg-ink/5 px-2 py-1 text-[11px] font-bold tracking-wide">
                          #{shortId}
                        </span>
                        {(hasAnomaly(session) || missingUtm(session)) && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-warn align-middle" title="Incohérence ou UTM manquant" />
                        )}
                      </td>
                      <td className="num whitespace-nowrap px-3 py-3 font-medium">
                        {formatDate(session.startedAt)} · {formatTimeShort(session.startedAt)}
                      </td>
                      <td className="max-w-44 truncate px-3 py-3 text-ink-soft">
                        {formatSourceLabel(session.source, session.medium)}
                        {session.campaign ? ` / ${session.campaign}` : ""}
                      </td>
                      <td className="px-3 py-3 text-ink-soft">
                        <span className="inline-flex items-center gap-1.5">
                          <DeviceIcon size={13} /> {session.country}
                        </span>
                      </td>
                      <td className="num px-3 py-3 text-ink-soft">
                        {session.durationSeconds ? formatDuration(session.durationSeconds) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-[3px]">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className={cn(
                                "h-1.5 w-4 rounded-full",
                                i <= pathDepth
                                  ? session.status === "converted"
                                    ? "bg-positive"
                                    : "bg-brand/70"
                                  : "bg-ink/8"
                              )}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone={stageInfo.tone}>{stageInfo.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="w-full border-t border-ink/5 py-2.5 text-center text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-soft/40"
            >
              Afficher plus ({filtered.length - limit} restantes)
            </button>
          )}
        </div>
      )}

      {/* Drawer détail session */}
      <Drawer
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected ? `Session #${selected.id.replace("ses_", "").slice(0, 4).toUpperCase()}` : ""}
        subtitle={selected ? `${formatDate(selected.startedAt)} · ${formatTimeShort(selected.startedAt)} · ${selected.browser ?? ""}` : undefined}
        badge={selectedStage && <Badge tone={selectedStage.tone}>{selectedStage.label}</Badge>}
      >
        {selected && (
          <div className="space-y-4">
            <div className="inset-panel p-3">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Chemin du visiteur
              </div>
              <SessionPath session={selected} />
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
              <Meta label="Visiteur" value={selected.visitorId} />
              <Meta label="Fiabilité" value={`${selected.reliabilityScore}/100`} />
              <Meta
                label="Source"
                value={`${formatSourceLabel(selected.source, selected.medium)}${selected.campaign ? ` / ${selected.campaign}` : ""}`}
              />
              <Meta label="Landing page" value={selected.landingPage} />
              <Meta label="Pays" value={selected.country ?? "—"} />
              <Meta
                label="Durée"
                value={selected.durationSeconds ? formatDuration(selected.durationSeconds) : "—"}
              />
            </div>

            <div>
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Timeline horodatée
              </div>
              <SessionTimeline session={selected} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="truncate font-medium" title={value}>
        {value}
      </div>
    </div>
  );
}
