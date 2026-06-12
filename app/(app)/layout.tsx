import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar, { type TopbarStatus } from "@/components/layout/Topbar";
import BottomNav from "@/components/layout/BottomNav";
import { getActiveDataset } from "@/lib/server/datasource";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { dataset, mode, status } = await getActiveDataset();

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

  return (
    <div className="min-h-screen">
      <Suspense>
        <Sidebar
          anomalyCount={dataset.anomalies.length}
          shopName={dataset.shop.name}
          shopDomain={dataset.shop.shopifyDomain}
          mode={mode}
        />
      </Suspense>
      <div className="md:pl-[252px]">
        <Suspense>
          <Topbar status={topbarStatus} />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-14">{children}</main>
      </div>
      <Suspense>
        <BottomNav anomalyCount={dataset.anomalies.length} />
      </Suspense>
    </div>
  );
}
