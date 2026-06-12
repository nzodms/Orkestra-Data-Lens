"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, NAV_SECTION_LABELS, type NavSection } from "./nav";

export default function Sidebar({
  anomalyCount,
  shopName,
  shopDomain,
  mode,
}: {
  anomalyCount: number;
  shopName: string;
  shopDomain: string;
  mode: "demo" | "live";
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const period = search.get("period");
  const qs = period ? `?period=${period}` : "";

  return (
    <aside className="glass fixed bottom-3 left-3 top-3 z-30 hidden w-60 flex-col overflow-y-auto rounded-2xl md:flex">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-ai text-white shadow-sm">
          <Sparkles size={17} strokeWidth={2.2} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight">Orkestra</div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-soft">Data Lens</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {(["datalens", "orderdesk", "config"] as NavSection[]).map((section) => (
          <div key={section} className={cn(section !== "datalens" && "pt-3")}>
            {NAV_SECTION_LABELS[section] && (
              <div className="px-3 pb-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-ink-soft/70">
                {NAV_SECTION_LABELS[section]}
              </div>
            )}
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((i) => i.section === section).map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
            <Link
              key={item.href}
              href={`${item.href}${qs}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all duration-200",
                active
                  ? "bg-white/85 text-brand-strong shadow-[0_1px_2px_rgba(18,25,43,0.06),0_4px_12px_-6px_rgba(18,25,43,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-ink/5"
                  : "text-ink-soft hover:bg-white/55 hover:text-ink"
              )}
            >
              <Icon
                size={17}
                strokeWidth={active ? 2.2 : 1.9}
                className={cn("transition-transform duration-200", !active && "group-hover:scale-110")}
              />
              <span className="flex-1">{item.label}</span>
              {item.href === "/anomalies" && anomalyCount > 0 && (
                <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-warn num">
                  {anomalyCount}
                </span>
              )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="inset-panel m-3 p-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full pulse-dot", mode === "live" ? "bg-positive" : "bg-warn")} />
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wide",
              mode === "live" ? "text-positive" : "text-warn"
            )}
          >
            {mode === "live" ? "Données live" : "Mode démo"}
          </span>
        </div>
        <div className="mt-1.5 truncate text-[12.5px] font-medium">{shopName}</div>
        <div className="truncate text-[11px] text-ink-soft">{shopDomain}</div>
        {mode === "demo" ? (
          <Link
            href="/onboarding"
            className="mt-2.5 block rounded-lg bg-brand px-3 py-1.5 text-center text-[12px] font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            Connecter ma boutique
          </Link>
        ) : (
          <Link
            href="/settings"
            className="mt-2.5 block rounded-lg border border-gray-200/80 bg-white px-3 py-1.5 text-center text-[12px] font-semibold text-ink transition-colors hover:bg-gray-50"
          >
            État de la connexion
          </Link>
        )}
      </div>
    </aside>
  );
}
