import { OrdersWorkspace } from "@/components/orderdesk/OrdersWorkspace";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { mode, data } = await getDeskContext();
  return <OrdersWorkspace data={JSON.parse(JSON.stringify(data))} mode={mode} />;
}
