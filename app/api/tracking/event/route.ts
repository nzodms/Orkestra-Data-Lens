import { NextRequest, NextResponse } from "next/server";
import type { TrackingEvent } from "@/lib/types";

/**
 * Endpoint d'ingestion du Web Pixel Shopify.
 *
 * Reçoit les événements émis par le pixel (analytics.subscribe) et les
 * normalise au format TrackingEvent.
 *
 * TODO(prod) :
 *  1. Authentifier la requête (token de pixel par boutique, CORS storefront).
 *  2. Normaliser l'événement Shopify (page_viewed, product_added_to_cart,
 *     checkout_started…) vers TrackingEvent, avec visitorId/sessionId stables.
 *  3. Insérer en base (table `events`, partitionnée par jour).
 *  4. Déclencher la réconciliation incrémentale (cart/checkout tokens).
 *  5. Dédupliquer (sessionId + eventName + timestamp proche).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<TrackingEvent> | null;

  if (!body?.eventName) {
    return NextResponse.json({ error: "eventName requis" }, { status: 400 });
  }

  return NextResponse.json({
    mode: "demo",
    accepted: true,
    eventName: body.eventName,
    receivedAt: new Date().toISOString(),
  });
}
