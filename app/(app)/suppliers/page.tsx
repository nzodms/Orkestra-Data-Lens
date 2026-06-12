import { SuppliersWorkspace } from "@/components/orderdesk/SuppliersWorkspace";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const { mode, data } = await getDeskContext();
  return <SuppliersWorkspace data={JSON.parse(JSON.stringify(data))} mode={mode} />;
}
