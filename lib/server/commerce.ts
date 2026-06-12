import "server-only";
import { query, queryOne } from "./db";

/**
 * Résumé commerce 100 % Shopify (commandes / remboursements / produits),
 * utilisé par le dashboard live tant que le pixel comportemental n'a pas
 * encore envoyé d'événements — aucune métrique comportementale inventée.
 */

export type CommerceSummary = {
  revenue30d: number;
  orders30d: number;
  revenue7d: number;
  orders7d: number;
  aov: number;
  refundsTotal: number;
  refundsCount: number;
  itemsSold: number;
  unfulfilled: number;
  lastOrder: { orderNumber: string; createdAt: string; totalPrice: number } | null;
  topProducts: { title: string; quantity: number; revenue: number }[];
  dailyRevenue: number[]; // 30 jours, du plus ancien au plus récent
};

export async function getCommerceSummary(shopId: string): Promise<CommerceSummary> {
  const totals = await queryOne<Record<string, string>>(
    `select
       coalesce(sum(total_price) filter (where created_at_shopify >= now() - interval '30 days'), 0) as revenue30,
       count(*) filter (where created_at_shopify >= now() - interval '30 days') as orders30,
       coalesce(sum(total_price) filter (where created_at_shopify >= now() - interval '7 days'), 0) as revenue7,
       count(*) filter (where created_at_shopify >= now() - interval '7 days') as orders7,
       count(*) filter (where created_at_shopify >= now() - interval '30 days'
         and coalesce(fulfillment_status, 'unfulfilled') not in ('fulfilled')) as unfulfilled
     from orders where shop_id = $1 and cancelled_at is null`,
    [shopId]
  );

  const refunds = await queryOne<Record<string, string>>(
    `select coalesce(sum(amount), 0) as total, count(*) as cnt
     from refunds where shop_id = $1 and (created_at_shopify is null or created_at_shopify >= now() - interval '30 days')`,
    [shopId]
  );

  const items = await queryOne<{ qty: string }>(
    `select coalesce(sum(li.quantity), 0) as qty
     from order_line_items li join orders o on o.id = li.order_id
     where li.shop_id = $1 and o.cancelled_at is null and o.created_at_shopify >= now() - interval '30 days'`,
    [shopId]
  );

  const lastOrder = await queryOne<{ order_number: string | null; created_at_shopify: string; total_price: string }>(
    `select order_number, created_at_shopify::text, total_price
     from orders where shop_id = $1 and cancelled_at is null
     order by created_at_shopify desc limit 1`,
    [shopId]
  );

  const top = await query<{ title: string | null; qty: string; revenue: string }>(
    `select li.title, sum(li.quantity) as qty, sum(li.price * li.quantity) as revenue
     from order_line_items li join orders o on o.id = li.order_id
     where li.shop_id = $1 and o.cancelled_at is null and o.created_at_shopify >= now() - interval '30 days'
     group by li.title order by revenue desc limit 5`,
    [shopId]
  );

  const daily = await query<{ day: string; revenue: string }>(
    `select date_trunc('day', created_at_shopify)::date::text as day, coalesce(sum(total_price), 0) as revenue
     from orders where shop_id = $1 and cancelled_at is null and created_at_shopify >= now() - interval '30 days'
     group by 1 order by 1`,
    [shopId]
  );
  const dailyMap = new Map(daily.map((d) => [d.day, Number(d.revenue)]));
  const dailyRevenue: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dailyRevenue.push(Math.round((dailyMap.get(key) ?? 0) * 100) / 100);
  }

  const orders30 = Number(totals?.orders30 ?? 0);
  const revenue30 = Number(totals?.revenue30 ?? 0);

  return {
    revenue30d: Math.round(revenue30 * 100) / 100,
    orders30d: orders30,
    revenue7d: Math.round(Number(totals?.revenue7 ?? 0) * 100) / 100,
    orders7d: Number(totals?.orders7 ?? 0),
    aov: orders30 > 0 ? Math.round((revenue30 / orders30) * 100) / 100 : 0,
    refundsTotal: Math.round(Number(refunds?.total ?? 0) * 100) / 100,
    refundsCount: Number(refunds?.cnt ?? 0),
    itemsSold: Number(items?.qty ?? 0),
    unfulfilled: Number(totals?.unfulfilled ?? 0),
    lastOrder: lastOrder
      ? {
          orderNumber: lastOrder.order_number ?? "#?",
          createdAt: new Date(lastOrder.created_at_shopify).toISOString(),
          totalPrice: Number(lastOrder.total_price),
        }
      : null,
    topProducts: top.map((t) => ({
      title: t.title ?? "Produit",
      quantity: Number(t.qty),
      revenue: Math.round(Number(t.revenue) * 100) / 100,
    })),
    dailyRevenue,
  };
}
