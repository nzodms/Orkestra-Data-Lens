"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Plug, Store, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

type TestResult = {
  ok: boolean;
  dryRun?: boolean;
  shopName?: string;
  currency?: string;
  scopes?: string[];
  missingScopes?: string[];
  error?: string;
};

/**
 * Connexion boutique Shopify :
 * Option A — OAuth officiel (app Shopify) ;
 * Option B — token Admin API manuel (test immédiat sans app publiée).
 * Le token n'est jamais réaffiché après sauvegarde.
 */
export function ConnectShopify({
  oauthConfigured,
  manualAvailable,
  compact = false,
}: {
  oauthConfigured: boolean;
  manualAvailable: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [apiVersion, setApiVersion] = useState("2025-01");
  const [pending, setPending] = useState<"test" | "connect" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  const submit = async (dryRun: boolean) => {
    setPending(dryRun ? "test" : "connect");
    setResult(null);
    try {
      const res = await fetch("/api/shopify/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim(), token: token.trim(), apiVersion, dryRun }),
      });
      const data = (await res.json()) as TestResult;
      setResult({ ...data, dryRun });
      if (!dryRun && data.ok) {
        setToken(""); // le token ne reste jamais côté client après sauvegarde
        toast("Boutique connectée — lancez la synchronisation 30 jours.", "success");
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: "Serveur injoignable." });
    } finally {
      setPending(null);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[12.5px] shadow-sm outline-none focus:border-brand/50";

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="grid gap-2 sm:grid-cols-2">
          {/* Option A — OAuth */}
          <div className={cn("inset-panel p-3", !oauthConfigured && "opacity-70")}>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
              <Plug size={13} className="text-brand" /> Option A — OAuth Shopify officiel
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Flux d&apos;app Shopify complet (HMAC, state anti-CSRF, webhooks et pixel automatiques).
              {!oauthConfigured && " Indisponible : variables SHOPIFY_API_KEY / SECRET / APP_URL non configurées."}
            </p>
            {oauthConfigured && (
              <div className="mt-2 flex gap-2">
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="ma-boutique.myshopify.com"
                  className={inputCls}
                />
                <button
                  onClick={() => domain.trim() && (window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(domain.trim())}`)}
                  disabled={!domain.trim()}
                  className="shrink-0 rounded-xl bg-brand px-3 py-2 text-[12px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
                >
                  OAuth
                </button>
              </div>
            )}
          </div>

          {/* Option B — note */}
          <div className="inset-panel p-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
              <KeyRound size={13} className="text-positive" /> Option B — Token Admin API (test rapide)
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
              Créez une app custom dans votre admin Shopify (Paramètres → Applications → Développer des apps),
              accordez <code className="rounded bg-ink/5 px-1">read_products</code> et{" "}
              <code className="rounded bg-ink/5 px-1">read_orders</code>, puis collez le token{" "}
              <code className="rounded bg-ink/5 px-1">shpat_…</code> ci-dessous. Aucune app publiée nécessaire.
            </p>
          </div>
        </div>
      )}

      {/* Formulaire token manuel */}
      <div className={cn("space-y-2", !manualAvailable && "pointer-events-none opacity-60")}>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Domaine Shopify
            </span>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="ma-boutique.myshopify.com" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Admin API access token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="shpat_…"
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              Version API
            </span>
            <select value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className={inputCls}>
              <option value="2025-01">2025-01</option>
              <option value="2024-10">2024-10</option>
              <option value="2024-07">2024-07</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => submit(true)}
            disabled={pending != null || !domain.trim() || !token.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white/70 px-3.5 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-white disabled:opacity-50"
          >
            {pending === "test" ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            Tester la connexion
          </button>
          <button
            onClick={() => submit(false)}
            disabled={pending != null || !domain.trim() || !token.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
          >
            {pending === "connect" ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
            Connecter la boutique
          </button>
        </div>
        {!manualAvailable && (
          <p className="text-[11px] text-warn">
            DATABASE_URL et ENCRYPTION_SECRET doivent être configurés côté serveur pour activer la connexion.
          </p>
        )}
      </div>

      {/* Résultat réel du test / de la connexion */}
      {result && (
        <div
          className={cn(
            "fade-up rounded-xl px-3 py-2.5 text-[12px] leading-relaxed",
            result.ok ? "bg-positive-soft/70 text-positive" : "bg-critical-soft/70 text-critical"
          )}
        >
          <div className="flex items-start gap-2 font-semibold">
            {result.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
            <span>
              {result.ok
                ? `${result.dryRun ? "Connexion valide" : "Boutique connectée"}${result.shopName ? ` : ${result.shopName}` : ""}${result.currency ? ` (${result.currency})` : ""}`
                : result.error ?? "Échec de la connexion."}
            </span>
          </div>
          {result.scopes && result.scopes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {result.scopes.map((s) => (
                <Badge key={s} tone={result.missingScopes?.includes(s) ? "red" : "green"}>
                  {s}
                </Badge>
              ))}
            </div>
          )}
          {result.ok && result.dryRun && (
            <p className="mt-1 text-[11px] text-ink-soft">
              Cliquez « Connecter la boutique » pour enregistrer (token chiffré, jamais réaffiché).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
