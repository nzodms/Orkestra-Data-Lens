import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/server/db";
import { shopifyIdToNumeric } from "@/lib/server/shopify";
import { handleShopifyWebhook } from "@/lib/server/webhooks";

type RefundPayload = {
  id: number | string;
  order_id?: number | string;
  created_at?: string;
  note?: string | null;
  transactions?: { amount?: string | number; currency?: string }[];
};

/** Webhook `refunds/create` — rattache le remboursement à la commande. */
export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req, async ({ shop, payload }) => {
    if (!shop) throw new Error("Boutique inconnue pour ce webhook");
    const refund = payload as RefundPayload;

    const order = refund.order_id
      ? await queryOne<{ id: string; currency: string }>(
          "select id, currency from orders where shop_id = $1 and shopify_order_id = $2",
          [shop.id, shopifyIdToNumeric(refund.order_id)]
        )
      : null;

    const amount = (refund.transactions ?? []).reduce((acc, t) => acc + Number(t.amount ?? 0), 0);
    await query(
      `insert into refunds (shop_id, order_id, shopify_refund_id, amount, currency, note, created_at_shopify, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7, now())
       on conflict (shop_id, shopify_refund_id) do update set
         amount = excluded.amount, note = excluded.note, updated_at = now()`,
      [
        shop.id,
        order?.id ?? null,
        shopifyIdToNumeric(refund.id),
        amount,
        refund.transactions?.[0]?.currency ?? order?.currency ?? "EUR",
        refund.note ?? null,
        refund.created_at ?? null,
      ]
    );

    if (order) {
      await query("update orders set financial_status = 'refunded', updated_at = now() where id = $1", [order.id]);
    }
  });
}
