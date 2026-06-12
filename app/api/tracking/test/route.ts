import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { isDatabaseConfigured } from "@/lib/server/env";
import { getConnectedShop } from "@/lib/server/repo";

/**
 * POST /api/tracking/test — teste le pipeline d'ingestion sans polluer les
 * données : insertion d'un événement de test dans une transaction
 * immédiatement annulée (ROLLBACK). Mesure la latence base incluse.
 */
export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      mode: "demo",
      ok: false,
      message: "Aucune base configurée : le pipeline ne peut pas être testé en mode démo.",
    });
  }
  const shop = await getConnectedShop();
  if (!shop) {
    return NextResponse.json(
      { mode: "demo", ok: false, message: "Aucune boutique connectée : connectez d'abord la boutique." },
      { status: 409 }
    );
  }

  const started = Date.now();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
      `insert into visitor_sessions (shop_id, session_key, visitor_key, started_at)
       values ($1, 'ses_healthcheck', 'vis_healthcheck', now())
       on conflict (shop_id, session_key) do update set updated_at = now()`,
      [shop.id]
    );
    await client.query(
      `insert into tracking_events (shop_id, session_key, visitor_key, event_name, occurred_at, status, dedupe_key)
       values ($1, 'ses_healthcheck', 'vis_healthcheck', 'page_viewed', now(), 'observed', 'healthcheck')`,
      [shop.id]
    );
    await client.query("rollback"); // rien n'est persisté
    const latencyMs = Date.now() - started;
    return NextResponse.json({
      mode: "live",
      ok: true,
      latencyMs,
      message: `Pipeline opérationnel : validation, session et insertion testées en ${latencyMs} ms (transaction annulée, aucune donnée écrite).`,
    });
  } catch (err) {
    await client.query("rollback").catch(() => {});
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("[tracking/test] Échec :", message);
    return NextResponse.json({ mode: "live", ok: false, message }, { status: 500 });
  } finally {
    client.release();
  }
}
