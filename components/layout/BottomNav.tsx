"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV, NAV_ITEMS } from "./nav";

export default function BottomNav({ anomalyCount }: { anomalyCount: number }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const period = search.get("period");
  const qs = period ? `?period=${period}` : "";
  const items = MOBILE_NAV.map((href) => NAV_ITEMS.find((n) => n.href === href)!);

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="glass flex items-center justify-between rounded-2xl px-2 py-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={`${item.href}${qs}`}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                active ? "text-brand-strong" : "text-ink-soft"
              )}
            >
              <span className={cn("rounded-lg px-2.5 py-0.5 transition-colors", active && "bg-brand-soft")}>
                <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
              </span>
              {item.shortLabel}
              {item.href === "/anomalies" && anomalyCount > 0 && (
                <span className="absolute right-[18%] top-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-warn px-0.5 text-[9px] font-bold text-white num">
                  {anomalyCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
