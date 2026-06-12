import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar, { type SearchItem, type TopbarStatus } from "@/components/layout/Topbar";
import BottomNav from "@/components/layout/BottomNav";
import { Toaster } from "@/components/ui/Toaster";
import { getActiveDataset } from "@/lib/server/datasource";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ dataset, mode, status }, { data: desk }] = await Promise.all([getActiveDataset(), getDeskContext()]);

  let lastDataLabel: string | null = null;
  if (mode === "live" && status.lastEventAt) {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(status.lastEventAt).getTime()) / 60000));
    lastDataLabel =
      minutes < 1
        ? "Dernière donnée à l'instant"
        : minutes < 60
          ? `Dernière donnée il y a ${minutes} min`
          : `Dernière donnée il y a ${Math.round(minutes / 60)} h`;
  }

  const topbarStatus: TopbarStatus = {
    mode,
    syncRunning: status.syncRunning ?? false,
    pixelInstalled: status.pixelStatus === "installed",
    lastDataLabel,
  };

  // Index de recherche globale : commandes, produits, fournisseurs, clients anonymisés
  const searchIndex: SearchItem[] = [
    ...desk.orders.slice(0, 150).map((o) => ({
      label: o.orderNumber,
      sub: `${o.lineItems[0]?.title ?? "Commande"} · ${o.customerMasked ?? ""}`,
      type: "Commande",
      href: `/orders?q=${encodeURIComponent(o.orderNumber)}`,
    })),
    ...desk.suppliers.map((s) => ({
      label: s.name,
      sub: `${s.country ?? ""} · fiabilité ${s.reliabilityScore}/100`,
      type: "Fournisseur",
      href: "/suppliers",
    })),
    ...dataset.products.map((p) => ({
      label: p.title,
      sub: p.productType ?? "Produit",
      type: "Produit",
      href: "/products",
    })),
  ];

  return (
    <div className="min-h-screen">
      <Suspense>
        <Sidebar anomalyCount={dataset.anomalies.length} shopName={dataset.shop.name} shopDomain={dataset.shop.shopifyDomain} mode={mode} />
      </Suspense>
      <div className="md:pl-[252px]">
        <Suspense>
          <Topbar status={topbarStatus} searchIndex={searchIndex} />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-14">{children}</main>
      </div>
      <Suspense>
        <BottomNav anomalyCount={dataset.anomalies.length} />
      </Suspense>
      <Toaster />
    </div>
  );
}
