import { AbandonmentTabs } from "@/components/domain/AbandonmentTabs";
import { getDataset } from "@/data/dataset";
import { computeAbandonments } from "@/lib/analytics";
import { parsePeriod } from "@/lib/funnel";

export default async function AbandonmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const dataset = getDataset();
  const stats = computeAbandonments(dataset, period);

  return <AbandonmentTabs stats={stats} />;
}
