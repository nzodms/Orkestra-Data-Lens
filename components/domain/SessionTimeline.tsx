import { StatusBadge } from "@/components/ui/Badge";
import { describeEvent, EVENT_LABELS, isMilestone } from "@/lib/events";
import type { TrackingEvent, VisitorSession } from "@/lib/types";
import { cn, formatDuration, formatTime } from "@/lib/utils";

const DOT_COLORS: Record<string, string> = {
  observed: "bg-gray-300",
  confirmed: "bg-positive",
  reconciled: "bg-brand",
  incomplete: "bg-warn",
  out_of_period: "bg-warn",
  suspect: "bg-critical",
};

function abandonCause(session: VisitorSession): string | null {
  if (session.status === "converted") return null;
  const names = session.events.map((e) => e.eventName);
  if (names.includes("discount_code_rejected"))
    return "Cause probable : code promo refusé / coupon attendu";
  if (names.includes("payment_step_reached"))
    return "Cause probable : hésitation paiement / confiance / prix final / moyen de paiement";
  if (names.includes("checkout_shipping_info_submitted") || names.includes("checkout_started"))
    return "Cause probable : frais ou délais de livraison / formulaire trop long";
  if (names.includes("product_added_to_cart"))
    return "Cause probable : frais pas clairs / manque de confiance au panier";
  if (names.includes("product_viewed"))
    return "Cause probable : fiche produit pas assez convaincante / prix / trafic peu qualifié";
  return null;
}

export function SessionTimeline({ session }: { session: VisitorSession }) {
  const events = [...session.events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const cause = abandonCause(session);
  let lastMilestoneTs: string | null = null;

  return (
    <ol className="relative ml-1 border-l border-gray-200 pl-5">
      {events.map((event, i) => {
        const milestone = isMilestone(event);
        const details = describeEvent(event);
        let delta: number | null = null;
        if (milestone && lastMilestoneTs) {
          delta = Math.round((new Date(event.timestamp).getTime() - new Date(lastMilestoneTs).getTime()) / 1000);
        }
        if (milestone) lastMilestoneTs = event.timestamp;
        const isLast = i === events.length - 1;

        return (
          <li key={event.id} className={cn("relative pb-4", isLast && "pb-1")}>
            <span
              className={cn(
                "absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-white shadow-sm",
                DOT_COLORS[event.status] ?? "bg-gray-300",
                !milestone && "h-2.5 w-2.5 opacity-70"
              )}
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="num text-[11.5px] font-semibold text-ink-soft">{formatTime(event.timestamp)}</span>
              <span className={cn("text-[12.5px]", milestone ? "font-semibold" : "font-medium text-ink-soft")}>
                {EVENT_LABELS[event.eventName] ?? event.eventName}
              </span>
              {delta != null && delta > 0 && (
                <span className="num rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-ink-soft">
                  +{formatDuration(delta)}
                </span>
              )}
              {event.status !== "observed" && <StatusBadge status={event.status} />}
            </div>
            {details.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {details.map((line, j) => (
                  <div key={j} className="text-[11.5px] leading-snug text-ink-soft">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </li>
        );
      })}

      {session.status !== "converted" && (
        <li className="relative">
          <span className="absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-white bg-critical shadow-sm" />
          <div className="flex flex-wrap items-center gap-2">
            {session.endedAt && (
              <span className="num text-[11.5px] font-semibold text-ink-soft">{formatTime(session.endedAt)}</span>
            )}
            <span className="text-[12.5px] font-semibold text-critical">Abandon</span>
            <span className="text-[11.5px] text-ink-soft">
              Dernière étape : {EVENT_LABELS[lastMeaningfulEvent(events)] ?? "—"}
            </span>
          </div>
          {cause && <div className="mt-1 text-[11.5px] leading-snug text-ink-soft">{cause}</div>}
        </li>
      )}
    </ol>
  );
}

function lastMeaningfulEvent(events: TrackingEvent[]): string {
  for (let i = events.length - 1; i >= 0; i--) {
    if (isMilestone(events[i])) return events[i].eventName;
  }
  return events[events.length - 1]?.eventName ?? "";
}
