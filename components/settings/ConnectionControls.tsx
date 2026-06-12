"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plug, PlugZap, Unplug } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

/** Bascule explicite Mode démo / Mode live (boutique connectée requise). */
export function DataModeSwitch({ mode }: { mode: "live" | "demo" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const setMode = async (next: "live" | "demo") => {
    if (next === mode) return;
    setPending(true);
    try {
      const res = await fetch("/api/shopify/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (res.ok) {
        toast(next === "live" ? "Mode live activé — données Shopify réelles." : "Retour au mode démo.", "success");
        router.refresh();
      } else {
        toast("Bascule impossible", "error");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-xl border border-ink/10 bg-white/60 p-0.5 shadow-sm">
        {(
          [
            { value: "demo", label: "Mode démo" },
            { value: "live", label: "Mode live" },
          ] as const
        ).map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            disabled={pending}
            className={cn(
              "rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-all",
              mode === m.value
                ? m.value === "live"
                  ? "bg-positive text-white shadow-sm"
                  : "bg-warn text-white shadow-sm"
                : "text-ink-soft hover:text-ink"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {pending && <Loader2 size={14} className="animate-spin text-ink-soft" />}
    </div>
  );
}

/** Re-test de la connexion enregistrée (résultat réel Shopify). */
export function TestSavedConnectionButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/shopify/test", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; shopName?: string; error?: string };
      if (data.ok) toast(`Connexion valide${data.shopName ? ` : ${data.shopName}` : ""}`, "success");
      else toast(data.error ?? "Connexion invalide", "error");
      router.refresh();
    } catch {
      toast("Serveur injoignable", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
      Tester la connexion
    </button>
  );
}

/** Déconnexion avec confirmation explicite (option suppression des données). */
export function DisconnectButton({ shopDomain }: { shopDomain: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleteData, setDeleteData] = useState(false);
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const res = await fetch("/api/shopify/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteData }),
      });
      if (res.ok) {
        toast(deleteData ? "Boutique déconnectée, données supprimées." : "Boutique déconnectée — retour au mode démo.", "success");
        setOpen(false);
        router.refresh();
      } else {
        toast("Déconnexion impossible", "error");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-critical/25 bg-critical-soft px-3 py-1.5 text-[12px] font-semibold text-critical hover:bg-critical hover:text-white"
      >
        <Unplug size={13} /> Déconnecter la boutique
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button aria-label="Annuler" className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-[3px]" onClick={() => setOpen(false)} />
          <div className="glass-strong fade-up relative w-full max-w-md rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-critical-soft text-critical">
                <AlertTriangle size={17} />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold tracking-tight">Déconnecter {shopDomain} ?</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                  Le token Admin API sera supprimé et l&apos;application repassera en mode démo.
                </p>
                <label className="mt-3 flex items-start gap-2 text-[12px] leading-snug">
                  <input
                    type="checkbox"
                    checked={deleteData}
                    onChange={(e) => setDeleteData(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Supprimer aussi <span className="font-semibold">toutes les données synchronisées</span> (produits,
                    commandes, fournisseurs, journal). Irréversible.
                  </span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-white"
              >
                Annuler
              </button>
              <button
                onClick={run}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-critical px-3.5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />}
                {deleteData ? "Déconnecter et tout supprimer" : "Déconnecter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Envoie un vrai événement de test à /api/tracking/event. */
export function SendTestEventButton({ shopDomain, disabled }: { shopDomain: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    const now = Date.now();
    try {
      const res = await fetch("/api/tracking/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain,
          visitorId: "visitor_manual_test",
          sessionId: `session_manual_test_${now}`,
          eventName: "page_viewed",
          timestamp: new Date().toISOString(),
          pageUrl: "/orkestra-test",
          device: "desktop",
          metadata: { test: true, source: "settings_test_button" },
        }),
      });
      const data = (await res.json()) as { accepted?: boolean; duplicate?: boolean; error?: string; reason?: string };
      if (data.accepted) {
        toast("Événement test reçu — visible dans Parcours visiteurs.", "success");
        router.refresh();
      } else {
        toast(data.error ?? data.reason ?? "Événement refusé", "error");
      }
    } catch {
      toast("Serveur injoignable", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      onClick={run}
      disabled={pending || disabled}
      title={disabled ? "Disponible uniquement avec une boutique live connectée" : undefined}
      className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3 py-1.5 text-[12px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <PlugZap size={13} />}
      Envoyer un événement test
    </button>
  );
}
