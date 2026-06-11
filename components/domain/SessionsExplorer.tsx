"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Monitor, Search, Smartphone, Tablet } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
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
  if (has(s, "product_viewed")) return { label: "Produit vu", tone: "blue" };
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(40);

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
    "rounded-xl border border-gray-200/80 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink shadow-sm outline-none focus:border-brand/40";

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
                "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all",
                stage === f.value
                  ? "border-ink bg-ink text-white shadow-sm"
                  : "border-gray-200/80 bg-white text-ink-soft hover:text-ink"
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

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Search size={20} className="text-ink-soft" />
          <p className="text-[13px] font-medium">Aucune session ne correspond à ces filtres</p>
          <p className="text-[12px] text-ink-soft">Élargissez la période ou réinitialisez les filtres.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, limit).map((session) => {
            const stageInfo = stageOf(session);
            const isOpen = expanded === session.id;
            const DeviceIcon = DEVICE_ICONS[session.device];
            const shortId = session.id.replace("ses_", "").slice(0, 4).toUpperCase();
            return (
              <div key={session.id} className="card overflow-hidden p-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : session.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-gray-50/70"
                >
                  <span className="num rounded-lg bg-gray-100 px-2 py-1 text-[11px] font-bold tracking-wide">
                    #{shortId}
                  </span>
                  <span className="num text-[12px] font-semibold">
                    {formatDate(session.startedAt)} · {formatTimeShort(session.startedAt)}
                  </span>
                  <span className="hidden items-center gap-1 text-[11.5px] text-ink-soft sm:flex">
                    <DeviceIcon size={13} />
                    {session.country}
                  </span>
                  <span className="hidden max-w-44 truncate text-[11.5px] text-ink-soft md:block">
                    {formatSourceLabel(session.source, session.medium)}
                    {session.campaign ? ` / ${session.campaign}` : ""}
                  </span>
                  <span className="num hidden text-[11.5px] text-ink-soft lg:block">
                    {session.durationSeconds ? formatDuration(session.durationSeconds) : "—"}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <Badge tone={stageInfo.tone}>{stageInfo.label}</Badge>
                    <ChevronDown
                      size={15}
                      className={cn("text-ink-soft transition-transform", isOpen && "rotate-180")}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div className="fade-up border-t border-gray-100 px-4 py-4 md:px-5">
                    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-ink-soft">
                      <span>
                        Session <span className="num font-semibold text-ink">{session.id}</span>
                      </span>
                      <span>
                        Visiteur <span className="num font-semibold text-ink">{session.visitorId}</span>
                      </span>
                      <span>
                        Landing <span className="font-medium text-ink">{session.landingPage}</span>
                      </span>
                      <span>
                        Fiabilité <span className="num font-semibold text-ink">{session.reliabilityScore}/100</span>
                      </span>
                      <span>{session.browser}</span>
                    </div>
                    <SessionTimeline session={session} />
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 40)}
              className="card w-full py-2.5 text-center text-[12.5px] font-semibold text-brand transition-colors hover:bg-brand-soft/50"
            >
              Afficher plus ({filtered.length - limit} restantes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
