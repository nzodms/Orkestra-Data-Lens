import Link from "next/link";
import { Radio, RefreshCw, Satellite } from "lucide-react";

/**
 * Empty state affiché en mode live quand la boutique est connectée mais
 * qu'aucune donnée tracking n'existe encore sur la période.
 */
export function LiveEmptyState({ pixelInstalled }: { pixelInstalled: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Satellite size={24} />
      </span>
      <h2 className="text-[16px] font-semibold tracking-tight">
        Boutique connectée, en attente des premières données
      </h2>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-soft">
        Aucune donnée tracking reçue pour cette période.{" "}
        {pixelInstalled
          ? "Le pixel est actif : les premières sessions apparaîtront ici dès les prochaines visites."
          : "Installez le pixel ou attendez les premières sessions."}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {!pixelInstalled && (
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            <Radio size={14} /> Installer le pixel
          </Link>
        )}
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white px-4 py-2 text-[12.5px] font-semibold shadow-sm transition-colors hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Vérifier la synchronisation
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Les commandes Shopify synchronisées restent visibles dans Paramètres, même sans tracking.
      </p>
    </div>
  );
}
