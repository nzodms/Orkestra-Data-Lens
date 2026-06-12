"use client";

import { useState } from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

/** Bouton « Tester le tracking » : insertion test annulée (ROLLBACK) côté serveur. */
export function TestTrackingButton() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "fail">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/tracking/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      setState(data.ok ? "ok" : "fail");
      setMessage(data.message ?? null);
    } catch {
      setState("fail");
      setMessage("Serveur injoignable.");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={run}
        disabled={state === "running"}
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-white disabled:opacity-60"
      >
        {state === "running" ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
        Tester le tracking
      </button>
      {message && (
        <span
          className={`inline-flex max-w-md items-start gap-1.5 text-[11.5px] font-medium ${
            state === "ok" ? "text-positive" : "text-critical"
          }`}
        >
          {state === "ok" ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
          {message}
        </span>
      )}
    </div>
  );
}
