"use client";

import { useEffect, useState } from "react";
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
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Bienvenue", "Connecter Shopify", "Installer le tracking", "Synchronisation", "Première analyse"];

const PERMISSIONS = [
  "Lecture des produits et du catalogue",
  "Lecture des commandes et transactions",
  "Lecture des clients (anonymisés)",
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
  "Activation du Web Pixel",
  "Reconstruction des parcours",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [shopUrl, setShopUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [pixelInstalled, setPixelInstalled] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  // TODO(prod) : remplacer la simulation par une redirection OAuth réelle
  // vers /api/shopify/auth?shop=<domaine>, puis attendre le callback.
  const connect = () => {
    if (!shopUrl.trim()) return;
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
    }, 1600);
  };

  // Simulation de synchronisation initiale (mode démo)
  useEffect(() => {
    if (step !== 3) return;
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress((p) => {
        if (p >= SYNC_TASKS.length) {
          clearInterval(interval);
          return p;
        }
        return p + 1;
      });
    }, 700);
    return () => clearInterval(interval);
  }, [step]);

  const canNext =
    step === 0 || (step === 1 && connected) || (step === 2 && pixelInstalled) || (step === 3 && syncProgress >= SYNC_TASKS.length) || step === 4;

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
            Explorer la démo →
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
                Saisissez l&apos;URL de votre boutique. Vous serez redirigé vers Shopify pour autoriser l&apos;accès —
                nous ne voyons jamais votre mot de passe.
              </p>
              <div className="mt-5 flex gap-2">
                <input
                  value={shopUrl}
                  onChange={(e) => setShopUrl(e.target.value)}
                  placeholder="ma-boutique.myshopify.com"
                  disabled={connected}
                  className="flex-1 rounded-xl border border-gray-200/80 bg-white px-3.5 py-2.5 text-[13px] shadow-sm outline-none focus:border-brand/50 disabled:bg-gray-50"
                />
                <button
                  onClick={connect}
                  disabled={connecting || connected || !shopUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
                >
                  {connecting ? <Loader2 size={15} className="animate-spin" /> : <Store size={15} />}
                  {connected ? "Connectée" : "Connecter ma boutique"}
                </button>
              </div>
              {connected && (
                <div className="fade-up mt-3 flex items-center gap-2 rounded-xl bg-positive-soft px-3 py-2.5 text-[12.5px] font-medium text-positive">
                  <CheckCircle2 size={15} />
                  Boutique « {shopUrl} » connectée en mode démo — l&apos;OAuth réel sera utilisé en production.
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
                Le Web Pixel Orkestra capte chaque événement boutique (vues produit, paniers, checkout) avec
                horodatage à la seconde, puis l&apos;envoie à{" "}
                <code className="rounded bg-gray-100 px-1 text-[11.5px]">/api/tracking/event</code> où il est
                réconcilié avec vos commandes Shopify.
              </p>
              <div className="mt-5 rounded-xl bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-gray-200">
                <div className="text-gray-400">{"// Installé automatiquement via l'API Web Pixels"}</div>
                <div>
                  analytics.subscribe(<span className="text-amber-300">&quot;all_events&quot;</span>, (event) =&gt;{" "}
                  {"{"}
                </div>
                <div className="pl-4">
                  fetch(<span className="text-amber-300">&quot;https://app.orkestra.io/api/tracking/event&quot;</span>
                  , {"{"} method: <span className="text-amber-300">&quot;POST&quot;</span>, body: JSON.stringify(event){" "}
                  {"}"})
                </div>
                <div>{"})"}</div>
              </div>
              <button
                onClick={() => setPixelInstalled(true)}
                disabled={pixelInstalled}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
              >
                <Radio size={15} />
                {pixelInstalled ? "Pixel installé (démo)" : "Installer le pixel"}
              </button>
              {pixelInstalled && (
                <div className="fade-up mt-3 flex items-center gap-2 rounded-xl bg-positive-soft px-3 py-2.5 text-[12.5px] font-medium text-positive">
                  <CheckCircle2 size={15} />
                  Pixel actif — les événements de démonstration sont maintenant disponibles.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Synchronisation initiale</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                Nous importons vos données Shopify et reconstruisons les parcours des 30 derniers jours.
              </p>
              <div className="mt-5 space-y-2.5">
                {SYNC_TASKS.map((task, i) => {
                  const done = syncProgress > i;
                  const active = syncProgress === i;
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
                      {done ? (
                        <CheckCircle2 size={15} />
                      ) : active ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <RefreshCw size={15} className="opacity-40" />
                      )}
                      {task}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex h-full flex-col items-center justify-center py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-positive-soft text-positive">
                <CheckCircle2 size={26} />
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight">Votre première analyse est prête</h1>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
                155 sessions reconstruites aujourd&apos;hui, 1 commande confirmée Shopify, 4 paiements hors cohorte
                identifiés et expliqués. Découvrez la vérité du tunnel.
              </p>
              <button
                onClick={() => router.push("/truth-funnel")}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
              >
                Voir la vérité du tunnel <ArrowRight size={15} />
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
          <span className="rounded-full border border-warn/20 bg-warn-soft px-2.5 py-1 text-[10.5px] font-semibold text-warn">
            Mode démo — aucune donnée réelle
          </span>
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
