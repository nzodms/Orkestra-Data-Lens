import "server-only";
import { cache } from "react";
import { applyDemoDeskAction, getDemoDeskData } from "@/data/orderdeskDemo";
import type { DeskAction } from "@/lib/orderdesk/actions";
import type {
  DeskData,
  DeskOrder,
  InternalNote,
  OpsStatus,
  Supplier,
  SupplierMessage,
  SupplierOffer,
  SupplierQuote,
  SupplierTag,
} from "@/lib/orderdesk/types";
import { query, queryOne } from "./db";
import { getAppStatus, type AppMode } from "./datasource";
import { getConnectedShop } from "./repo";

/**
 * Order Desk — façade serveur.
 * Mode démo : store mémoire réaliste (data/orderdeskDemo).
 * Mode live : tables PostgreSQL (migration 0003), commandes Shopify réelles.
 */

export type DeskContext = { mode: AppMode; data: DeskData };

export const getDeskContext = cache(async (): Promise<DeskContext> => {
  const status = await getAppStatus();
  if (status.mode === "demo") {
    return { mode: "demo", data: getDemoDeskData() };
  }
  try {
    const shop = await getConnectedShop();
    if (!shop) return { mode: "demo", data: getDemoDeskData() };
    return { mode: "live", data: await buildLiveDeskData(shop.id) };
  } catch (err) {
    console.error("[orderdesk] Lecture live impossible :", err instanceof Error ? err.message : err);
    return { mode: "demo", data: getDemoDeskData() };
  }
});

// ─── Lecture live ─────────────────────────────────────────────────────────────

async function buildLiveDeskData(shopId: string): Promise<DeskData> {
  const orderRows = await query<{
    id: string;
    order_number: string | null;
    created_at_shopify: string;
    total_price: string;
    currency: string;
    financial_status: string | null;
    fulfillment_status: string | null;
    country: string | null;
    email_masked: string | null;
    ops_status: OpsStatus | null;
    supplier_id: string | null;
    supplier_cost: string | null;
    tracking_number: string | null;
    tracking_carrier: string | null;
    problem_note: string | null;
  }>(
    `select o.id, o.order_number, o.created_at_shopify::text, o.total_price, o.currency,
            o.financial_status, o.fulfillment_status, o.country,
            c.email_masked,
            st.ops_status, st.supplier_id, st.supplier_cost, st.tracking_number, st.tracking_carrier, st.problem_note
     from orders o
     left join customers c on c.id = o.customer_id
     left join order_supplier_statuses st on st.order_id = o.id
     where o.shop_id = $1 and o.created_at_shopify >= now() - interval '30 days'
       and o.cancelled_at is null
     order by o.created_at_shopify desc`,
    [shopId]
  );

  const lineRows = await query<{
    order_id: string;
    title: string | null;
    quantity: number;
    price: string;
    shopify_product_id: string | null;
  }>(
    `select li.order_id, li.title, li.quantity, li.price, li.shopify_product_id
     from order_line_items li
     join orders o on o.id = li.order_id
     where li.shop_id = $1 and o.created_at_shopify >= now() - interval '30 days'`,
    [shopId]
  );
  const linesByOrder = new Map<string, typeof lineRows>();
  for (const l of lineRows) {
    const list = linesByOrder.get(l.order_id) ?? [];
    list.push(l);
    linesByOrder.set(l.order_id, list);
  }

  const orders: DeskOrder[] = orderRows.map((o) => ({
    id: o.id,
    orderNumber: o.order_number ?? "#?",
    createdAt: new Date(o.created_at_shopify).toISOString(),
    customerMasked: o.email_masked ?? undefined,
    country: o.country ?? undefined,
    totalPrice: Number(o.total_price),
    currency: o.currency,
    financialStatus: o.financial_status ?? "pending",
    fulfillmentStatus: o.fulfillment_status ?? undefined,
    lineItems: (linesByOrder.get(o.id) ?? []).map((l) => ({
      title: l.title ?? "Produit",
      quantity: l.quantity,
      price: Number(l.price),
      productId: l.shopify_product_id ?? undefined,
    })),
    opsStatus: o.ops_status ?? "todo",
    supplierId: o.supplier_id ?? undefined,
    supplierCost: o.supplier_cost != null ? Number(o.supplier_cost) : undefined,
    trackingNumber: o.tracking_number ?? undefined,
    trackingCarrier: o.tracking_carrier ?? undefined,
    problemNote: o.problem_note ?? undefined,
  }));

  const supplierRows = await query<{
    id: string; name: string; whatsapp: string | null; email: string | null; website: string | null;
    country: string | null; currency: string; avg_lead_time_days: number | null;
    reliability_score: number; orders_count: number; problem_rate: string;
    last_contact_at: string | null; notes: string | null; tags: string[];
  }>(`select * from suppliers where shop_id = $1 order by name`, [shopId]);

  const suppliers: Supplier[] = supplierRows.map((s) => ({
    id: s.id,
    name: s.name,
    whatsapp: s.whatsapp ?? undefined,
    email: s.email ?? undefined,
    website: s.website ?? undefined,
    country: s.country ?? undefined,
    currency: s.currency,
    avgLeadTimeDays: s.avg_lead_time_days ?? undefined,
    reliabilityScore: s.reliability_score,
    ordersCount: s.orders_count,
    problemRate: Number(s.problem_rate),
    lastContactAt: s.last_contact_at ? new Date(s.last_contact_at).toISOString() : undefined,
    notes: s.notes ?? undefined,
    tags: (s.tags ?? []) as SupplierTag[],
  }));

  const offerRows = await query<{
    id: string; supplier_id: string; shopify_product_id: string; product_price: string;
    shipping_price: string; lead_time_days: number | null; moq: number; stock: number | null;
    product_url: string | null; note: string | null; preferred: boolean; title: string | null;
  }>(
    `select ps.*, p.title
     from product_suppliers ps
     left join products p on p.shop_id = ps.shop_id and p.shopify_product_id = ps.shopify_product_id
     where ps.shop_id = $1`,
    [shopId]
  );
  const offers: SupplierOffer[] = offerRows.map((o) => ({
    id: o.id,
    supplierId: o.supplier_id,
    productId: o.shopify_product_id,
    productTitle: o.title ?? undefined,
    productPrice: Number(o.product_price),
    shippingPrice: Number(o.shipping_price),
    leadTimeDays: o.lead_time_days ?? undefined,
    moq: o.moq,
    stock: o.stock ?? undefined,
    productUrl: o.product_url ?? undefined,
    note: o.note ?? undefined,
    preferred: o.preferred,
  }));

  const quoteRows = await query<{
    id: string; supplier_id: string; order_id: string | null; shopify_product_id: string | null;
    product_price: string; shipping_price: string; lead_time_days: number | null;
    status: SupplierQuote["status"]; note: string | null; received_at: string | null;
  }>(`select * from supplier_quotes where shop_id = $1 order by created_at desc limit 200`, [shopId]);
  const quotes: SupplierQuote[] = quoteRows.map((q) => ({
    id: q.id,
    supplierId: q.supplier_id,
    orderId: q.order_id ?? undefined,
    productId: q.shopify_product_id ?? undefined,
    productPrice: Number(q.product_price),
    shippingPrice: Number(q.shipping_price),
    leadTimeDays: q.lead_time_days ?? undefined,
    status: q.status,
    note: q.note ?? undefined,
    receivedAt: q.received_at ? new Date(q.received_at).toISOString() : undefined,
  }));

  const messageRows = await query<{
    id: string; supplier_id: string; order_id: string | null; template_key: string; body: string;
    status: SupplierMessage["status"]; prepared_at: string; sent_at: string | null; reply_at: string | null;
    supplier_name: string | null; order_number: string | null;
  }>(
    `select m.*, s.name as supplier_name, o.order_number
     from supplier_messages m
     left join suppliers s on s.id = m.supplier_id
     left join orders o on o.id = m.order_id
     where m.shop_id = $1 order by m.prepared_at desc limit 300`,
    [shopId]
  );
  const messages: SupplierMessage[] = messageRows.map((m) => ({
    id: m.id,
    supplierId: m.supplier_id,
    supplierName: m.supplier_name ?? undefined,
    orderId: m.order_id ?? undefined,
    orderNumber: m.order_number ?? undefined,
    templateKey: m.template_key,
    body: m.body,
    status: m.status,
    preparedAt: new Date(m.prepared_at).toISOString(),
    sentAt: m.sent_at ? new Date(m.sent_at).toISOString() : undefined,
    replyAt: m.reply_at ? new Date(m.reply_at).toISOString() : undefined,
  }));

  const noteRows = await query<{
    id: string; entity_type: InternalNote["entityType"]; entity_id: string; body: string; created_at: string;
  }>(`select * from internal_notes where shop_id = $1 order by created_at desc limit 300`, [shopId]);
  const notes: InternalNote[] = noteRows.map((n) => ({
    id: n.id,
    entityType: n.entity_type,
    entityId: n.entity_id,
    body: n.body,
    createdAt: new Date(n.created_at).toISOString(),
  }));

  return { orders, suppliers, offers, quotes, messages, notes };
}

// ─── Actions (écriture) ───────────────────────────────────────────────────────

export async function applyDeskAction(action: DeskAction): Promise<{ ok: boolean; mode: AppMode; id?: string }> {
  const status = await getAppStatus();
  if (status.mode === "demo") {
    const result = applyDemoDeskAction(action);
    return { ...result, mode: "demo" };
  }
  const shop = await getConnectedShop();
  if (!shop) return { ok: false, mode: "demo" };
  const shopId = shop.id;

  const upsertState = async (orderId: string, fields: string, params: unknown[]) => {
    await query(
      `insert into order_supplier_statuses (shop_id, order_id) values ($1, $2)
       on conflict (shop_id, order_id) do nothing`,
      [shopId, orderId]
    );
    await query(
      `update order_supplier_statuses set ${fields}, updated_at = now() where shop_id = $1 and order_id = $2`,
      [shopId, orderId, ...params]
    );
  };

  switch (action.type) {
    case "set_status":
      await upsertState(action.orderId, "ops_status = $3", [action.status]);
      return { ok: true, mode: "live" };

    case "assign_supplier":
      await upsertState(
        action.orderId,
        `supplier_id = $3, supplier_cost = coalesce($4, supplier_cost),
         ops_status = case when ops_status in ('todo','sourcing','price_compare') then 'supplier_chosen' else ops_status end`,
        [action.supplierId, action.cost ?? null]
      );
      return { ok: true, mode: "live" };

    case "set_tracking":
      await upsertState(action.orderId, "tracking_number = $3, tracking_carrier = $4, ops_status = 'shipped'", [
        action.tracking,
        action.carrier ?? null,
      ]);
      return { ok: true, mode: "live" };

    case "report_problem":
      await upsertState(action.orderId, "ops_status = 'problem', problem_note = $3", [action.note]);
      return { ok: true, mode: "live" };

    case "add_note": {
      const row = await queryOne<{ id: string }>(
        `insert into internal_notes (shop_id, entity_type, entity_id, body) values ($1,$2,$3,$4) returning id`,
        [shopId, action.entityType, action.entityId, action.body]
      );
      return { ok: true, mode: "live", id: row?.id };
    }

    case "record_message": {
      const row = await queryOne<{ id: string }>(
        `insert into supplier_messages (shop_id, supplier_id, order_id, template_key, body, status, sent_at)
         values ($1,$2,$3,$4,$5,$6, case when $6 = 'sent_manual' then now() else null end)
         returning id`,
        [shopId, action.supplierId, action.orderId ?? null, action.templateKey, action.body, action.status]
      );
      await query(`update suppliers set last_contact_at = now(), updated_at = now() where id = $1 and shop_id = $2`, [
        action.supplierId,
        shopId,
      ]);
      if (action.orderId) {
        await upsertState(
          action.orderId,
          `ops_status = case when ops_status in ('todo','sourcing','supplier_chosen') then 'message_sent' else ops_status end`,
          []
        );
      }
      return { ok: true, mode: "live", id: row?.id };
    }

    case "update_message":
      await query(
        `update supplier_messages set status = $3,
           sent_at = case when $3 = 'sent_manual' and sent_at is null then now() else sent_at end,
           reply_at = case when $3 = 'reply_received' and reply_at is null then now() else reply_at end,
           updated_at = now()
         where shop_id = $1 and id = $2`,
        [shopId, action.messageId, action.status]
      );
      return { ok: true, mode: "live" };

    case "add_quote": {
      const row = await queryOne<{ id: string }>(
        `insert into supplier_quotes (shop_id, supplier_id, order_id, shopify_product_id, product_price, shipping_price, lead_time_days, status, received_at)
         values ($1,$2,$3,$4,$5,$6,$7,'received', now()) returning id`,
        [
          shopId,
          action.supplierId,
          action.orderId ?? null,
          action.productId ?? null,
          action.productPrice,
          action.shippingPrice,
          action.leadTimeDays ?? null,
        ]
      );
      if (action.messageId) {
        await query(`update supplier_messages set status = 'price_filled', updated_at = now() where shop_id = $1 and id = $2`, [
          shopId,
          action.messageId,
        ]);
      }
      if (action.productId) {
        await query(
          `insert into product_suppliers (shop_id, supplier_id, shopify_product_id, product_price, shipping_price, lead_time_days)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (shop_id, supplier_id, shopify_product_id) do update set
             product_price = excluded.product_price, shipping_price = excluded.shipping_price,
             lead_time_days = coalesce(excluded.lead_time_days, product_suppliers.lead_time_days),
             updated_at = now()`,
          [shopId, action.supplierId, action.productId, action.productPrice, action.shippingPrice, action.leadTimeDays ?? null]
        );
      }
      return { ok: true, mode: "live", id: row?.id };
    }

    case "upsert_supplier": {
      const s = action.supplier;
      if (s.id) {
        await query(
          `update suppliers set name = $3, whatsapp = $4, email = $5, website = $6, country = $7,
             currency = coalesce($8, currency), avg_lead_time_days = $9,
             reliability_score = coalesce($10, reliability_score), notes = $11,
             tags = coalesce($12::text[], tags), updated_at = now()
           where shop_id = $1 and id = $2`,
          [shopId, s.id, s.name, s.whatsapp ?? null, s.email ?? null, s.website ?? null, s.country ?? null,
            s.currency ?? null, s.avgLeadTimeDays ?? null, s.reliabilityScore ?? null, s.notes ?? null, s.tags ?? null]
        );
        return { ok: true, mode: "live", id: s.id };
      }
      const row = await queryOne<{ id: string }>(
        `insert into suppliers (shop_id, name, whatsapp, email, website, country, currency, avg_lead_time_days, reliability_score, notes, tags)
         values ($1,$2,$3,$4,$5,$6, coalesce($7,'USD'), $8, coalesce($9, 80), $10, coalesce($11::text[], '{}'::text[]))
         on conflict (shop_id, name) do update set updated_at = now()
         returning id`,
        [shopId, s.name, s.whatsapp ?? null, s.email ?? null, s.website ?? null, s.country ?? null,
          s.currency ?? null, s.avgLeadTimeDays ?? null, s.reliabilityScore ?? null, s.notes ?? null, s.tags ?? null]
      );
      return { ok: true, mode: "live", id: row?.id };
    }

    case "add_offer":
      await query(
        `insert into product_suppliers (shop_id, supplier_id, shopify_product_id, product_price, shipping_price, lead_time_days, moq, stock, product_url, preferred)
         values ($1,$2,$3,$4,$5,$6, coalesce($7,1), $8, $9, coalesce($10,false))
         on conflict (shop_id, supplier_id, shopify_product_id) do update set
           product_price = excluded.product_price, shipping_price = excluded.shipping_price,
           lead_time_days = excluded.lead_time_days, moq = excluded.moq, stock = excluded.stock,
           product_url = excluded.product_url, preferred = excluded.preferred, updated_at = now()`,
        [shopId, action.supplierId, action.productId, action.productPrice, action.shippingPrice,
          action.leadTimeDays ?? null, action.moq ?? null, action.stock ?? null, action.productUrl ?? null, action.preferred ?? null]
      );
      return { ok: true, mode: "live" };
  }
}
