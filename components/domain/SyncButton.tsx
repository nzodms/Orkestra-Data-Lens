"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

type SyncResponse = {
  mode: string;
  status?: "success" | "error";
  products?: number;
  orders?: number;
  refunds?: number;
  errorMessage?: string;
  error?: string;
};

export function SyncButton({ rangeDays = 30 }: { rangeDays?: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rangeDays }),
      });
      const data = (await res.json()) as SyncResponse;
      if (res.ok && data.status === "success") {
        setState("success");
        setMessage(
          `${data.products ?? 0} produits, ${data.orders ?? 0} commandes, ${data.refunds ?? 0} remboursements synchronisés.`
        );
        router.refresh();
      } else {
        setState("error");
        setMessage(data.errorMessage ?? data.error ?? "Échec de la synchronisation.");
      }
    } catch {
      setState("error");
      setMessage("Impossible de joindre le serveur.");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={run}
        disabled={state === "running"}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
      >
        {state === "running" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {state === "running" ? "Synchronisation en cours…" : `Resynchroniser (${rangeDays} jours)`}
      </button>
      {message && (
        <span
          className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${
            state === "success" ? "text-positive" : "text-critical"
          }`}
        >
          {state === "success" ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {message}
        </span>
      )}
    </div>
  );
}
