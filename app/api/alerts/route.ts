import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setAlertState } from "@/lib/server/activity";

/**
 * POST /api/alerts — résoudre / snoozer / réactiver une alerte opérationnelle.
 * L'alerte (recalculée côté serveur) est transmise avec son nouveau statut ;
 * seul le statut est persisté, le contenu reste recalculé à chaque lecture.
 */

const schema = z.object({
  status: z.enum(["active", "snoozed", "resolved"]),
  snoozeHours: z.number().int().min(1).max(168).optional(),
  alert: z.object({
    id: z.string().min(1).max(200),
    type: z.string().min(1).max(80),
    category: z.enum(["orderdesk", "tracking", "funnel", "supplier", "product"]),
    severity: z.enum(["low", "medium", "high", "critical"]),
    title: z.string().min(1).max(500),
    description: z.string().min(1).max(2000),
    recommendedAction: z.string().max(1000).optional(),
    entityType: z.string().max(40).optional(),
    entityId: z.string().max(200).optional(),
  }),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
  }
  try {
    await setAlertState(parsed.data.alert, parsed.data.status, parsed.data.snoozeHours ?? 24);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[alerts] Mise à jour impossible :", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
