import { AbandonmentTabs } from "@/components/domain/AbandonmentTabs";
import { LiveEmptyState } from "@/components/domain/LiveEmptyState";
import { getActiveDataset } from "@/lib/server/datasource";
import { computeAbandonments } from "@/lib/analytics";
import { parsePeriod } from "@/lib/funnel";

export default async function AbandonmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const { dataset, mode, status, liveEmpty } = await getActiveDataset();
  if (mode === "live" && liveEmpty) {
    return <LiveEmptyState pixelInstalled={status.pixelStatus === "installed"} />;
  }
  const stats = computeAbandonments(dataset, period);

  return <AbandonmentTabs stats={stats} />;
}
