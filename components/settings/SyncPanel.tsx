"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Package, RefreshCw, ShoppingCart, XCircle } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

type SyncResponse = {
  status?: "success" | "error";
  products?: number;
  variants?: number;
  orders?: number;
  lineItems?: number;
  refunds?: number;
  customers?: number;
  durationMs?: number;
  errorMessage?: string;
  error?: string;
};

const ACTIONS = [
  { key: "30d", label: "Resynchroniser 30 jours", icon: RefreshCw, body: { rangeDays: 30, scope: "all" } },
  { key: "7d", label: "Resynchroniser 7 jours", icon: RefreshCw, body: { rangeDays: 7, scope: "all" } },
  { key: "products", label: "Sync produits uniquement", icon: Package, body: { rangeDays: 30, scope: "products" } },
  { key: "orders", label: "Sync commandes uniquement", icon: ShoppingCart, body: { rangeDays: 30, scope: "orders" } },
] as const;

/** Panneau de synchronisation Shopify : 4 actions + progression réelle. */
export function SyncPanel() {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResponse | null>(null);

  const run = async (action: (typeof ACTIONS)[number]) => {
    setRunning(action.key);
    setResult(null);
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.body),
      });
      const data = (await res.json()) as SyncResponse;
      setResult(data);
      if (res.ok && data.status === "success") {
        toast("Synchronisation terminée", "success");
        router.refresh();
      } else {
        toast(data.errorMessage ?? data.error ?? "Échec de la synchronisation", "error");
      }
    } catch {
      setResult({ status: "error", errorMessage: "Serveur injoignable." });
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => run(a)}
            disabled={running != null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-[12px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-50"
          >
            {running === a.key ? <Loader2 size={13} className="animate-spin" /> : <a.icon size={13} />}
            {a.label}
          </button>
        ))}
      </div>

      {running && (
        <p className="text-[11.5px] font-medium text-brand">
          Synchronisation en cours — récupération depuis l&apos;API Shopify…
        </p>
      )}

      {result && (
        <div
          className={`fade-up rounded-xl px-3 py-2.5 text-[12px] leading-relaxed ${
            result.status === "success" ? "bg-positive-soft/70 text-positive" : "bg-critical-soft/70 text-critical"
          }`}
        >
          <div className="flex items-start gap-2 font-semibold">
            {result.status === "success" ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={14} className="mt-0.5 shrink-0" />
            )}
            {result.status === "success" ? (
              <span>
                {result.products ?? 0} produits ({result.variants ?? 0} variantes) · {result.orders ?? 0} commandes (
                {result.lineItems ?? 0} lignes) · {result.refunds ?? 0} remboursements · {result.customers ?? 0} clients
                {result.durationMs != null && ` — en ${(result.durationMs / 1000).toFixed(1).replace(".", ",")} s`}
              </span>
            ) : (
              <span>{result.errorMessage ?? result.error ?? "Échec de la synchronisation."}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
