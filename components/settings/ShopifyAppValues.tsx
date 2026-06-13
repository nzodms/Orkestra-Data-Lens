"use client";

import { useState } from "react";
import { ClipboardCheck, Copy } from "lucide-react";

/**
 * Valeurs à recopier dans le Shopify Dev Dashboard (URL d'app, URL de
 * redirection OAuth, scopes requis). Toujours visibles dans les Paramètres,
 * même une fois la boutique connectée, pour reconfigurer l'app si besoin.
 */
export function ShopifyAppValues({ appUrl, scopes }: { appUrl: string; scopes: string }) {
  const base = appUrl.replace(/\/$/, "");
  return (
    <div className="space-y-2">
      <CopyField label="URL de l'application" value={base} />
      <CopyField label="URL de redirection (OAuth callback)" value={`${base}/api/shopify/callback`} />
      <CopyField label="Scopes requis" value={scopes} />
    </div>
  );
}

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
