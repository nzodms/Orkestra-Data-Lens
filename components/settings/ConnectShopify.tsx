"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  KeyRound,
  Loader2,
  Plug,
  Rocket,
  Store,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { cn, getClientAppUrl } from "@/lib/utils";

type TestResult = {
  ok: boolean;
  dryRun?: boolean;
  shopName?: string;
  currency?: string;
  scopes?: string[];
  missingScopes?: string[];
  error?: string;
};

type ConnectMode = "token" | "dev_dashboard";

/**
 * Connexion boutique Shopify, deux modes au choix :
 *  - « token » : token Admin API legacy (shpat_…), test immédiat ;
 *  - « dev_dashboard » : app du nouveau Shopify Dev Dashboard via Client ID +
 *    Client Secret, flux OAuth complet (HMAC, échange de code, token chiffré).
 *
 * La validation `shpat_` ne concerne QUE le mode token. Le secret/token
 * n'est jamais réaffiché après enregistrement.
 */
export function ConnectShopify({
  oauthConfigured,
  manualAvailable,
  missingConfig = [],
  compact = false,
  defaultAppUrl,
  defaultScopes,
}: {
  oauthConfigured: boolean;
  manualAvailable: boolean;
  missingConfig?: string[];
  compact?: boolean;
  defaultAppUrl: string;
  defaultScopes: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ConnectMode>("token");

  // ── Mode token Admin API ───────────────────────────────────────────────────
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [apiVersion, setApiVersion] = useState("2025-01");
  const [pending, setPending] = useState<"test" | "connect" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  // ── Mode Dev Dashboard (OAuth) ──────────────────────────────────────────────
  const [ddDomain, setDdDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scopes, setScopes] = useState(defaultScopes);
  const [appUrl, setAppUrl] = useState(defaultAppUrl);
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [ddPending, setDdPending] = useState(false);
  const [ddError, setDdError] = useState<string | null>(null);

  const redirectUrl = `${appUrl.replace(/\/$/, "")}/api/shopify/callback`;

  // URL d'app : origine réelle de la page (ou NEXT_PUBLIC_APP_URL) plutôt
  // qu'une URL codée en dur, si le serveur n'en a pas fourni.
  useEffect(() => {
    setAppUrl((prev) => prev || getClientAppUrl());
  }, []);

  // Pré-remplissage si une config Dev Dashboard a déjà été enregistrée
  useEffect(() => {
    if (!manualAvailable) return;
    let cancelled = false;
    fetch("/api/shopify/oauth-config")
      .then((r) => r.json())
      .then((data: { ok: boolean; config: { clientId: string; scopes: string; appUrl: string } | null }) => {
        if (cancelled || !data.ok || !data.config) return;
        setClientId(data.config.clientId);
        setScopes(data.config.scopes || defaultScopes);
        setAppUrl(data.config.appUrl || getClientAppUrl());
        setHasSavedSecret(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manualAvailable, defaultAppUrl, defaultScopes]);

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
        setToken("");
        toast("Boutique connectée — lancez la synchronisation 30 jours.", "success");
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: "Serveur injoignable." });
    } finally {
      setPending(null);
    }
  };

  const connectDevDashboard = async () => {
    setDdError(null);
    if (!ddDomain.trim()) return setDdError("Renseignez le domaine de votre boutique.");
    if (!clientId.trim()) return setDdError("Renseignez le Client ID affiché dans Shopify.");
    if (!clientSecret.trim() && !hasSavedSecret) {
      return setDdError("Renseignez le Client Secret affiché dans Shopify.");
    }
    setDdPending(true);
    try {
      const res = await fetch("/api/shopify/oauth-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          // Champ vide + secret déjà enregistré → on conserve le secret existant
          // (le serveur omet la mise à jour du secret).
          clientSecret: clientSecret.trim() || undefined,
          scopes: scopes.trim() || defaultScopes,
          appUrl: appUrl.trim(),
          shop: ddDomain.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; authorizeUrl?: string | null };
      if (!res.ok || !data.ok) {
        setDdError(data.error ?? "Échec de l'enregistrement de la configuration.");
        return;
      }
      if (data.authorizeUrl) {
        // Redirection vers Shopify pour l'autorisation OAuth
        window.location.href = data.authorizeUrl;
      } else {
        toast("Configuration enregistrée.", "success");
        router.refresh();
      }
    } catch {
      setDdError("Serveur injoignable.");
    } finally {
      setDdPending(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-[12.5px] shadow-sm outline-none focus:border-brand/50";

  return (
    <div className="space-y-3">
      {/* Sélecteur de mode */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-ink/[0.04] p-1">
        <button
          onClick={() => setMode("token")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
            mode === "token" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          )}
        >
          <KeyRound size={13} /> J&apos;ai un token Admin API
        </button>
        <button
          onClick={() => setMode("dev_dashboard")}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors",
            mode === "dev_dashboard" ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
          )}
        >
          <Rocket size={13} /> J&apos;ai une app Dev Dashboard
        </button>
      </div>

      {/* Configuration serveur manquante : panneau explicite, pas de bouton mort */}
      {!manualAvailable && (
        <div className="rounded-xl border border-warn/25 bg-warn-soft/60 p-3.5">
          <div className="text-[12.5px] font-semibold text-warn">
            Configuration serveur requise pour connecter une vraie boutique
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
            Le mode live a besoin d&apos;une base PostgreSQL et d&apos;un secret de chiffrement pour stocker le
            token/secret en sécurité. Variables manquantes sur ce serveur :
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {(missingConfig.length > 0 ? missingConfig : ["DATABASE_URL", "ENCRYPTION_SECRET"]).map((v) => (
              <Badge key={v} tone="red">
                {v}
              </Badge>
            ))}
          </div>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-soft">
            <li>Créez une base PostgreSQL (Supabase, Neon ou locale) et copiez son URL de connexion.</li>
            <li>
              Définissez <code className="rounded bg-ink/5 px-1">DATABASE_URL</code> et{" "}
              <code className="rounded bg-ink/5 px-1">ENCRYPTION_SECRET</code> (générez-le avec{" "}
              <code className="rounded bg-ink/5 px-1">openssl rand -hex 32</code>) dans vos variables
              d&apos;environnement (Vercel → Settings → Environment Variables).
            </li>
            <li>
              Lancez <code className="rounded bg-ink/5 px-1">npm run db:migrate</code>, puis redéployez.
            </li>
          </ol>
        </div>
      )}

      {/* ── MODE TOKEN ADMIN API ─────────────────────────────────────────────── */}
      {mode === "token" && (
        <>
          {!compact && (
            <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
              Admin Shopify → Paramètres → Applications → <span className="font-medium">Développer des apps</span> →
              créez une app custom avec <code className="rounded bg-ink/5 px-1">read_products</code> et{" "}
              <code className="rounded bg-ink/5 px-1">read_orders</code>, installez-la, puis collez le token{" "}
              <code className="rounded bg-ink/5 px-1">shpat_…</code>. Aucune app publiée nécessaire.
            </p>
          )}

          <div className={cn("space-y-2", !manualAvailable && "pointer-events-none opacity-50")}>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Domaine Shopify
                </span>
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="ma-boutique.myshopify.com"
                  className={inputCls}
                />
                <span className="mt-0.5 block text-[10px] text-ink-soft">
                  L&apos;URL admin (admin.shopify.com/store/…) ou le nom seul fonctionnent aussi.
                </span>
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
                {result.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0" />
                )}
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
        </>
      )}

      {/* ── MODE DEV DASHBOARD (OAuth) ───────────────────────────────────────── */}
      {mode === "dev_dashboard" && (
        <>
          <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
            Dans le nouveau <span className="font-medium">Shopify Dev Dashboard</span> → votre app → onglet{" "}
            <span className="font-medium">API access / Configuration</span>, copiez le{" "}
            <span className="font-medium">Client ID</span> et le <span className="font-medium">Client Secret</span>,
            collez les valeurs ci-dessous dans Shopify (URL d&apos;app + URL de redirection + scopes), puis lancez
            l&apos;autorisation. Le secret est chiffré en base et n&apos;est jamais réaffiché.
          </p>

          {/* Valeurs à recopier dans Shopify Dev Dashboard */}
          <div className="inset-panel space-y-2 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              À copier dans Shopify Dev Dashboard
            </div>
            <CopyField label="URL de l'application" value={appUrl.replace(/\/$/, "")} />
            <CopyField label="URL de redirection (OAuth callback)" value={redirectUrl} />
            <CopyField label="Scopes requis" value={scopes.trim() || defaultScopes} />
          </div>

          <div className={cn("space-y-2", !manualAvailable && "pointer-events-none opacity-50")}>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                Domaine Shopify
              </span>
              <input
                value={ddDomain}
                onChange={(e) => setDdDomain(e.target.value)}
                placeholder="ma-boutique.myshopify.com"
                className={inputCls}
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Client ID
                </span>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="ex : 1a2b3c4d5e6f…"
                  autoComplete="off"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Client Secret {hasSavedSecret && <span className="font-normal normal-case text-ink-soft">(déjà enregistré)</span>}
                </span>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSavedSecret ? "•••••••• (laisser vide pour conserver)" : "shpss_…"}
                  autoComplete="off"
                  className={inputCls}
                />
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  Scopes
                </span>
                <input
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  placeholder={defaultScopes}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
                  URL de l&apos;application
                </span>
                <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className={inputCls} />
              </label>
            </div>
            <button
              onClick={connectDevDashboard}
              disabled={ddPending || !manualAvailable}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {ddPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Enregistrer & lancer l&apos;autorisation Shopify
            </button>
          </div>

          {ddError && (
            <div className="fade-up flex items-start gap-2 rounded-xl bg-critical-soft/70 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-critical">
              <XCircle size={14} className="mt-0.5 shrink-0" />
              {ddError}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Petit champ en lecture seule avec bouton « copier ». */
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible : sélection manuelle possible
    }
  };
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white/70 px-2 py-1.5 text-[11px] text-ink shadow-sm">
          {value}
        </code>
        <button
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink/10 bg-white/70 px-2 py-1.5 text-[11px] font-semibold shadow-sm hover:bg-white"
          title="Copier"
        >
          {copied ? <ClipboardCheck size={12} className="text-positive" /> : <Copy size={12} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
