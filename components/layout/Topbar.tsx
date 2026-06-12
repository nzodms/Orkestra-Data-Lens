"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_TITLES } from "./nav";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "7d", label: "7 jours" },
] as const;

export type TopbarStatus = {
  mode: "demo" | "live";
  syncRunning: boolean;
  pixelInstalled: boolean;
  lastDataLabel: string | null;
};

export default function Topbar({ status }: { status: TopbarStatus }) {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const period = search.get("period") ?? "today";
  const page = PAGE_TITLES[pathname] ?? { title: "Orkestra Data Lens" };

  const setPeriod = (value: string) => {
    const params = new URLSearchParams(search.toString());
    if (value === "today") params.delete("period");
    else params.set("period", value);
    router.push(`${pathname}${params.size > 0 ? `?${params}` : ""}`);
  };

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="sticky top-0 z-20 border-b border-white/50 bg-surface/65 shadow-[0_1px_0_rgba(18,25,43,0.04)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight md:text-lg">{page.title}</h1>
          {page.subtitle && <p className="hidden truncate text-[12px] text-ink-soft sm:block">{page.subtitle}</p>}
        </div>

        <div className="hidden items-center gap-1.5 text-[12px] text-ink-soft lg:flex">
          <CalendarDays size={14} />
          <span className="capitalize">{today}</span>
        </div>

        <div className="flex rounded-xl border border-gray-200/80 bg-white p-0.5 shadow-sm">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-all",
                period === p.value
                  ? "bg-ink text-white shadow-sm"
                  : "text-ink-soft hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {status.mode === "demo" ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-warn/20 bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-warn pulse-dot" />
            Mode démo — données simulées
          </span>
        ) : (
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-positive/20 bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive"
              title={status.lastDataLabel ?? undefined}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-positive pulse-dot" />
              {status.syncRunning ? "Synchronisation en cours" : "Données live"}
            </span>
            {!status.pixelInstalled && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/20 bg-warn-soft px-2.5 py-1 text-[11px] font-semibold text-warn">
                Pixel non installé
              </span>
            )}
            {status.lastDataLabel && (
              <span className="hidden text-[10.5px] text-ink-soft lg:inline">{status.lastDataLabel}</span>
            )}
          </span>
        )}
      </div>
    </header>
  );
}
