import { SessionsExplorer } from "@/components/domain/SessionsExplorer";
import { getDataset } from "@/data/dataset";
import { parsePeriod, sessionsInPeriod } from "@/lib/funnel";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const dataset = getDataset();
  const sessions = sessionsInPeriod(dataset.sessions, period);
  const productOptions = dataset.products.map((p) => ({ id: p.id, title: p.title }));

  return (
    <SessionsExplorer
      sessions={JSON.parse(JSON.stringify(sessions))}
      productOptions={productOptions}
    />
  );
}
