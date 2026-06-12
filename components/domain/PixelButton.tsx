"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Radio, XCircle } from "lucide-react";

/** Bouton « Réinstaller le pixel » (Settings, mode live). */
export function PixelButton({ installed }: { installed: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = async () => {
    setState("running");
    setMessage(null);
    try {
      const res = await fetch("/api/shopify/pixel", { method: "POST" });
      const data = (await res.json()) as { status?: string; webPixelId?: string; error?: string };
      if (res.ok && data.status === "installed") {
        setState("success");
        setMessage(`Pixel actif (${data.webPixelId ?? "id inconnu"}).`);
        router.refresh();
      } else {
        setState("error");
        setMessage(data.error ?? "Échec de l'installation du pixel.");
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
        className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm transition-all hover:bg-white disabled:opacity-60"
      >
        {state === "running" ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
        {state === "running" ? "Installation en cours…" : installed ? "Réinstaller le pixel" : "Installer le pixel"}
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
