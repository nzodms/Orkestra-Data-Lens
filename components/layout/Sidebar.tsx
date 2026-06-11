"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-gray-200/70 bg-white/70 backdrop-blur-xl md:flex">
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
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${item.href}${qs}`}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all",
                active
                  ? "bg-brand-soft text-brand-strong shadow-[inset_0_0_0_1px_rgba(42,91,215,0.12)]"
                  : "text-ink-soft hover:bg-gray-100/80 hover:text-ink"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.9} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/anomalies" && anomalyCount > 0 && (
                <span className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-warn num">
                  {anomalyCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-gray-200/80 bg-gray-50/80 p-3">
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
