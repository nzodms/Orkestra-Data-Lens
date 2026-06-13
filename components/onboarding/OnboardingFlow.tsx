"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { ConnectShopify } from "@/components/settings/ConnectShopify";
import { cn } from "@/lib/utils";

const STEPS = ["Bienvenue", "Connecter Shopify", "Installer le tracking", "Synchronisation", "Première analyse"];

const PERMISSIONS = [
  "Lecture des produits et du catalogue",
  "Lecture des commandes et transactions",
  "Lecture des clients (emails masqués)",
  "Lecture des remboursements et stocks",
  "Lecture des checkouts (selon votre plan Shopify)",
  "Installation du Web Pixel de tracking",
];

const PROMISES = [
  { title: "Nous récupérons les ventes réelles via Shopify", text: "Les commandes Shopify restent la source de vérité : chaque chiffre de CA est confirmé, jamais estimé." },
  { title: "Nous trackons les événements boutique", text: "Chaque visite, vue produit, ajout panier et étape de checkout est horodatée à la seconde." },
  { title: "Nous réconcilions les parcours", text: "Sessions, paniers, checkouts et commandes sont rattachés entre eux, même sur plusieurs jours." },
  { title: "Nous affichons les incohérences au lieu de les cacher", text: "Un paiement sans ajout panier ? Vous saurez d'où il vient, au lieu de douter de vos chiffres." },
];

const SYNC_TASKS = [
  "Connexion à l'API Shopify Admin",
  "Import du catalogue produits",
  "Import des commandes (30 derniers jours)",
  "Import des clients et remboursements",
  "Reconstruction des parcours",
];

const ERROR_MESSAGES: Record<string, string> = {
  invalid_shop: "Domaine invalide. Format attendu : ma-boutique.myshopify.com",
  not_configured: "Base de données ou secret de chiffrement manquant côté serveur (DATABASE_URL, ENCRYPTION_SECRET).",
  oauth_app_missing:
    "Aucune app OAuth configurée. Renseignez le Client ID et le Client Secret de votre app Dev Dashboard ci-dessous.",
  invalid_hmac: "Signature Shopify invalide au retour d'autorisation. Réessayez la connexion.",
  invalid_state: "Session d'autorisation expirée ou invalide (protection anti-CSRF). Réessayez.",
  state_missing: "Aucun paramètre state renvoyé par Shopify. Relancez l'autorisation depuis le début.",
  state_db_absent: "State anti-CSRF introuvable en base. Relancez l'autorisation (ne réutilisez pas un ancien lien).",
  state_expired: "Autorisation expirée (plus de 10 minutes). Relancez « Enregistrer & lancer l'autorisation ».",
  state_used: "Ce lien d'autorisation a déjà été utilisé. Relancez l'autorisation depuis le début.",
  state_store_failed: "Impossible d'enregistrer le state OAuth (vérifiez la base et la migration oauth_states).",
  shop_mismatch: "La boutique du callback ne correspond pas à celle de la demande. Réessayez.",
  missing_code: "Shopify n'a pas renvoyé de code d'autorisation. Réessayez.",
  token_exchange_failed: "L'échange du code contre un token a échoué. Vérifiez la configuration de l'app Shopify.",
};

type SyncState =
  | { phase: "idle" }
  | { phase: "running"; taskIndex: number }
  | { phase: "done"; summary: string }
  | { phase: "error"; message: string };

export function OnboardingFlow({
  oauthConfigured,
  manualAvailable = false,
  missingEnv = [],
  initialStep,
  connectedShopDomain,
  errorCode,
  missingConfig,
  pixelInstalled,
  defaultAppUrl,
  defaultScopes,
}: {
  oauthConfigured: boolean;
  manualAvailable?: boolean;
  missingEnv?: string[];
  initialStep: number;
  connectedShopDomain?: string;
  errorCode?: string;
  missingConfig?: string;
  pixelInstalled: boolean;
  defaultAppUrl: string;
  defaultScopes: string;
}) {
  const router = useRouter();
  const live = Boolean(connectedShopDomain);
  const [step, setStep] = useState(initialStep);
  const [demoConnected, setDemoConnected] = useState(false);
  const [pixelAcknowledged, setPixelAcknowledged] = useState(pixelInstalled);
  const [sync, setSync] = useState<SyncState>({ phase: "idle" });
  const [syncAttempt, setSyncAttempt] = useState(0);
  const syncStarted = useRef(false);

  const connected = live || demoConnected;
  const error = errorCode ? (ERROR_MESSAGES[errorCode] ?? "Erreur inconnue lors de la connexion.") : null;

  // Synchronisation : réelle si la boutique est connectée, simulée sinon
  useEffect(() => {
    if (step !== 3 || syncStarted.current) return;
    syncStarted.current = true;

    let cancelled = false;
    let taskIndex = 0;
    setSync({ phase: "running", taskIndex: 0 });
    const ticker = setInterval(() => {
      taskIndex = Math.min(taskIndex + 1, SYNC_TASKS.length - 1);
      if (!cancelled) setSync((s) => (s.phase === "running" ? { phase: "running", taskIndex } : s));
    }, 900);

    const finish = (state: SyncState) => {
      clearInterval(ticker);
      if (!cancelled) setSync(state);
    };

    if (live) {
      fetch("/api/shopify/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rangeDays: 30 }),
      })
        .then(async (res) => {
          const data = (await res.json()) as {
            status?: string;
            products?: number;
            orders?: number;
            refunds?: number;
            errorMessage?: string;
            error?: string;
          };
          if (res.ok && data.status === "success") {
            finish({
              phase: "done",
              summary: `${data.products ?? 0} produits, ${data.orders ?? 0} commandes et ${data.refunds ?? 0} remboursements importés depuis Shopify.`,
            });
          } else {
            finish({ phase: "error", message: data.errorMessage ?? data.error ?? "La synchronisation a échoué." });
          }
        })
        .catch(() => finish({ phase: "error", message: "Impossible de joindre le serveur de synchronisation." }));
    } else {
      setTimeout(() => finish({ phase: "done", summary: "Données de démonstration prêtes (aucune boutique connectée)." }), 4200);
    }

    return () => {
      cancelled = true;
      clearInterval(ticker);
    };
  }, [step, live, syncAttempt]);

  const retrySync = () => {
    syncStarted.current = false;
    setSync({ phase: "idle" });
    setSyncAttempt((a) => a + 1);
  };

  const canNext =
    step === 0 ||
    (step === 1 && connected) ||
    (step === 2 && (pixelAcknowledged || live)) ||
    (step === 3 && sync.phase === "done") ||
    step === 4;

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-ai text-white shadow-sm">
              <Sparkles size={17} />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Orkestra Data Lens</div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-soft">
                La couche de vérité data pour Shopify
              </div>
            </div>
          </div>
          <Link href="/dashboard" className="text-[12px] font-medium text-ink-soft hover:text-ink">
            {live ? "Aller au dashboard →" : "Explorer la démo →"}
          </Link>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5">
              <div
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  i < step ? "bg-positive" : i === step ? "bg-brand" : "bg-gray-200"
                )}
              />
              <span
                className={cn(
                  "hidden text-[10px] font-medium sm:block",
                  i === step ? "text-brand-strong" : "text-ink-soft"
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="card fade-up flex-1 p-6 md:p-8" key={step}>
          {step === 0 && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Comprenez enfin ce qui se passe vraiment sur votre boutique.
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
                Plus clair que Shopify Analytics. Plus simple que GA4. Plus exploitable qu&apos;un dashboard BI.
                Connectez votre boutique, installez le tracking, et chaque visite, ajout panier, checkout et achat
                devient lisible — avec l&apos;heure exacte, la source, le produit et la vérification Shopify.
              </p>
              <div className="mt-5 space-y-3">
                {PROMISES.map((p, i) => (
                  <div key={i} className="fade-up flex gap-3" style={{ animationDelay: `${i * 90}ms` }}>
                    <ShieldCheck size={17} className="mt-0.5 shrink-0 text-positive" />
                    <div>
                      <div className="text-[13px] font-semibold">{p.title}</div>
                      <p className="text-[12px] leading-relaxed text-ink-soft">{p.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Connecter votre boutique Shopify</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Trois modes au choix : <span className="font-medium">token Admin API</span> (shpat_…),{" "}
                <span className="font-medium">app du nouveau Dev Dashboard</span> (Client ID + Client Secret), ou{" "}
                <span className="font-medium">OAuth officiel</span> par variables d&apos;environnement.
              </p>

              {error && (
                <div className="fade-up mt-4 flex items-start gap-2 rounded-xl bg-critical-soft px-3 py-2.5 text-[12.5px] font-medium text-critical">
                  <XCircle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    {error}
                    {errorCode === "not_configured" && missingConfig && (
                      <span className="mt-1 block font-normal">Manquant : {missingConfig}</span>
                    )}
                  </span>
                </div>
              )}

              {live && (
                <div className="fade-up mt-3 flex items-center gap-2 rounded-xl bg-positive-soft px-3 py-2.5 text-[12.5px] font-medium text-positive">
                  <CheckCircle2 size={15} />
                  Boutique « {connectedShopDomain} » connectée. Token chiffré, données live actives.
                </div>
              )}

              {/* Connexion boutique — 3 modes (token, Dev Dashboard, OAuth env) */}
              {!live && (
                <div className="mt-5">
                  <ConnectShopify
                    oauthConfigured={oauthConfigured}
                    manualAvailable={manualAvailable}
                    missingConfig={missingEnv}
                    defaultAppUrl={defaultAppUrl}
                    defaultScopes={defaultScopes}
                    compact
                  />
                </div>
              )}

              {/* Mode démo : choix explicite, plus de « connexion simulée » */}
              {!live && !demoConnected && (
                <button
                  onClick={() => setDemoConnected(true)}
                  className="mt-4 text-[12px] font-medium text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                >
                  Continuer en mode démo sans connecter de boutique →
                </button>
              )}
              {demoConnected && !live && (
                <div className="fade-up mt-3 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12.5px] font-medium text-warn">
                  <CheckCircle2 size={15} />
                  Mode démo choisi — aucune boutique connectée, toutes les données affichées sont simulées.
                </div>
              )}

              <div className="mt-5 rounded-xl border border-gray-200/70 bg-gray-50/70 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold">
                  <Lock size={13} className="text-ink-soft" /> Permissions demandées
                </div>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {PERMISSIONS.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-soft">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-positive" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Installer le tracking</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Le Web Pixel Orkestra (extension <code className="rounded bg-gray-100 px-1 text-[11.5px]">extensions/orkestra-pixel</code>)
                capte chaque événement boutique avec horodatage à la seconde et l&apos;envoie à{" "}
                <code className="rounded bg-gray-100 px-1 text-[11.5px]">/api/tracking/event</code>, où il est validé,
                dédupliqué puis réconcilié avec vos commandes Shopify.
              </p>
              <div className="mt-5 rounded-xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-gray-200">
                <div className="text-gray-400"># Déploiement via Shopify CLI</div>
                <div>shopify app deploy</div>
                <div className="mt-2 text-gray-400"># Puis activation du pixel (scope write_pixels)</div>
                <div>
                  webPixelCreate(settings: {"{"} endpoint: <span className="text-amber-300">&quot;…/api/tracking/event&quot;</span> {"}"})
                </div>
              </div>
              {live ? (
                pixelInstalled ? (
                  <div className="fade-up mt-4 flex items-center gap-2 rounded-xl bg-positive-soft px-3 py-2.5 text-[12.5px] font-medium text-positive">
                    <CheckCircle2 size={15} />
                    Pixel actif — des événements ont déjà été reçus pour cette boutique.
                  </div>
                ) : (
                  <div className="fade-up mt-4 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12.5px] font-medium text-warn">
                    <Radio size={15} />
                    Pixel non installé pour l&apos;instant. Vous pouvez continuer : le statut passera à « actif » dès le
                    premier événement reçu.
                  </div>
                )
              ) : (
                <button
                  onClick={() => setPixelAcknowledged(true)}
                  disabled={pixelAcknowledged}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
                >
                  <Radio size={15} />
                  {pixelAcknowledged ? "Pixel simulé (démo)" : "Simuler l'installation du pixel"}
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Synchronisation initiale</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                {live
                  ? "Import réel de vos données Shopify : produits, variantes, commandes (30 derniers jours), lignes de commande et remboursements."
                  : "Simulation de l'import (mode démo) : produits, commandes et parcours des 30 derniers jours."}
              </p>
              <div className="mt-5 space-y-2.5">
                {SYNC_TASKS.map((task, i) => {
                  const running = sync.phase === "running";
                  const done = sync.phase === "done" || (running && (sync as { taskIndex: number }).taskIndex > i);
                  const active = running && (sync as { taskIndex: number }).taskIndex === i;
                  return (
                    <div
                      key={task}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] font-medium transition-all",
                        done
                          ? "border-positive/20 bg-positive-soft/50 text-positive"
                          : active
                            ? "border-brand/25 bg-brand-soft/50 text-brand-strong"
                            : "border-gray-200/70 bg-gray-50/50 text-ink-soft"
                      )}
                    >
                      {done ? <CheckCircle2 size={15} /> : active ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} className="opacity-40" />}
                      {task}
                    </div>
                  );
                })}
              </div>
              {sync.phase === "done" && (
                <div className="fade-up mt-4 flex items-center gap-2 rounded-xl bg-positive-soft px-3 py-2.5 text-[12.5px] font-medium text-positive">
                  <CheckCircle2 size={15} /> {sync.summary}
                </div>
              )}
              {sync.phase === "error" && (
                <div className="fade-up mt-4 space-y-2">
                  <div className="flex items-start gap-2 rounded-xl bg-critical-soft px-3 py-2.5 text-[12.5px] font-medium text-critical">
                    <XCircle size={15} className="mt-0.5 shrink-0" /> {sync.message}
                  </div>
                  <button
                    onClick={retrySync}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-[12.5px] font-semibold shadow-sm hover:bg-gray-50"
                  >
                    <RefreshCw size={14} /> Réessayer
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-positive-soft text-positive">
                <CheckCircle2 size={26} />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">
                {live ? "Votre boutique est branchée" : "Votre première analyse est prête"}
              </h1>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
                {live
                  ? "Les commandes Shopify sont synchronisées. Les parcours visiteurs apparaîtront dès les premiers événements pixel. En attendant, le détail de la connexion est visible dans Paramètres."
                  : "155 sessions reconstruites aujourd'hui, 1 commande confirmée Shopify, 4 paiements hors cohorte identifiés et expliqués. Découvrez la vérité du tunnel."}
              </p>
              <button
                onClick={() => router.push(live ? "/settings" : "/truth-funnel")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                {live ? "Voir l'état de la connexion" : "Voir la vérité du tunnel"} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft transition-colors hover:text-ink",
              step === 0 && "invisible"
            )}
          >
            <ArrowLeft size={14} /> Retour
          </button>
          {live ? (
            <span className="rounded-full border border-positive/20 bg-positive-soft px-2.5 py-1 text-[10.5px] font-semibold text-positive">
              Boutique connectée — données live
            </span>
          ) : (
            <span className="rounded-full border border-warn/20 bg-warn-soft px-2.5 py-1 text-[10.5px] font-semibold text-warn">
              Mode démo — aucune donnée réelle
            </span>
          )}
          {step < 4 ? (
            <button
              onClick={() => setStep((s) => Math.min(4, s + 1))}
              disabled={!canNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-40"
            >
              Continuer <ArrowRight size={14} />
            </button>
          ) : (
            <span className="w-20" />
          )}
        </div>
      </div>
    </div>
  );
}
