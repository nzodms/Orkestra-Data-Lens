"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_TITLES } from "./nav";

export type SearchItem = { label: string; sub: string; type: string; href: string };

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

export default function Topbar({ status, searchIndex = [] }: { status: TopbarStatus; searchIndex?: SearchItem[] }) {
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

        <GlobalSearch items={searchIndex} />

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

        {/* statut mode (démo/live) */}
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

function GlobalSearch({ items }: { items: SearchItem[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const q = query.trim().toLowerCase();
  const matches =
    q.length < 2
      ? []
      : items
          .filter((i) => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q))
          .slice(0, 8);

  return (
    <div ref={ref} className="relative hidden sm:block">
      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Rechercher…"
        className="w-36 rounded-xl border border-ink/10 bg-white/70 py-1.5 pl-7 pr-2.5 text-[12px] font-medium shadow-sm outline-none transition-all focus:w-56 focus:border-brand/40 lg:w-44"
      />
      {open && matches.length > 0 && (
        <div className="glass-strong absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl p-1">
          {matches.map((m, i) => (
            <button
              key={`${m.href}-${i}`}
              onClick={() => {
                setOpen(false);
                setQuery("");
                router.push(m.href);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink/5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold">{m.label}</span>
                <span className="block truncate text-[10.5px] text-ink-soft">{m.sub}</span>
              </span>
              <span className="shrink-0 rounded-full bg-ink/5 px-1.5 py-0.5 text-[9.5px] font-semibold text-ink-soft">
                {m.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
