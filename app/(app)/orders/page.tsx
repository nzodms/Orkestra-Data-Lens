import { OrdersWorkspace } from "@/components/orderdesk/OrdersWorkspace";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string; focus?: string }>;
}) {
  const params = await searchParams;
  const { mode, data } = await getDeskContext();
  return (
    <OrdersWorkspace
      data={JSON.parse(JSON.stringify(data))}
      mode={mode}
      initialFilters={{ q: params.q, status: params.status, view: params.view, focus: params.focus }}
    />
  );
}
