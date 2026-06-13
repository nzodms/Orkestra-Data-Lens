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
  TriangleAlert,
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

type ConnectMode = "token" | "dev_dashboard" | "oauth_env";

/**
 * Connexion boutique Shopify — TROIS modes explicites, toujours visibles :
 *  1. « token »         — token Admin API legacy (shpat_…), test immédiat ;
 *  2. « dev_dashboard » — app du nouveau Dev Dashboard via Client ID + Client
 *     Secret saisis dans l'UI (base + chiffrement + /api/shopify/oauth-config),
 *     SANS dépendre de SHOPIFY_API_KEY/SECRET ;
 *  3. « oauth_env »     — OAuth officiel d'une app publique configurée par
 *     variables d'environnement (peut rester désactivé si elles manquent).
 *
 * La validation `shpat_` ne concerne QUE le mode 1. Le formulaire Dev Dashboard
 * reste TOUJOURS affiché : si la base/le chiffrement/la table manquent, on
 * affiche une erreur claire sans masquer le formulaire.
 */
export function ConnectShopify({
  oauthConfigured,
  manualAvailable,
  missingConfig = [],
  compact = false,
  defaultAppUrl = "",
  defaultScopes,
}: {
  oauthConfigured: boolean;
  manualAvailable: boolean;
  missingConfig?: string[];
  compact?: boolean;
  defaultAppUrl?: string;
  defaultScopes: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ConnectMode>("dev_dashboard");

  // ── Mode 1 — token Admin API ────────────────────────────────────────────────
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [apiVersion, setApiVersion] = useState("2025-01");
  const [pending, setPending] = useState<"test" | "connect" | null>(null);
  const [result, setResult] = useState<TestResult | null>(null);

  // ── Mode 2 — Dev Dashboard (OAuth via Client ID/Secret) ─────────────────────
  const [ddDomain, setDdDomain] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [scopes, setScopes] = useState(defaultScopes);
  const [appUrl, setAppUrl] = useState(defaultAppUrl);
  const [hasSavedSecret, setHasSavedSecret] = useState(false);
  const [ddPending, setDdPending] = useState(false);
  const [ddError, setDdError] = useState<string | null>(null);
  const [oauthTableMissing, setOauthTableMissing] = useState(false);

  // ── Mode 3 — OAuth officiel (variables d'environnement) ─────────────────────
  const [envDomain, setEnvDomain] = useState("");

  const redirectUrl = `${(appUrl || "").replace(/\/$/, "")}/api/shopify/callback`;

  // URL d'app : origine réelle de la page (ou NEXT_PUBLIC_APP_URL) — jamais codée en dur.
  useEffect(() => {
    setAppUrl((prev) => prev || getClientAppUrl());
  }, []);

  // Pré-remplissage si une config Dev Dashboard a déjà été enregistrée.
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
  }, [manualAvailable, defaultScopes]);

  // Détection proactive de la table OAuth manquante (n'empêche jamais l'affichage du formulaire).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/diagnostic", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { oauthTablePresent?: boolean; dbConnected?: boolean }) => {
        if (cancelled) return;
        if (d.dbConnected && d.oauthTablePresent === false) setOauthTableMissing(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
          // Champ vide + secret déjà enregistré → on conserve le secret existant.
          clientSecret: clientSecret.trim() || undefined,
          scopes: scopes.trim() || defaultScopes,
          appUrl: (appUrl || getClientAppUrl()).trim(),
          shop: ddDomain.trim(),
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; authorizeUrl?: string | null };
      if (!res.ok || !data.ok) {
        setDdError(data.error ?? "Échec de l'enregistrement de la configuration.");
        return;
      }
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl; // redirection vers Shopify (OAuth)
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

  const TABS: { id: ConnectMode; label: string; icon: typeof KeyRound }[] = [
    { id: "token", label: "Token Admin API", icon: KeyRound },
    { id: "dev_dashboard", label: "App Dev Dashboard", icon: Rocket },
    { id: "oauth_env", label: "OAuth officiel (env)", icon: Plug },
  ];

  return (
    <div className="space-y-3">
      {/* Sélecteur de mode — 3 modes toujours visibles */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-ink/[0.04] p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] font-semibold transition-colors",
                mode === t.id ? "bg-white text-ink shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              <Icon size={13} /> <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MODE 1 — TOKEN ADMIN API ─────────────────────────────────────────── */}
      {mode === "token" && (
        <>
          {!compact && (
            <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
              Admin Shopify → Paramètres → Applications → <span className="font-medium">Développer des apps</span> →
              app custom avec <code className="rounded bg-ink/5 px-1">read_products</code> et{" "}
              <code className="rounded bg-ink/5 px-1">read_orders</code>, installez-la, puis collez le token{" "}
              <code className="rounded bg-ink/5 px-1">shpat_…</code>.
            </p>
          )}
          {!manualAvailable && <ServerConfigBanner missingConfig={missingConfig} />}
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_120px]">
              <Field label="Domaine Shopify">
                <input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="ma-boutique.myshopify.com"
                  className={inputCls}
                />
              </Field>
              <Field label="Admin API access token">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="shpat_…"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
              <Field label="Version API">
                <select value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className={inputCls}>
                  <option value="2025-01">2025-01</option>
                  <option value="2024-10">2024-10</option>
                  <option value="2024-07">2024-07</option>
                </select>
              </Field>
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
            </div>
          )}
        </>
      )}

      {/* ── MODE 2 — APP DEV DASHBOARD ───────────────────────────────────────── */}
      {mode === "dev_dashboard" && (
        <>
          {!compact && (
            <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
              Nouveau <span className="font-medium">Shopify Dev Dashboard</span> → votre app →{" "}
              <span className="font-medium">Configuration / API access</span> : copiez le{" "}
              <span className="font-medium">Client ID</span> et le <span className="font-medium">Client Secret</span>,
              collez ci-dessous, puis « Enregistrer & lancer l&apos;autorisation Shopify ». Aucune variable
              SHOPIFY_API_KEY/SECRET nécessaire : le secret est chiffré en base.
            </p>
          )}

          {/* Banniéres d'erreur — n'effacent jamais le formulaire */}
          {!manualAvailable && <ServerConfigBanner missingConfig={missingConfig} />}
          {oauthTableMissing && (
            <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft/60 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                Migration manquante : table shopify_oauth_config absente. Appliquez les migrations via le bloc
                « Diagnostic serveur » ci-dessus, puis réessayez.
              </span>
            </div>
          )}

          {/* Valeurs à recopier dans Shopify Dev Dashboard */}
          <div className="inset-panel space-y-2 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              À copier dans Shopify Dev Dashboard
            </div>
            <CopyField label="URL de l'application" value={(appUrl || "").replace(/\/$/, "")} />
            <CopyField label="URL de redirection (OAuth callback)" value={redirectUrl} />
            <CopyField label="Scopes requis" value={scopes.trim() || defaultScopes} />
          </div>

          <div className="space-y-2">
            <Field label="Domaine Shopify">
              <input
                value={ddDomain}
                onChange={(e) => setDdDomain(e.target.value)}
                placeholder="ma-boutique.myshopify.com"
                className={inputCls}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Client ID">
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="ex : 1a2b3c4d5e6f…"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
              <Field
                label={`Client Secret${hasSavedSecret ? " (déjà enregistré)" : ""}`}
              >
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSavedSecret ? "•••••••• (laisser vide pour conserver)" : "shpss_…"}
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Scopes">
                <input
                  value={scopes}
                  onChange={(e) => setScopes(e.target.value)}
                  placeholder={defaultScopes}
                  className={inputCls}
                />
              </Field>
              <Field label="URL de l'application">
                <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <button
              onClick={connectDevDashboard}
              disabled={ddPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            >
              {ddPending ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              Enregistrer &amp; lancer l&apos;autorisation Shopify
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

      {/* ── MODE 3 — OAUTH OFFICIEL (VARIABLES D'ENVIRONNEMENT) ──────────────── */}
      {mode === "oauth_env" && (
        <>
          <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
            App publique Shopify configurée par variables d&apos;environnement
            (<code className="rounded bg-ink/5 px-1">SHOPIFY_API_KEY</code>,{" "}
            <code className="rounded bg-ink/5 px-1">SHOPIFY_API_SECRET</code>,{" "}
            <code className="rounded bg-ink/5 px-1">SHOPIFY_APP_URL</code>). Mode distinct du Dev Dashboard.
          </p>
          {!oauthConfigured && (
            <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft/60 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                Désactivé : variables SHOPIFY_API_KEY / SHOPIFY_API_SECRET / SHOPIFY_APP_URL non configurées. Utilisez
                plutôt « App Dev Dashboard » (Client ID + Client Secret dans l&apos;interface).
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={envDomain}
              onChange={(e) => setEnvDomain(e.target.value)}
              placeholder="ma-boutique.myshopify.com"
              disabled={!oauthConfigured}
              className={cn(inputCls, "flex-1", !oauthConfigured && "opacity-60")}
            />
            <button
              onClick={() =>
                envDomain.trim() &&
                (window.location.href = `/api/shopify/auth?shop=${encodeURIComponent(envDomain.trim())}`)
              }
              disabled={!oauthConfigured || !envDomain.trim()}
              className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50"
            >
              Lancer l&apos;OAuth
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function ServerConfigBanner({ missingConfig }: { missingConfig: string[] }) {
  return (
    <div className="rounded-xl border border-critical/25 bg-critical-soft/50 p-3">
      <div className="text-[12px] font-semibold text-critical">
        Base / chiffrement requis pour ce mode (le formulaire reste utilisable, l&apos;enregistrement échouera tant que
        ce n&apos;est pas configuré).
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(missingConfig.length > 0 ? missingConfig : ["DATABASE_URL", "ENCRYPTION_SECRET"]).map((v) => (
          <Badge key={v} tone="red">
            {v}
          </Badge>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
        Ajoutez ces variables dans Vercel (Settings → Environment Variables), puis appliquez les migrations via le bloc
        « Diagnostic serveur ».
      </p>
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
