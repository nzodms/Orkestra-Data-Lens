import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { DeskAction } from "@/lib/orderdesk/actions";
import { applyDeskAction } from "@/lib/server/orderdesk";

/**
 * POST /api/orderdesk/action — dispatch des actions Order Desk.
 * Validées par zod, exécutées sur le store démo ou PostgreSQL (mode live).
 */

const OPS_STATUSES = [
  "todo", "sourcing", "price_compare", "supplier_chosen", "message_sent",
  "payment_pending", "ordered", "tracking_pending", "shipped", "problem", "sav",
] as const;

const id = z.string().min(1).max(120);
const price = z.number().min(0).max(1_000_000);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_status"), orderId: id, status: z.enum(OPS_STATUSES) }),
  z.object({ type: z.literal("assign_supplier"), orderId: id, supplierId: id, cost: price.optional() }),
  z.object({ type: z.literal("set_tracking"), orderId: id, tracking: z.string().min(3).max(120), carrier: z.string().max(80).optional() }),
  z.object({ type: z.literal("report_problem"), orderId: id, note: z.string().min(3).max(2000) }),
  z.object({
    type: z.literal("add_note"),
    entityType: z.enum(["order", "supplier", "product"]),
    entityId: id,
    body: z.string().min(1).max(2000),
  }),
  z.object({
    type: z.literal("record_message"),
    supplierId: id,
    orderId: id.optional(),
    templateKey: z.string().min(1).max(60),
    body: z.string().min(1).max(4000),
    status: z.enum(["prepared", "sent_manual"]),
  }),
  z.object({
    type: z.literal("update_message"),
    messageId: id,
    status: z.enum(["prepared", "sent_manual", "reply_received", "price_filled", "supplier_selected"]),
  }),
  z.object({
    type: z.literal("add_quote"),
    supplierId: id,
    orderId: id.optional(),
    productId: id.optional(),
    productPrice: price,
    shippingPrice: price,
    leadTimeDays: z.number().int().min(0).max(365).optional(),
    messageId: id.optional(),
  }),
  z.object({
    type: z.literal("upsert_supplier"),
    supplier: z.object({
      id: id.optional(),
      name: z.string().min(1).max(200),
      whatsapp: z.string().max(40).optional(),
      email: z.string().max(200).optional(),
      website: z.string().max(300).optional(),
      country: z.string().max(8).optional(),
      currency: z.string().max(8).optional(),
      avgLeadTimeDays: z.number().int().min(0).max(365).optional(),
      reliabilityScore: z.number().int().min(0).max(100).optional(),
      notes: z.string().max(2000).optional(),
      tags: z.array(z.enum(["rapide", "fiable", "cher", "bon prix", "fragile", "à éviter"])).optional(),
    }),
  }),
  z.object({
    type: z.literal("add_offer"),
    supplierId: id,
    productId: id,
    productPrice: price,
    shippingPrice: price,
    leadTimeDays: z.number().int().min(0).max(365).optional(),
    moq: z.number().int().min(1).max(100000).optional(),
    stock: z.number().int().min(0).max(10_000_000).optional(),
    productUrl: z.string().max(500).optional(),
    preferred: z.boolean().optional(),
  }),
]);

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Action invalide", details: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }

  try {
    const result = await applyDeskAction(parsed.data as DeskAction);
    if (!result.ok) {
      return NextResponse.json({ error: "Action impossible (élément introuvable ?)" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[orderdesk] Action en échec :", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
