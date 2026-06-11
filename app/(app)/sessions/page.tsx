import { SessionsExplorer } from "@/components/domain/SessionsExplorer";
import { LiveEmptyState } from "@/components/domain/LiveEmptyState";
import { getActiveDataset } from "@/lib/server/datasource";
import { parsePeriod, sessionsInPeriod } from "@/lib/funnel";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const { dataset, mode, status, liveEmpty } = await getActiveDataset();
  if (mode === "live" && liveEmpty) {
    return <LiveEmptyState pixelInstalled={status.pixelStatus === "installed"} />;
  }
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const productOptions = dataset.products.map((p) => ({ id: p.id, title: p.title }));

  return (
    <SessionsExplorer
      sessions={JSON.parse(JSON.stringify(sessions))}
      productOptions={productOptions}
    />
  );
}
