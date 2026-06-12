import { MessagesWorkspace } from "@/components/orderdesk/MessagesWorkspace";
import { getDeskContext } from "@/lib/server/orderdesk";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { mode, data } = await getDeskContext();
  return <MessagesWorkspace data={JSON.parse(JSON.stringify(data))} mode={mode} />;
}
