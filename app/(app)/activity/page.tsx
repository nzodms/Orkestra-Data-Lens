import { ActivityFeed } from "@/components/cockpit/ActivityFeed";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { mode, data } = await getDeskContext();
  return <ActivityFeed activities={JSON.parse(JSON.stringify(data.activities ?? []))} mode={mode} />;
}
