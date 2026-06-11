import { Suspense } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import BottomNav from "@/components/layout/BottomNav";
import { getDataset } from "@/data/dataset";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { anomalies, shop } = getDataset();

  return (
    <div className="min-h-screen">
      <Suspense>
        <Sidebar anomalyCount={anomalies.length} shopName={shop.name} shopDomain={shop.shopifyDomain} />
      </Suspense>
      <div className="md:pl-60">
        <Suspense>
          <Topbar />
        </Suspense>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pb-14">{children}</main>
      </div>
      <Suspense>
        <BottomNav anomalyCount={anomalies.length} />
      </Suspense>
    </div>
  );
}
